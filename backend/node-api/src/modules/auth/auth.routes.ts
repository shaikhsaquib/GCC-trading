import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate }        from '../../middlewares/validate';
import { authenticate }    from '../../middlewares/authenticate';
import { authRateLimit }   from '../../middlewares/rate-limiter';
import {
  registerSchema, loginSchema, verify2FASchema,
  enable2FASchema, refreshSchema,
  resetRequestSchema, resetPasswordSchema,
} from './auth.validator';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  // Public routes — rate-limited
  router.post('/register',
    authRateLimit,
    validate(registerSchema),
    controller.register,
  );

  router.post('/login',
    authRateLimit,
    validate(loginSchema),
    controller.login,
  );

  router.post('/2fa/verify',
    authRateLimit,
    validate(verify2FASchema),
    controller.verify2FA,
  );

  router.post('/refresh',
    validate(refreshSchema),
    controller.refresh,
  );

  router.post('/password/reset-request',
    authRateLimit,
    validate(resetRequestSchema),
    controller.requestPasswordReset,
  );

  router.post('/password/reset',
    validate(resetPasswordSchema),
    controller.resetPassword,
  );

  // Authenticated routes
  router.get('/2fa/setup',   authenticate, controller.setup2FA);
  router.post('/2fa/enable', authenticate, validate(enable2FASchema), controller.enable2FA);
  router.post('/logout',     authenticate, controller.logout);

  return router;
}
