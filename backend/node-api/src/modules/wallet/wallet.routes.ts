import { Router } from 'express';
import { WalletController }       from './wallet.controller';
import { authenticate }           from '../../middlewares/authenticate';
import { requireActive }          from '../../middlewares/authorize';
import { validate }               from '../../middlewares/validate';
import { walletRateLimit }        from '../../middlewares/rate-limiter';
import { depositSchema, withdrawSchema } from './wallet.validator';
import { verifyHyperpayPayment }  from '../../middlewares/verify-webhook';

export function createWalletRouter(controller: WalletController): Router {
  const router = Router();

  // Webhook — unauthenticated; payment verified against HyperPay API before handler runs
  router.post('/webhook/hyperpay', verifyHyperpayPayment, controller.depositWebhook);

  // All other wallet routes require an active account
  router.use(authenticate, requireActive);

  router.get('/balance',       controller.getBalance);
  router.get('/transactions',  controller.getTransactions);

  router.post('/deposit',
    walletRateLimit,
    validate(depositSchema),
    controller.deposit,
  );

  // Demo payment completion — only active when HYPERPAY_API_KEY is not set
  router.post('/demo-complete', controller.demoComplete);

  router.post('/withdraw',
    walletRateLimit,
    validate(withdrawSchema),
    controller.withdraw,
  );

  return router;
}
