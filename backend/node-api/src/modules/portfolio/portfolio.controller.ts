import { Request, Response, NextFunction } from 'express';
import { PortfolioService } from './portfolio.service';

export class PortfolioController {
  constructor(private readonly svc: PortfolioService) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.svc.getSummary(req.user!.id);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  };

  getHoldings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const holdings = await this.svc.getHoldings(req.user!.id);
      res.json({ success: true, data: holdings });
    } catch (err) {
      next(err);
    }
  };

  getCouponCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const calendar = await this.svc.getCouponCalendar(req.user!.id);
      res.json({ success: true, data: calendar });
    } catch (err) {
      next(err);
    }
  };
}
