import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { redis } from '../core/database/redis.client';
import { ServiceUnavailableError } from '../core/errors';

// ── Standard API rate limit (100 req / minute / IP) ──────────────────────────
export const apiRateLimit = rateLimit({
  windowMs:          60_000,
  max:               100,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { success: false, code: 'RATE_LIMITED', message: 'Too many requests' },
});

// ── Auth endpoint limit (10 req / minute / IP) ────────────────────────────────
export const authRateLimit = rateLimit({
  windowMs:          60_000,
  max:               10,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { success: false, code: 'RATE_LIMITED', message: 'Too many auth attempts' },
});

// ── Wallet endpoint limit (5 req / minute / IP) ───────────────────────────────
export const walletRateLimit = rateLimit({
  windowMs:          60_000,
  max:               5,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { success: false, code: 'RATE_LIMITED', message: 'Too many wallet requests' },
});

// ── Maintenance mode gate ─────────────────────────────────────────────────────
export async function maintenanceCheck(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const maintenance = await redis.getFeatureFlag('MAINTENANCE_MODE');
  if (maintenance) {
    return next(new ServiceUnavailableError('Platform is under scheduled maintenance'));
  }
  next();
}
