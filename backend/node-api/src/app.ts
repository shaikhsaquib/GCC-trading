/**
 * app.ts — Express application factory.
 *
 * This file only wires up Express middleware and routes.
 * It has NO side effects (no DB connections, no server.listen).
 * That responsibility belongs to server.ts.
 */
import express, { Application } from 'express';
import helmet       from 'helmet';
import cors         from 'cors';
import compression  from 'compression';
import morgan       from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuidv4 } from 'uuid';

import { config }         from './config';
import { logger }         from './core/logger';
import { db }             from './core/database/postgres.client';
import { redis }          from './core/database/redis.client';
import { mongoHealthCheck } from './core/database/mongodb.client';
import { createApiRouter } from './routes';
import { apiRateLimit, maintenanceCheck } from './middlewares/rate-limiter';
import { errorHandler, notFoundHandler }  from './middlewares/error-handler';

export function createApp(): Application {
  const app = express();

  // ── Trust proxy (Nginx in front) ─────────────────────────────────────────
  app.set('trust proxy', 1);

  // ── Security headers ─────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Allowlist comes from ALLOWED_ORIGINS, but we always include the known
  // production frontend and localhost so a misconfigured env var can't lock
  // out the app. Vercel preview deploys (*.vercel.app) are matched by pattern
  // since their subdomain changes on every deploy.
  const staticOrigins = new Set(
    [
      ...config.cors.origins,
      'https://gcc-trading.vercel.app',
      'http://localhost:4200',
    ].map(o => o.replace(/\/$/, '')), // tolerate trailing slashes
  );

  app.use(cors({
    origin(origin, callback) {
      // Non-browser clients (curl, health checks, mobile apps) send no Origin.
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      const allowed =
        staticOrigins.has(normalized) ||
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized);
      if (allowed) return callback(null, true);
      logger.warn('CORS origin rejected', { origin });
      return callback(null, false);
    },
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));

  // ── Body parsing + compression ────────────────────────────────────────────
  app.use(compression());
  app.use(express.json({
    limit: '10mb',
    verify: (req: express.Request, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: true }));

  // ── Request correlation ID ────────────────────────────────────────────────
  app.use((req, _res, next) => {
    req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
    next();
  });

  // ── HTTP request logging ──────────────────────────────────────────────────
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip:   (req) => req.url === '/health',
  }));

  // ── Health endpoint — no auth, no rate limit ──────────────────────────────
  app.get('/health', async (_req, res) => {
    const [pgOk, redisOk, mongoOk] = await Promise.all([
      db.healthCheck(),
      redis.healthCheck(),
      mongoHealthCheck(),
    ]);
    const allOk = pgOk && redisOk && mongoOk;
    const status = allOk ? 'healthy' : 'degraded';
    // Always return 200 so Render's health check doesn't restart the service
    // on transient Redis/MongoDB blips. Use status field to signal degradation.
    res.status(200).json({
      status,
      timestamp: new Date().toISOString(),
      services:  { postgresql: pgOk, redis: redisOk, mongodb: mongoOk },
    });
  });

  // ── API routes ────────────────────────────────────────────────────────────
  const apiPrefix = `/api/${config.api.version}`;

  // AML alerts are served natively from the aml.alerts table (modules/aml) —
  // no proxy to the .NET AML service, which is not deployed in this environment.

  const apiRouter = createApiRouter();

  app.use(apiPrefix, apiRateLimit);
  app.use(apiPrefix, maintenanceCheck as express.RequestHandler);
  app.use(apiPrefix, apiRouter);

  // ── Dev proxy to .NET Core services ──────────────────────────────────────
  if (config.isDev) {
    setupDevProxy(app, apiPrefix);
  }

  // ── Error handling — must be last ─────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function setupDevProxy(app: Application, prefix: string): void {
  const dotnetUrl = config.dotnet.tradingUrl;
  for (const path of ['bonds', 'orders', 'portfolio', 'settlement']) {
    app.use(
      `${prefix}/${path}`,
      createProxyMiddleware({ target: dotnetUrl, changeOrigin: true }) as any,
    );
  }
}
