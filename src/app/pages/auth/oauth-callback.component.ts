import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [],
  template: `
    <div class="cb-wrap">
      <div class="cb-card">
        <div class="cb-spinner"></div>
        <p class="cb-label">Completing sign-in…</p>
      </div>
    </div>
  `,
  styles: [`
    .cb-wrap {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #0a0e1a;
    }
    .cb-card {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      padding: 40px; background: #131929; border: 1px solid #1e2d45;
      border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .cb-spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(0,212,255,0.15);
      border-top-color: #00d4ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .cb-label { color: #8899aa; font-size: 14px; font-family: sans-serif; margin: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route  = inject(ActivatedRoute);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const code  = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (error || !code) {
      this.router.navigate(['/auth/login'], {
        queryParams: { oauth_error: error ?? 'cancelled' },
      });
      return;
    }

    const provider     = sessionStorage.getItem('oauth_provider') as 'google' | 'microsoft';
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    const savedState   = sessionStorage.getItem('oauth_state');

    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_provider');
    sessionStorage.removeItem('oauth_state');

    if (!provider || !codeVerifier) {
      this.router.navigate(['/auth/login']);
      return;
    }

    if (state && savedState && state !== savedState) {
      this.router.navigate(['/auth/login'], { queryParams: { oauth_error: 'state_mismatch' } });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/oauth/callback`;

    this.auth.oauthLogin(provider, { code, codeVerifier, redirectUri }).subscribe({
      next: () => this.router.navigate(['/']),
      error: () =>
        this.router.navigate(['/auth/login'], { queryParams: { oauth_error: 'auth_failed' } }),
    });
  }
}
