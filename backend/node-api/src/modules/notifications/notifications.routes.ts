import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { authenticate } from '../../middlewares/authenticate';

export function createNotificationsRouter(controller: NotificationsController): Router {
  const router = Router();

  router.use(authenticate);

  router.get('/',              controller.getAll);
  router.patch('/:id/read',    controller.markRead);
  router.patch('/read-all',    controller.markAllRead);

  return router;
}
