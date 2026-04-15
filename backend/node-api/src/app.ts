/**
 * GCC Bond Trading Platform — Node.js API Gateway
 * Serves: Auth, KYC, Wallet, Notifications, Admin, Audit
 * Communicates with .NET Core services via RabbitMQ domain events.
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

import { logger }           from './shared/utils/logger';
import { db }               from './shared/db/postgres';
import { redis }            from './shared/db/redis';
import { connectMongoDB, mongoHealthCheck } from './shared/db/mongodb';
import { eventBus }         from './shared/events/event-bus';
import { registerEventHandlers } from './shared/events/event-handlers';
import { apiRateLimit, maintenanceCheck } from './shared/middleware/rate-limit.middleware';
import { errorHandler, notFoundHandler }  from './shared/middleware/error.middleware';

// ── Route modules ──────────────────────────────────────────────────────────────
import authRoutes          from './modules/auth/auth.routes';
import kycRoutes           from './modules/kyc/kyc.routes';
import walletRoutes        from './modules/wallet/wallet.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import adminRoutes         from './modules/admin/admin.routes';
import { createWebSocketServer } from './shared/websocket/ws-server';
import { startScheduler }        from './shared/scheduler/scheduler';

const app    = express();
const PORT   = parseInt(process.env.PORT || '3000');
const PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

// ── Security & Parsing ────────────────────────────────────────────────────────

app.set('trust proxy', 1);   // Trust Nginx reverse proxy

app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
  hsts:                  { maxAge: 31_536_000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin:      process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4200'],
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID for tracing
app.use((req, _res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Rate Limiting ─────────────────────────────────────────────────────────────

app.use(PREFIX, apiRateLimit);

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — no auth, no rate limit
app.get('/health', async (_req, res) => {
  const [pgOk, redisOk, mongoOk] = await Promise.all([
    db.healthCheck(),
    redis.healthCheck(),
    mongoHealthCheck(),
  ]);

  const status = pgOk && redisOk && mongoOk ? 'healthy' : 'degraded';
  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: { postgresql: pgOk, redis: redisOk, mongodb: mongoOk },
  });
});

// Webhook endpoints — bypass maintenance check (must be available)
app.use(`${PREFIX}/wallet/webhook`,  walletRoutes);
app.use(`${PREFIX}/kyc/webhook`,     kycRoutes);

// All other routes — maintenance gate first
app.use(PREFIX, maintenanceCheck as express.RequestHandler);
app.use(`${PREFIX}/auth`,          authRoutes);
app.use(`${PREFIX}/kyc`,           kycRoutes);
app.use(`${PREFIX}/wallet`,        walletRoutes);
app.use(`${PREFIX}/notifications`, notificationsRoutes);
app.use(`${PREFIX}/admin`,         adminRoutes);

// Proxy to .NET Core for trading/portfolio/bonds
// These routes are handled by the .NET Core services; Nginx routes them directly in prod.
// In dev, we proxy for convenience.
if (process.env.NODE_ENV === 'development') {
  const { createProxyMiddleware } = await import('http-proxy-middleware' as unknown as string) as {
    createProxyMiddleware: (opts: { target: string; changeOrigin: boolean; pathFilter: string }) => express.RequestHandler
  };
  const dotnetUrl = process.env.DOTNET_TRADING_URL || 'http://localhost:5000';
  app.use(`${PREFIX}/bonds`,     createProxyMiddleware({ target: dotnetUrl, changeOrigin: true, pathFilter: `${PREFIX}/bonds` }));
  app.use(`${PREFIX}/orders`,    createProxyMiddleware({ target: dotnetUrl, changeOrigin: true, pathFilter: `${PREFIX}/orders` }));
  app.use(`${PREFIX}/portfolio`, createProxyMiddleware({ target: dotnetUrl, changeOrigin: true, pathFilter: `${PREFIX}/portfolio` }));
  app.use(`${PREFIX}/settlement`,createProxyMiddleware({ target: dotnetUrl, changeOrigin: true, pathFilter: `${PREFIX}/settlement` }));
}

// 404 + Error handlers — must be last
app.use(notFoundHandler);
app.use(errorHandler);

// ── Startup ───────────────────────────────────────────────────────────────────

const start = async (): Promise<void> => {
  try {
    // Connect all services
    await connectMongoDB();
    await eventBus.connect();
    await registerEventHandlers();

    // Verify DB
    const pgOk = await db.healthCheck();
    if (!pgOk) throw new Error('PostgreSQL unreachable');

    const server = app.listen(PORT, () => {
      logger.info(`GCC Bond Node API started`, {
        port: PORT,
        env:  process.env.NODE_ENV,
        prefix: PREFIX,
      });
    });

    // WebSocket server (wss://.../ws)
    createWebSocketServer(server);

    // Background cron jobs
    startScheduler();
  } catch (err) {
    logger.error('Startup failed', { error: (err as Error).message });
    process.exit(1);
  }
};

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  await Promise.allSettled([db.close(), redis.close(), eventBus.close()]);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason }));

start();

export default app;
