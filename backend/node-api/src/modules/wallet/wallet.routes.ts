import { Router } from 'express';
import { WalletController } from './wallet.controller';
import { authenticate }     from '../../middlewares/authenticate';
import { requireActive }    from '../../middlewares/authorize';
import { validate }         from '../../middlewares/validate';
import { walletRateLimit }  from '../../middlewares/rate-limiter';
import { depositSchema, withdrawSchema } from './wallet.validator';

export function createWalletRouter(controller: WalletController): Router {
  const router = Router();

  // Webhook — unauthenticated (HyperPay calls this directly)
  router.post('/webhook/hyperpay', controller.depositWebhook);

  // All other wallet routes require an active account
  router.use(authenticate, requireActive);

  router.get('/balance',       controller.getBalance);
  router.get('/transactions',  controller.getTransactions);

  router.post('/deposit',
    walletRateLimit,
    validate(depositSchema),
    controller.deposit,
  );

  router.post('/withdraw',
    walletRateLimit,
    validate(withdrawSchema),
    controller.withdraw,
  );

  return router;
}
