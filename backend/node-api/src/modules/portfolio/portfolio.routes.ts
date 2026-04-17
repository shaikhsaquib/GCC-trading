import { Router } from 'express';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService }    from './portfolio.service';
import { PortfolioRepository } from './portfolio.repository';
import { authenticate }        from '../../middlewares/authenticate';
import { requireActive }       from '../../middlewares/authorize';

export function createPortfolioRouter(): Router {
  const repo = new PortfolioRepository();
  const svc  = new PortfolioService(repo);
  const ctrl = new PortfolioController(svc);

  const router = Router();

  router.use(authenticate, requireActive);

  router.get('/',               ctrl.getSummary);
  router.get('/holdings',       ctrl.getHoldings);
  router.get('/coupon-calendar', ctrl.getCouponCalendar);

  return router;
}
