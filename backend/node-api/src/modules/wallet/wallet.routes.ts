import { Router, Response } from 'express';
import { body } from 'express-validator';
import { walletService } from './wallet.service';
import { authenticate, requireActive } from '../../shared/middleware/auth.middleware';
import { walletRateLimit } from '../../shared/middleware/rate-limit.middleware';
import { asyncHandler } from '../../shared/middleware/error.middleware';
import { AuthenticatedRequest } from '../../shared/types';

const router = Router();

/** GET /wallet/balance — FSD §7.5 */
router.get('/balance', authenticate, requireActive, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await walletService.getBalance(req.user!.id);
  res.json({ success: true, data });
}));

/** GET /wallet/transactions */
router.get('/transactions', authenticate, requireActive, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { type, page, limit } = req.query as Record<string, string>;
  const data = await walletService.getTransactions(req.user!.id, {
    type, page: +page || 1, limit: +limit || 20,
  });
  res.json({ success: true, data });
}));

/** POST /wallet/deposit — initiate card deposit via HyperPay */
router.post(
  '/deposit',
  authenticate,
  requireActive,
  walletRateLimit,
  [
    body('amount').isFloat({ min: 100, max: 50000 }).withMessage('Amount must be between 100 and 50,000'),
    body('idempotency_key').isUUID().withMessage('Valid idempotency_key required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { amount, idempotency_key } = req.body as { amount: number; idempotency_key: string };
    const data = await walletService.initiateDeposit(req.user!.id, amount, idempotency_key);
    res.status(201).json({ success: true, data });
  }),
);

/** POST /wallet/webhook/hyperpay — HyperPay payment webhook (no auth) */
router.post('/webhook/hyperpay', asyncHandler(async (req, res: Response) => {
  await walletService.handleDepositWebhook(req.body);
  res.status(200).json({ received: true });
}));

/** POST /wallet/withdraw — initiate withdrawal (requires 2FA) */
router.post(
  '/withdraw',
  authenticate,
  requireActive,
  walletRateLimit,
  [
    body('amount').isFloat({ min: 50 }).withMessage('Minimum withdrawal is 50 AED'),
    body('bank_account_id').notEmpty().isUUID().withMessage('Valid bank_account_id required'),
    body('totp_code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('2FA code required'),
    body('idempotency_key').isUUID().withMessage('Valid idempotency_key required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // TODO: validate TOTP code via Keycloak before processing
    const { amount, bank_account_id, idempotency_key } = req.body as {
      amount: number; bank_account_id: string; idempotency_key: string;
    };
    const data = await walletService.initiateWithdrawal(
      req.user!.id, amount, bank_account_id, idempotency_key,
    );
    res.status(201).json({ success: true, data });
  }),
);

export default router;
