/**
 * server.ts — Application bootstrap / entry point.
 *
 * Responsibilities:
 *   1. Connect to all infrastructure (PostgreSQL, Redis, MongoDB, RabbitMQ)
 *   2. Register domain event handlers
 *   3. Start HTTP server + WebSocket server
 *   4. Start background job scheduler
 *   5. Handle graceful shutdown on SIGTERM / SIGINT
 *
 * Separation from app.ts ensures `createApp()` is independently testable
 * without starting a real server or connecting to databases.
 */
import 'dotenv/config';

import { createApp }           from './app';
import { config }              from './config';
import { logger }              from './core/logger';
import { db }                  from './core/database/postgres.client';
import { redis }               from './core/database/redis.client';
import { connectMongoDB }      from './core/database/mongodb.client';
import { eventBus }            from './core/events/event-bus';
import { registerEventHandlers } from './core/events/event-handlers';
import { createWebSocketServer } from './websocket/ws.server';
import { startScheduler }        from './jobs/scheduler';
import { notifService, walletService, auditService } from './routes';

async function bootstrap(): Promise<void> {
  logger.info('Starting GCC Bond Node API...', { env: config.env });

  // 1. Connect infrastructure
  await connectMongoDB();
  await eventBus.connect();

  // Verify PostgreSQL is reachable
  const pgOk = await db.healthCheck();
  if (!pgOk) throw new Error('PostgreSQL is unreachable at startup');

  // 2. Register domain event consumers
  await registerEventHandlers(eventBus, notifService, walletService, auditService);

  // 3. Create Express app + HTTP server
  const app    = createApp();
  const server = app.listen(config.port, () => {
    logger.info('HTTP server listening', { port: config.port, prefix: `/api/${config.api.version}` });
  });

  // 4. Attach WebSocket server (shares the HTTP port)
  createWebSocketServer(server, eventBus);

  // 5. Start background job scheduler
  startScheduler();
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down gracefully...`);
  await Promise.allSettled([
    db.close(),
    redis.close(),
    eventBus.close(),
  ]);
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  // Log but do NOT exit — transient infra errors (Redis/RabbitMQ reconnect)
  // should not crash the entire process. Only truly fatal errors should exit.
  const message = reason instanceof Error ? reason.message : JSON.stringify(reason);
  logger.error('Unhandled promise rejection', { reason: message });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { error: (err as Error).message });
  process.exit(1);
});
