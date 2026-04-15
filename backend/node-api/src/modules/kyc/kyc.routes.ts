import { Router, Response } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { kycService } from './kyc.service';
import { authenticate, requireRole, requireActive } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/error.middleware';
import { AuthenticatedRequest, UserRole } from '../../shared/types';

const router = Router();

// multer: in-memory storage, max 10MB (FSD §12.4)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('KYC_INVALID_TYPE'));
  },
});

/** GET /kyc/status — user's current KYC status */
router.get('/status', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await kycService.getStatus(req.user!.id);
  res.json({ success: true, data });
}));

/** POST /kyc/start — create a new KYC submission */
router.post('/start', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await kycService.startSubmission(req.user!.id);
  res.status(201).json({ success: true, data });
}));

/** POST /kyc/:kycId/documents — upload a document */
router.post(
  '/:kycId/documents',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { kycId } = req.params;
    const { document_type } = req.body as { document_type: string };
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } }); return; }
    const data = await kycService.uploadDocument(req.user!.id, kycId, document_type, file);
    res.status(201).json({ success: true, data });
  }),
);

/** POST /kyc/:kycId/submit — finalise and send to Onfido */
router.post(
  '/:kycId/submit',
  authenticate,
  [body('risk_answers').isArray({ min: 5, max: 10 }).withMessage('Risk questionnaire required')],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await kycService.submit(req.user!.id, req.params.kycId, req.body.risk_answers);
    res.json({ success: true, data });
  }),
);

/** POST /kyc/webhook/onfido — Onfido callback (no auth, verified via HMAC) */
router.post('/webhook/onfido', asyncHandler(async (req, res: Response) => {
  await kycService.handleOnfidoWebhook(req.body);
  res.status(200).json({ received: true });
}));

// ── Admin routes ──────────────────────────────────────────────────────────────

/** GET /kyc/admin/queue — review queue */
router.get(
  '/admin/queue',
  authenticate,
  requireRole(UserRole.ADMIN_L1, UserRole.ADMIN_L2, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res: Response) => {
    const { status, page, limit } = req.query as Record<string, string>;
    const data = await kycService.getQueue({ status, page: +page || 1, limit: +limit || 20 });
    res.json({ success: true, data });
  }),
);

/** POST /kyc/admin/:kycId/approve */
router.post(
  '/admin/:kycId/approve',
  authenticate,
  requireRole(UserRole.ADMIN_L2, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await kycService.approve(req.params.kycId, req.user!.id);
    res.json({ success: true, data });
  }),
);

/** POST /kyc/admin/:kycId/reject */
router.post(
  '/admin/:kycId/reject',
  authenticate,
  requireRole(UserRole.ADMIN_L2, UserRole.SUPER_ADMIN),
  [body('reason').notEmpty().withMessage('Rejection reason required')],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await kycService.reject(req.params.kycId, req.user!.id, req.body.reason);
    res.json({ success: true, data });
  }),
);

export default router;
