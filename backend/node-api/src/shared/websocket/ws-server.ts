/**
 * WebSocket server — real-time price updates and order status (FSD §20).
 * Protocol: wss://api.gccbond.com/ws
 * Messages: JSON { type, payload }
 */
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server }    from 'http';
import jwt                            from 'jsonwebtoken';
import { logger }                     from '../utils/logger';
import { redis }                      from '../db/redis';
import { eventBus, Events }           from '../events/event-bus';

interface AuthenticatedSocket extends WebSocket {
  userId?:        string;
  subscribedBonds: Set<string>;
  isAlive:         boolean;
}

interface WsMessage {
  type:    string;
  payload: Record<string, unknown>;
}

// ── Client registry ───────────────────────────────────────────────────────────

const clients = new Map<string, Set<AuthenticatedSocket>>(); // userId → sockets

function addClient(userId: string, ws: AuthenticatedSocket): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(ws);
}

function removeClient(userId: string, ws: AuthenticatedSocket): void {
  clients.get(userId)?.delete(ws);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

function sendToUser(userId: string, message: WsMessage): void {
  clients.get(userId)?.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify(message));
  });
}

// ── Bond subscriptions ────────────────────────────────────────────────────────

// Track all sockets subscribed to a bond for price broadcasts
const bondSubscriptions = new Map<string, Set<AuthenticatedSocket>>(); // bondId → sockets

function subscribeToBond(bondId: string, ws: AuthenticatedSocket): void {
  if (!bondSubscriptions.has(bondId)) bondSubscriptions.set(bondId, new Set());
  bondSubscriptions.get(bondId)!.add(ws);
  ws.subscribedBonds.add(bondId);
}

function broadcastBondPrice(bondId: string, price: number, change: number): void {
  const message: WsMessage = {
    type:    'PRICE_UPDATE',
    payload: { bondId, price, change, timestamp: Date.now() },
  };
  bondSubscriptions.get(bondId)?.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify(message));
  });
}

// ── JWT authentication ────────────────────────────────────────────────────────

function authenticateToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? '') as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

function handleMessage(ws: AuthenticatedSocket, raw: string): void {
  try {
    const msg = JSON.parse(raw) as WsMessage;

    switch (msg.type) {
      case 'SUBSCRIBE_BOND': {
        const bondId = msg.payload.bondId as string;
        if (bondId) subscribeToBond(bondId, ws);
        ws.send(JSON.stringify({ type: 'SUBSCRIBED', payload: { bondId } }));
        break;
      }

      case 'UNSUBSCRIBE_BOND': {
        const bondId = msg.payload.bondId as string;
        bondSubscriptions.get(bondId)?.delete(ws);
        ws.subscribedBonds.delete(bondId);
        break;
      }

      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG', payload: { ts: Date.now() } }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unknown message type' } }));
    }
  } catch {
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid JSON' } }));
  }
}

// ── WebSocket server setup ────────────────────────────────────────────────────

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Heartbeat (ping/pong to detect dead connections)
  const heartbeat = setInterval(() => {
    wss.clients.forEach(rawWs => {
      const ws = rawWs as AuthenticatedSocket;
      if (!ws.isAlive) {
        if (ws.userId) removeClient(ws.userId, ws);
        ws.subscribedBonds?.forEach(bondId => bondSubscriptions.get(bondId)?.delete(ws));
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (rawWs: WebSocket, req: IncomingMessage) => {
    const ws = rawWs as AuthenticatedSocket;
    ws.isAlive        = true;
    ws.subscribedBonds = new Set();

    // Authenticate via query string token: /ws?token=<jwt>
    const url      = new URL(req.url ?? '', 'http://localhost');
    const token    = url.searchParams.get('token');
    const userId   = token ? authenticateToken(token) : null;

    if (!userId) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unauthorized' } }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.userId = userId;
    addClient(userId, ws);

    ws.send(JSON.stringify({ type: 'CONNECTED', payload: { userId, ts: Date.now() } }));
    logger.debug('WebSocket connected', { userId });

    ws.on('pong',    () => { ws.isAlive = true; });
    ws.on('message', (data) => handleMessage(ws, data.toString()));
    ws.on('close',   () => {
      removeClient(userId, ws);
      ws.subscribedBonds.forEach(bondId => bondSubscriptions.get(bondId)?.delete(ws));
      logger.debug('WebSocket disconnected', { userId });
    });
    ws.on('error', (err) => logger.error('WebSocket error', { userId, error: err.message }));
  });

  // ── Subscribe to domain events → push to clients ────────────────────────────

  // Order status updates
  eventBus.subscribe('ws.order-status', Events.ORDER_FILLED, async (event: { payload: { user_id: string; order_id: string; status: string; filled_quantity: string; avg_fill_price: string } }) => {
    sendToUser(event.payload.user_id, {
      type:    'ORDER_UPDATE',
      payload: {
        orderId:        event.payload.order_id,
        status:         event.payload.status,
        filledQuantity: event.payload.filled_quantity,
        avgFillPrice:   event.payload.avg_fill_price,
      },
    });
  });

  // Trade executed → notify buyer + seller
  eventBus.subscribe('ws.trade-executed', Events.TRADE_EXECUTED, async (event: { payload: { buyer_id: string; seller_id: string; bond_id: string; quantity: string; price: string } }) => {
    const { buyer_id, seller_id, bond_id, quantity, price } = event.payload;
    const tradeMsg: WsMessage = {
      type:    'TRADE_EXECUTED',
      payload: { bondId: bond_id, quantity, price, timestamp: Date.now() },
    };
    sendToUser(buyer_id,  tradeMsg);
    sendToUser(seller_id, tradeMsg);

    // Update bond price broadcast
    broadcastBondPrice(bond_id, parseFloat(price), 0);
  });

  logger.info('WebSocket server started at /ws');
  return wss;
}

export { sendToUser, broadcastBondPrice };
