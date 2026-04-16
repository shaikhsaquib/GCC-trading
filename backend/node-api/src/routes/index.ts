import { Router } from 'express';

// Controllers
import { AuthController }          from '../modules/auth/auth.controller';
import { KycController }           from '../modules/kyc/kyc.controller';
import { WalletController }        from '../modules/wallet/wallet.controller';
import { NotificationsController } from '../modules/notifications/notifications.controller';
import { AdminController }         from '../modules/admin/admin.controller';
import { BondsController }         from '../modules/bonds/bonds.controller';

// Route factories
import { createAuthRouter }          from '../modules/auth/auth.routes';
import { createKycRouter }           from '../modules/kyc/kyc.routes';
import { createWalletRouter }        from '../modules/wallet/wallet.routes';
import { createNotificationsRouter } from '../modules/notifications/notifications.routes';
import { createAdminRouter }         from '../modules/admin/admin.routes';
import { createBondsRouter }         from '../modules/bonds/bonds.routes';
import { createOrdersRouter }        from '../modules/orders/orders.routes';
import { createPortfolioRouter }     from '../modules/portfolio/portfolio.routes';
import { createSettlementsRouter }   from '../modules/settlements/settlements.routes';

// Services & Repositories (dependency wiring)
import { AuthRepository }          from '../modules/auth/auth.repository';
import { AuthService }             from '../modules/auth/auth.service';
import { KycRepository }           from '../modules/kyc/kyc.repository';
import { KycService }              from '../modules/kyc/kyc.service';
import { WalletRepository }        from '../modules/wallet/wallet.repository';
import { WalletService }           from '../modules/wallet/wallet.service';
import { NotificationsRepository } from '../modules/notifications/notifications.repository';
import { NotificationsService }    from '../modules/notifications/notifications.service';
import { AdminRepository }         from '../modules/admin/admin.repository';
import { AdminService }            from '../modules/admin/admin.service';
import { AuditRepository }         from '../modules/audit/audit.repository';
import { AuditService }            from '../modules/audit/audit.service';
import { BondsRepository }         from '../modules/bonds/bonds.repository';
import { BondsService }            from '../modules/bonds/bonds.service';

import { eventBus } from '../core/events/event-bus';

// ---------------------------------------------------------------------------
// Compose the dependency graph — pure constructor injection, no DI container
// ---------------------------------------------------------------------------

const auditRepo    = new AuditRepository();
const auditService = new AuditService(auditRepo);

const authRepo    = new AuthRepository();
const authService = new AuthService(authRepo, eventBus);
const authCtrl    = new AuthController(authService);

const kycRepo    = new KycRepository();
const kycService = new KycService(kycRepo, eventBus);
const kycCtrl    = new KycController(kycService);

const walletRepo    = new WalletRepository();
const walletService = new WalletService(walletRepo, eventBus);
const walletCtrl    = new WalletController(walletService);

const notifRepo    = new NotificationsRepository();
const notifService = new NotificationsService(notifRepo);
const notifCtrl    = new NotificationsController(notifService);

const adminRepo    = new AdminRepository();
const adminService = new AdminService(adminRepo, auditService);
const adminCtrl    = new AdminController(adminService, auditService);

const bondsRepo    = new BondsRepository();
const bondsService = new BondsService(bondsRepo);
const bondsCtrl    = new BondsController(bondsService);

// Export for use in event handlers (server.ts)
export { notifService, walletService, auditService };

// ---------------------------------------------------------------------------
// Assemble the versioned API router
// ---------------------------------------------------------------------------

export function createApiRouter(): Router {
  const router = Router();

  router.use('/auth',          createAuthRouter(authCtrl));
  router.use('/kyc',           createKycRouter(kycCtrl));
  router.use('/wallet',        createWalletRouter(walletCtrl));
  router.use('/notifications', createNotificationsRouter(notifCtrl));
  router.use('/admin',         createAdminRouter(adminCtrl));
  router.use('/bonds',         createBondsRouter(bondsCtrl));
  router.use('/orders',        createOrdersRouter());
  router.use('/portfolio',     createPortfolioRouter());
  router.use('/settlements',   createSettlementsRouter());

  return router;
}
