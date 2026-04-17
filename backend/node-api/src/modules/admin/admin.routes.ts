import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authenticate }    from '../../middlewares/authenticate';
import { authorize, requireActive } from '../../middlewares/authorize';

export function createAdminRouter(controller: AdminController): Router {
  const router = Router();

  router.use(authenticate, authorize('ADMIN', 'L2_ADMIN'), requireActive);

  router.get('/dashboard',           controller.getDashboard);
  router.get('/users',               controller.listUsers);
  router.patch('/users/:id/suspend', controller.suspendUser);
  router.patch('/users/:id/activate',controller.activateUser);
  router.get('/audit',               controller.getAuditTrail);
  router.get('/reports/daily',       controller.getDailyReport);
  router.get('/scheduler/jobs',      controller.getSchedulerJobs);

  return router;
}
