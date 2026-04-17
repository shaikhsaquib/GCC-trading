import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/auth/login']);
};

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/auth/login']);
  if (!auth.isAdmin())    return router.createUrlTree(['/']);
  return true;
};

/** Requires the account to be ACTIVE (KYC approved). Redirects PENDING_KYC to /kyc. */
export const activeGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/auth/login']);
  if (!auth.isActive())   return router.createUrlTree(['/kyc']);
  return true;
};
