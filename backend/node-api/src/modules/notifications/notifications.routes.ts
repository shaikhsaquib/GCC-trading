import { Router, Response } from 'express';
import { notificationsService } from './notifications.service';
import { authenticate, requireActive } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/error.middleware';
import { AuthenticatedRequest } from '../../shared/types';

const router = Router();

/** GET /notifications — in-app notification center (FSD §NTF-004) */
router.get('/', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit } = req.query as Record<string, string>;
  const data = await notificationsService.getNotifications(req.user!.id, +page || 1, +limit || 20);
  res.json({ success: true, data });
}));

/** PATCH /notifications/:id/read */
router.patch('/:id/read', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await notificationsService.markRead(req.user!.id, req.params.id);
  res.json({ success: true, data: { marked_read: true } });
}));

/** PATCH /notifications/read-all */
router.patch('/read-all', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await notificationsService.markAllRead(req.user!.id);
  res.json({ success: true, data: { marked_read: true } });
}));

export default router;
