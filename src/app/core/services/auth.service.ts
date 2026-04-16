import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User, LoginResponse, Require2FAResponse, TokenPair,
} from '../models/api.models';

interface Wrapped<T> { success: boolean; data: T; }

const KEYS = {
  access:  'gcc_access_token',
  refresh: 'gcc_refresh_token',
  user:    'gcc_user',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user    = signal<User | null>(this.loadUser());
  private readonly _loading = signal(false);

  readonly user       = this._user.asReadonly();
  readonly loading    = this._loading.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly isActive   = computed(() => this._user()?.status === 'ACTIVE');
  readonly isAdmin    = computed(() =>
    ['ADMIN', 'L2_ADMIN', 'COMPLIANCE', 'KYC_OFFICER'].includes(this._user()?.role ?? ''),
  );

  // ── Register ────────────────────────────────────────────────────────────────

  register(dto: {
    email: string; password: string; phone: string;
    firstName: string; lastName: string;
    nationality: string; dateOfBirth: string; currency?: string;
  }) {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, dto);
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  login(email: string, password: string) {
    this._loading.set(true);
    return this.http
      .post<Wrapped<LoginResponse | Require2FAResponse>>(
        `${environment.apiUrl}/auth/login`, { email, password },
      )
      .pipe(
        map(res => res.data),
        tap(res => {
          if (!('requires2FA' in res)) this.storeSession(res as LoginResponse);
          this._loading.set(false);
        }),
        catchError(err => {
          this._loading.set(false);
          return throwError(() => err);
        }),
      );
  }

  // ── 2FA ─────────────────────────────────────────────────────────────────────

  verify2FA(tempToken: string, totpCode: string) {
    return this.http
      .post<Wrapped<LoginResponse>>(`${environment.apiUrl}/auth/2fa/verify`, { tempToken, totpCode })
      .pipe(map(res => res.data), tap(res => this.storeSession(res)));
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  refresh() {
    const token = localStorage.getItem(KEYS.refresh);
    if (!token) return throwError(() => new Error('No refresh token'));
    return this.http
      .post<Wrapped<TokenPair>>(`${environment.apiUrl}/auth/refresh`, { refreshToken: token })
      .pipe(
        map(res => res.data),
        tap(res => {
          localStorage.setItem(KEYS.access,  res.accessToken);
          localStorage.setItem(KEYS.refresh, res.refreshToken);
        }),
      );
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  logout() {
    const token = this.getAccessToken();
    // Clear local session immediately so the UI reflects logged-out state
    this.clearSession();
    this.router.navigate(['/auth/login']);
    // Best-effort server-side token revocation (fire-and-forget)
    if (token) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({ error: () => {} });
    }
  }

  // ── Password Reset ───────────────────────────────────────────────────────────

  requestPasswordReset(email: string) {
    return this.http.post<Wrapped<{ message: string }>>(
      `${environment.apiUrl}/auth/password/reset-request`, { email },
    ).pipe(map(res => res.data));
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post<Wrapped<{ message: string }>>(
      `${environment.apiUrl}/auth/password/reset`, { token, newPassword },
    ).pipe(map(res => res.data));
  }

  getAccessToken(): string | null {
    return localStorage.getItem(KEYS.access);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private storeSession(res: LoginResponse): void {
    localStorage.setItem(KEYS.access,  res.accessToken);
    localStorage.setItem(KEYS.refresh, res.refreshToken);
    localStorage.setItem(KEYS.user,    JSON.stringify(res.user));
    this._user.set(res.user);
  }

  private clearSession(): void {
    localStorage.removeItem(KEYS.access);
    localStorage.removeItem(KEYS.refresh);
    localStorage.removeItem(KEYS.user);
    this._user.set(null);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(KEYS.user);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
