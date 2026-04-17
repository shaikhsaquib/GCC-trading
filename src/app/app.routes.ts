import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout.component';
import { authGuard, adminGuard, activeGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  /* ─── Auth pages (no sidebar, no guard) ─── */
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/auth/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./pages/auth/register.component').then(m => m.RegisterComponent),
      },
      {
        path: '2fa',
        loadComponent: () =>
          import('./pages/auth/two-factor.component').then(m => m.TwoFactorComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./pages/auth/forgot-password.component').then(m => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./pages/auth/reset-password.component').then(m => m.ResetPasswordComponent),
      },
      {
        path: 'oauth/callback',
        loadComponent: () =>
          import('./pages/auth/oauth-callback.component').then(m => m.OAuthCallbackComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  /* ─── Main app (sidebar layout + auth guard) ─── */
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'identity',
        loadComponent: () =>
          import('./pages/identity/identity.component').then(m => m.IdentityComponent),
      },
      {
        path: 'kyc',
        loadComponent: () =>
          import('./pages/kyc/kyc.component').then(m => m.KycComponent),
      },
      {
        path: 'wallet',
        canActivate: [activeGuard],
        loadComponent: () =>
          import('./pages/wallet/wallet.component').then(m => m.WalletComponent),
      },
      {
        path: 'marketplace',
        canActivate: [activeGuard],
        loadComponent: () =>
          import('./pages/bond-marketplace/bond-marketplace.component').then(
            m => m.BondMarketplaceComponent,
          ),
      },
      {
        path: 'trading',
        canActivate: [activeGuard],
        loadComponent: () =>
          import('./pages/trading-engine/trading-engine.component').then(
            m => m.TradingEngineComponent,
          ),
      },
      {
        path: 'settlement',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/settlement/settlement.component').then(m => m.SettlementComponent),
      },
      {
        path: 'portfolio',
        canActivate: [activeGuard],
        loadComponent: () =>
          import('./pages/portfolio/portfolio.component').then(m => m.PortfolioComponent),
      },
      {
        path: 'aml',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/aml-compliance/aml-compliance.component').then(
            m => m.AmlComplianceComponent,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/notifications/notifications.component').then(
            m => m.NotificationsComponent,
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/admin.component').then(m => m.AdminComponent),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./pages/audit-trail/audit-trail.component').then(m => m.AuditTrailComponent),
      },
      {
        path: 'scheduler',
        loadComponent: () =>
          import('./pages/scheduler/scheduler.component').then(m => m.SchedulerComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
