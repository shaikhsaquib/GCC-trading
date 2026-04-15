import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, UserRole, UserStatus } from '../types';
import { redis } from '../db/redis';
import { logger } from '../utils/logger';

interface JwtPayload {
  sub:    string;   // user_id
  email:  string;
  role:   UserRole;
  status: UserStatus;
  iat:    number;
  exp:    number;
}

/** Verify JWT from Authorization: Bearer <token> header */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'AUTH_TOKEN_MISSING', message: 'Authorization token required' } });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;

    // Check token is not in the revocation list (Redis SET revoked:<jti>)
    const revoked = await redis.exists(`revoked:${token.slice(-16)}`);
    if (revoked) {
      res.status(401).json({ success: false, error: { code: 'AUTH_TOKEN_REVOKED', message: 'Token has been revoked' } });
      return;
    }

    req.user = {
      id:     payload.sub,
      email:  payload.email,
      role:   payload.role,
      status: payload.status,
    };
    next();
  } catch (err) {
    const isExpired = (err as Error).name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      error: {
        code:    isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
        message: isExpired ? 'Access token expired. Please refresh.' : 'Invalid access token',
      },
    });
  }
};

/** Require specific roles. Call after authenticate(). */
export const requireRole = (...roles: UserRole[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ success: false, error: { code: 'AUTH_UNAUTHENTICATED', message: 'Not authenticated' } }); return; }
    if (!roles.includes(req.user.role)) {
      logger.warn('Forbidden: insufficient role', { user_id: req.user.id, required: roles, actual: req.user.role });
      res.status(403).json({ success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }
    next();
  };

/** Require user account to be ACTIVE (KYC approved) */
export const requireActive = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) { res.status(401).json({ success: false, error: { code: 'AUTH_UNAUTHENTICATED', message: 'Not authenticated' } }); return; }
  if (req.user.status === UserStatus.SUSPENDED) {
    res.status(403).json({ success: false, error: { code: 'AUTH_SUSPENDED', message: 'Account suspended. Contact support.' } });
    return;
  }
  if (req.user.status !== UserStatus.ACTIVE) {
    res.status(403).json({ success: false, error: { code: 'AUTH_KYC_REQUIRED', message: 'Complete KYC verification to access this feature' } });
    return;
  }
  next();
};
