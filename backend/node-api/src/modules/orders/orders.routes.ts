import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { OrdersService }    from './orders.service';
import { OrdersRepository } from './orders.repository';
import { authenticate }     from '../../middlewares/authenticate';
import { requireActive }    from '../../middlewares/authorize';

export function createOrdersRouter(): Router {
  const repo = new OrdersRepository();
  const svc  = new OrdersService(repo);
  const ctrl = new OrdersController(svc);

  const router = Router();

  router.use(authenticate, requireActive);

  router.get('/book/:bondId', ctrl.getOrderBook);

  router.post('/',    ctrl.placeOrder);
  router.get('/',     ctrl.getMyOrders);
  router.delete('/:id', ctrl.cancelOrder);

  return router;
}
