import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { authenticate } from '../../middlewares/authenticate';

export function createNotificationsRouter(controller: NotificationsController): Router {
  const router = Router();

  router.use(authenticate);

  router.get('/',              controller.getAll);
  router.patch('/read-all',    controller.markAllRead);  // must come before /:id/read
  router.patch('/:id/read',    controller.markRead);

  return router;
}
