import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { redis } from '../core/database/redis.client';
import { UnauthorizedError } from '../core/errors';

interface JwtPayload {
  sub:    string;
  email:  string;
  role:   string;
  status: string;
  jti:    string;
}

/**
 * Validates the Bearer JWT, checks the Redis revocation list, and attaches
 * `req.user` for downstream handlers.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing Bearer token');
    }

    const token   = authHeader.slice(7);
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Check revocation list (logout, password reset).
    // If Redis is unavailable, skip the check — the JWT signature is still
    // verified and tokens are short-lived (15m), so fail open rather than
    // 500 every authenticated request.
    try {
      const revoked = await redis.isTokenRevoked(payload.jti);
      if (revoked) throw new UnauthorizedError('Token has been revoked');
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      // Redis down — proceed without revocation check
    }

    req.user = {
      id:     payload.sub,
      email:  payload.email,
      role:   payload.role,
      status: payload.status,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired token'));
    } else {
      next(err);
    }
  }
}
