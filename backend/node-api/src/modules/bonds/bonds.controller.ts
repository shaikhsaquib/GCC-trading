import { Request, Response, NextFunction } from 'express';
import { BondsService } from './bonds.service';

export class BondsController {
  constructor(private readonly svc: BondsService) {}

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page     = Math.max(1, parseInt(String(req.query['page']     ?? 1),    10) || 1);
      const pageSize = Math.min(100, parseInt(String(req.query['pageSize'] ?? 20), 10) || 20);
      const result   = await this.svc.search({
        search:   req.query['search']  as string | undefined,
        status:   req.query['status']  as string | undefined,
        type:     req.query['type']    as string | undefined,
        page,
        pageSize,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bond = await this.svc.getById(req.params['id']!);
      if (!bond) {
        res.status(404).json({ success: false, error: 'Bond not found' });
        return;
      }
      res.json({ success: true, data: bond });
    } catch (err) {
      next(err);
    }
  };
}
