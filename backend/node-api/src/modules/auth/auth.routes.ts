import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from './auth.service';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authRateLimit } from '../../shared/middleware/rate-limit.middleware';
import { asyncHandler, AppError } from '../../shared/middleware/error.middleware';
import { AuthenticatedRequest } from '../../shared/types';

const router = Router();

// ── Input validators (FSD §12.1) ─────────────────────────────────────────────

const registerValidation = [
  body('email').isEmail().normalizeEmail().isLength({ max: 255 }).withMessage('Valid email required'),
  body('phone').matches(/^\+[1-9]\d{9,14}$/).withMessage('Phone must be E.164 format (+971...)'),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters'),
  body('first_name').isLength({ min: 2, max: 50 }).matches(/^[\p{L}\s-]+$/u).withMessage('First name: 2-50 letters'),
  body('last_name').isLength({ min: 2, max: 50 }).matches(/^[\p{L}\s-]+$/u).withMessage('Last name: 2-50 letters'),
  body('country_code').isIn(['AE', 'SA', 'BH', 'KW', 'QA']).withMessage('Country must be AE, SA, BH, KW, or QA'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details: Record<string, string[]> = {};
    errors.array().forEach((e) => {
      const field = ('path' in e ? e.path : 'field') as string;
      details[field] = [...(details[field] || []), e.msg];
    });
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details } });
    return false;
  }
  return true;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * FSD §7.1, AUTH-001 to AUTH-006
 */
router.post(
  '/register',
  authRateLimit,
  registerValidation,
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  }),
);

/**
 * POST /auth/login
 * FSD §7.2, AUTH-010 to AUTH-013
 */
router.post(
  '/login',
  authRateLimit,
  loginValidation,
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const ip = req.ip || req.socket.remoteAddress;
    const result = await authService.login(req.body, ip);
    res.status(200).json({ success: true, data: result });
  }),
);

/**
 * POST /auth/2fa/verify — complete login with 2FA code
 * FSD §AUTH-011
 */
router.post(
  '/2fa/verify',
  authRateLimit,
  [
    body('temp_token').notEmpty().isUUID().withMessage('temp_token required'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit code required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const { temp_token, code } = req.body as { temp_token: string; code: string };
    const result = await authService.verify2FA(temp_token, code);
    res.status(200).json({ success: true, data: result });
  }),
);

/**
 * GET /auth/2fa/setup — get QR code for TOTP setup
 */
router.get(
  '/2fa/setup',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.setup2FA(req.user!.id);
    res.status(200).json({ success: true, data: result });
  }),
);

/**
 * POST /auth/2fa/enable — confirm and activate 2FA
 */
router.post(
  '/2fa/enable',
  authenticate,
  [body('code').isLength({ min: 6, max: 6 }).isNumeric()],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!handleValidation(req, res)) return;
    const result = await authService.enable2FA(req.user!.id, req.body.code);
    res.status(200).json({ success: true, data: result });
  }),
);

/**
 * POST /auth/refresh — get new access token
 * FSD §AUTH-014
 */
router.post(
  '/refresh',
  [body('refresh_token').notEmpty().withMessage('refresh_token required')],
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const result = await authService.refresh(req.body.refresh_token);
    res.status(200).json({ success: true, data: result });
  }),
);

/**
 * POST /auth/logout
 * FSD §AUTH-015
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const token = req.headers.authorization?.slice(7) || '';
    const result = await authService.logout(req.user!.id, token);
    res.status(200).json({ success: true, data: result });
  }),
);

/**
 * POST /auth/password/reset-request
 * FSD §AUTH-020
 */
router.post(
  '/password/reset-request',
  authRateLimit,
  [body('email').isEmail().normalizeEmail()],
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const result = await authService.requestPasswordReset(req.body.email);
    res.status(200).json({ success: true, data: result });
  }),
);

/**
 * POST /auth/password/reset
 * FSD §AUTH-020
 */
router.post(
  '/password/reset',
  authRateLimit,
  [
    body('token').notEmpty().isUUID(),
    body('new_password').isLength({ min: 8, max: 128 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    const { token, new_password } = req.body as { token: string; new_password: string };
    const result = await authService.resetPassword(token, new_password);
    res.status(200).json({ success: true, data: result });
  }),
);

export default router;
