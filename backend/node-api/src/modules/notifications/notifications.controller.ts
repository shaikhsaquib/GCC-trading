import { Request, Response, NextFunction } from 'express';
import { NotificationsService } from './notifications.service';
import { sendSuccess } from '../../middlewares/error-handler';

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getNotifications(
        req.user!.id,
        Number(req.query.limit)  || 20,
        Number(req.query.offset) || 0,
      );
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.markRead(req.params.id, req.user!.id);
      sendSuccess(res, { read: true });
    } catch (err) { next(err); }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.markAllRead(req.user!.id);
      sendSuccess(res, { read: true });
    } catch (err) { next(err); }
  };
}
