import rateLimit from 'express-rate-limit';
import { redis } from '../db/redis';

const windowMs    = parseInt(process.env.RATE_LIMIT_WINDOW_MS     || '60000');
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS  || '100');

/** Default API rate limit: 100 req/min per IP — FSD §13.1 */
export const apiRateLimit = rateLimit({
  windowMs,
  max: maxRequests,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' },
  },
});

/** Strict limit for auth endpoints: 10 req/min */
export const authRateLimit = rateLimit({
  windowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: { code: 'AUTH_RATE_LIMIT', message: 'Too many authentication attempts. Try again in 1 minute.' },
  },
});

/** Deposit/withdrawal: 5 req/min */
export const walletRateLimit = rateLimit({
  windowMs,
  max: 5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: { code: 'WALLET_RATE_LIMIT', message: 'Too many wallet operations. Please wait.' },
  },
});

/** Check feature flag: MAINTENANCE_MODE disables all non-health traffic */
export const maintenanceCheck = async (
  _req: unknown,
  res: { status: (n: number) => { json: (b: unknown) => void } },
  next: () => void,
): Promise<void> => {
  const maintenance = await redis.getFeatureFlag('MAINTENANCE_MODE');
  if (maintenance) {
    res.status(503).json({
      success: false,
      error: { code: 'MAINTENANCE_MODE', message: 'Platform is under scheduled maintenance. Please try again shortly.' },
    });
    return;
  }
  next();
};
