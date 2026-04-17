import { Request, Response, NextFunction } from 'express';
import { WalletService } from './wallet.service';
import { sendSuccess } from '../../middlewares/error-handler';

export class WalletController {
  constructor(private readonly service: WalletService) {}

  getBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const balance = await this.service.getBalance(req.user!.id);
      sendSuccess(res, balance);
    } catch (err) { next(err); }
  };

  deposit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.initiateDeposit(req.user!.id, req.body);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  depositWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id: hyperpayId, merchantTransactionId } = req.body;
      await this.service.handleDepositWebhook(hyperpayId, merchantTransactionId);
      res.status(200).send('OK');
    } catch (err) { next(err); }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.initiateWithdrawal(req.user!.id, req.body);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getTransactions(req.user!.id, {
        limit:  Number(req.query.limit)  || 20,
        offset: Number(req.query.offset) || 0,
      });
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };
}
