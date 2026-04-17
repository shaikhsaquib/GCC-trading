import { Request, Response, NextFunction } from 'express';
import { SettlementsService } from './settlements.service';

export class SettlementsController {
  constructor(private readonly svc: SettlementsService) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page     = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query['pageSize'] ?? '50'), 10)));
      const status   = req.query['status'] ? String(req.query['status']) : undefined;
      const userId   = req.user?.id;

      const result = await this.svc.getAll({ userId, status, page, pageSize });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
