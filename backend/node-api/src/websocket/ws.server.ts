import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../core/logger';
import { IEventBus } from '../core/events/event-bus';
import { EventRoutes } from '../core/events/event.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthenticatedSocket extends WebSocket {
  userId:          string;
  subscribedBonds: Set<string>;
  isAlive:         boolean;
}

interface WsMessage {
  type:    string;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Client registry
// ---------------------------------------------------------------------------

const userSockets  = new Map<string, Set<AuthenticatedSocket>>();
const bondSockets  = new Map<string, Set<AuthenticatedSocket>>();

function addClient(userId: string, ws: AuthenticatedSocket): void {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(ws);
}

function removeClient(ws: AuthenticatedSocket): void {
  userSockets.get(ws.userId)?.delete(ws);
  ws.subscribedBonds.forEach(id => bondSockets.get(id)?.delete(ws));
}

export function sendToUser(userId: string, message: WsMessage): void {
  userSockets.get(userId)?.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  });
}

export function broadcastBondPrice(bondId: string, price: number): void {
  bondSockets.get(bondId)?.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'PRICE_UPDATE', payload: { bondId, price, ts: Date.now() } }));
  });
}

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

function handleMessage(ws: AuthenticatedSocket, raw: string): void {
  let msg: WsMessage;
  try { msg = JSON.parse(raw); }
  catch { ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid JSON' } })); return; }

  switch (msg.type) {
    case 'SUBSCRIBE_BOND': {
      const id = msg.payload.bondId as string;
      if (!bondSockets.has(id)) bondSockets.set(id, new Set());
      bondSockets.get(id)!.add(ws);
      ws.subscribedBonds.add(id);
      ws.send(JSON.stringify({ type: 'SUBSCRIBED', payload: { bondId: id } }));
      break;
    }
    case 'UNSUBSCRIBE_BOND': {
      const id = msg.payload.bondId as string;
      bondSockets.get(id)?.delete(ws);
      ws.subscribedBonds.delete(id);
      break;
    }
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', payload: { ts: Date.now() } }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unknown message type' } }));
  }
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createWebSocketServer(httpServer: Server, eventBus: IEventBus): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Heartbeat — detect and close dead connections every 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach(raw => {
      const ws = raw as AuthenticatedSocket;
      if (!ws.isAlive) { removeClient(ws); return ws.terminate(); }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (raw: WebSocket, req) => {
    const ws = raw as AuthenticatedSocket;
    ws.isAlive         = true;
    ws.subscribedBonds = new Set();

    // Authenticate via ?token=<jwt> query parameter
    const url     = new URL(req.url ?? '', 'http://localhost');
    const token   = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    let userId: string;
    try {
      const p = jwt.verify(token, config.jwt.secret) as { sub: string };
      userId  = p.sub;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.userId = userId;
    addClient(userId, ws);
    ws.send(JSON.stringify({ type: 'CONNECTED', payload: { userId, ts: Date.now() } }));

    ws.on('pong',    () => { ws.isAlive = true; });
    ws.on('message', (data) => handleMessage(ws, data.toString()));
    ws.on('close',   () => removeClient(ws));
    ws.on('error',   (err) => logger.error('WebSocket error', { userId, error: err.message }));
  });

  // Forward domain events to connected clients
  void eventBus.subscribe('ws.order-filled', EventRoutes.ORDER_FILLED, async (event: any) => {
    sendToUser(event.payload.user_id, { type: 'ORDER_UPDATE', payload: event.payload });
  });

  void eventBus.subscribe('ws.trade-executed', EventRoutes.TRADE_EXECUTED, async (event: any) => {
    const { buyer_id, seller_id, bond_id, price } = event.payload;
    const msg = { type: 'TRADE_EXECUTED', payload: event.payload };
    sendToUser(buyer_id,  msg);
    sendToUser(seller_id, msg);
    broadcastBondPrice(bond_id, parseFloat(price));
  });

  logger.info('WebSocket server running at /ws');
  return wss;
}
