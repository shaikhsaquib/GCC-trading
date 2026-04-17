import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  const token = auth.getAccessToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only try refresh on 401 and not on auth endpoints themselves
      if (err.status === 401 && !req.url.includes('/auth/')) {
        if (isRefreshing) {
          auth.logout();
          return throwError(() => err);
        }
        isRefreshing = true;
        return auth.refresh().pipe(
          switchMap(() => {
            isRefreshing = false;
            const newToken  = auth.getAccessToken();
            const retryReq  = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retryReq);
          }),
          catchError(refreshErr => {
            isRefreshing = false;
            auth.logout();
            return throwError(() => refreshErr);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
