import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../core/errors';

/**
 * Role-based access control guard.
 *
 * Usage: `router.delete('/users/:id', authenticate, authorize('ADMIN'), handler)`
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(`Role '${req.user.role}' is not permitted`));
    }

    next();
  };
}

/**
 * Blocks suspended or deactivated accounts from accessing guarded routes.
 */
export function requireActive(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new UnauthorizedError());

  if (req.user.status !== 'ACTIVE') {
    return next(new ForbiddenError('Your account is not active'));
  }

  next();
}
