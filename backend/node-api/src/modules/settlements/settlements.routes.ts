import { Router } from 'express';
import { SettlementsController } from './settlements.controller';
import { SettlementsService }    from './settlements.service';
import { SettlementsRepository } from './settlements.repository';
import { authenticate }          from '../../middlewares/authenticate';
import { requireActive }         from '../../middlewares/authorize';

export function createSettlementsRouter(): Router {
  const repo = new SettlementsRepository();
  const svc  = new SettlementsService(repo);
  const ctrl = new SettlementsController(svc);

  const router = Router();

  router.use(authenticate, requireActive);

  router.get('/', ctrl.getAll);

  return router;
}
