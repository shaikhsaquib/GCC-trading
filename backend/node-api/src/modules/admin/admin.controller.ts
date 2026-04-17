import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { sendSuccess }  from '../../middlewares/error-handler';
import { getSchedulerStatus } from '../../jobs/scheduler';

export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly audit:   AuditService,
  ) {}

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.service.getDashboard();
      sendSuccess(res, stats);
    } catch (err) { next(err); }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listUsers({
        status: req.query.status as string,
        role:   req.query.role   as string,
        search: req.query.search as string,
        limit:  Number(req.query.limit)  || 20,
        offset: Number(req.query.offset) || 0,
      });
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  suspendUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.suspendUser(req.params.id, req.user!.id);
      sendSuccess(res, { suspended: true });
    } catch (err) { next(err); }
  };

  activateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.activateUser(req.params.id, req.user!.id);
      sendSuccess(res, { activated: true });
    } catch (err) { next(err); }
  };

  getAuditTrail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.audit.query({
        actor_id:   req.query.actorId   as string,
        target_id:  req.query.targetId  as string,
        event_type: req.query.eventType as string,
        from:       req.query.from      as string,
        to:         req.query.to        as string,
        limit:      Number(req.query.limit)  || 50,
        offset:     Number(req.query.offset) || 0,
      });
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  getDailyReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.service.getDailyReport();
      sendSuccess(res, report);
    } catch (err) { next(err); }
  };

  getSchedulerJobs = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      sendSuccess(res, getSchedulerStatus());
    } catch (err) { next(err); }
  };
}
