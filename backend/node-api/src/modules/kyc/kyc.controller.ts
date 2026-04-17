import { Request, Response, NextFunction } from 'express';
import { KycService } from './kyc.service';
import { KycStatus } from './kyc.types';
import { sendSuccess, sendCreated } from '../../middlewares/error-handler';

export class KycController {
  constructor(private readonly service: KycService) {}

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const submission = await this.service.getStatus(req.user!.id);
      sendSuccess(res, { submission });
    } catch (err) { next(err); }
  };

  startSubmission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const submission = await this.service.startSubmission(req.user!.id);
      sendCreated(res, { submission });
    } catch (err) { next(err); }
  };

  uploadDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.uploadDocument({
        submissionId: req.params.kycId,
        documentType: req.body.documentType,
        file:         req.file!,
      });
      sendCreated(res, { uploaded: true });
    } catch (err) { next(err); }
  };

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.submit(req.params.kycId, req.user!.id);
      sendSuccess(res, { submitted: true });
    } catch (err) { next(err); }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.handleOnfidoWebhook(req.body);
      res.status(200).send('OK');
    } catch (err) { next(err); }
  };

  // Admin
  getQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getQueue({
        status: req.query.status as KycStatus | undefined,
        limit:  Number(req.query.limit)  || 20,
        offset: Number(req.query.offset) || 0,
      });
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.approve(req.params.kycId, req.user!.id, req.body);
      sendSuccess(res, { approved: true });
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.reject(req.params.kycId, req.user!.id, req.body);
      sendSuccess(res, { rejected: true });
    } catch (err) { next(err); }
  };
}
