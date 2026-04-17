import { Component, signal, inject, OnInit } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  form!: FormGroup;
  showPass    = signal(false);
  loading     = this.auth.loading;
  error       = signal<string | null>(null);
  oauthLoading = signal<'google' | 'microsoft' | null>(null);

  features = [
    { icon: 'security',        text: 'Bank-grade security with 2FA & biometrics' },
    { icon: 'bolt',            text: 'Real-time order matching engine' },
    { icon: 'public',          text: 'Access to 5,000+ GCC & global bonds' },
    { icon: 'account_balance', text: 'Regulated by SAMA & CMA' },
  ];

  stats = [
    { value: 'SAR 4.2B', label: 'Assets Under Mgmt' },
    { value: '40K+',     label: 'Active Investors' },
    { value: '99.9%',    label: 'Uptime SLA' },
  ];

  ngOnInit(): void {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      remember: [false],
    });

    const oauthError = this.route.snapshot.queryParamMap.get('oauth_error');
    if (oauthError) {
      const msgs: Record<string, string> = {
        cancelled:      'Sign-in was cancelled.',
        state_mismatch: 'Security validation failed. Please try again.',
        auth_failed:    'Social sign-in failed. Please try again or use email.',
      };
      this.error.set(msgs[oauthError] ?? 'Social sign-in failed. Please try again.');
    }
  }

  get f() { return this.form.controls; }

  fieldError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.errors?.[error]);
  }

  hasError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.invalid);
  }

  onLogin(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.error.set(null);
    const { email, password } = this.form.value as { email: string; password: string };

    this.auth.login(email, password).subscribe({
      next: res => {
        if ('requires2FA' in res) {
          this.router.navigate(['/auth/2fa'], { state: { tempToken: res.tempToken } });
        } else {
          this.router.navigate(['/']);
        }
      },
      error: err => {
        const msg = err?.error?.error ?? err?.error?.message ?? 'Invalid email or password';
        this.error.set(msg);
      },
    });
  }

  async loginWithGoogle(): Promise<void> {
    const env = environment as any;
    const clientId: string = env.oauth?.google?.clientId ?? '';

    if (!clientId) {
      this.error.set('Google sign-in is not configured. Please use email and password.');
      return;
    }

    this.error.set(null);
    this.oauthLoading.set('google');

    try {
      const verifier  = this.pkceVerifier();
      const challenge = await this.pkceChallenge(verifier);
      const state     = crypto.randomUUID();

      sessionStorage.setItem('oauth_code_verifier', verifier);
      sessionStorage.setItem('oauth_provider',      'google');
      sessionStorage.setItem('oauth_state',         state);

      const params = new URLSearchParams({
        response_type:         'code',
        client_id:             clientId,
        redirect_uri:          `${window.location.origin}/auth/oauth/callback`,
        scope:                 'openid email profile',
        code_challenge:        challenge,
        code_challenge_method: 'S256',
        state,
        access_type:           'offline',
        prompt:                'select_account',
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch {
      this.oauthLoading.set(null);
      this.error.set('Failed to initiate Google sign-in. Please try again.');
    }
  }

  async loginWithMicrosoft(): Promise<void> {
    const env = environment as any;
    const clientId: string = env.oauth?.microsoft?.clientId ?? '';
    const tenantId: string = env.oauth?.microsoft?.tenantId ?? 'common';

    if (!clientId) {
      this.error.set('Microsoft sign-in is not configured. Please use email and password.');
      return;
    }

    this.error.set(null);
    this.oauthLoading.set('microsoft');

    try {
      const verifier  = this.pkceVerifier();
      const challenge = await this.pkceChallenge(verifier);
      const state     = crypto.randomUUID();

      sessionStorage.setItem('oauth_code_verifier', verifier);
      sessionStorage.setItem('oauth_provider',      'microsoft');
      sessionStorage.setItem('oauth_state',         state);

      const params = new URLSearchParams({
        response_type:         'code',
        client_id:             clientId,
        redirect_uri:          `${window.location.origin}/auth/oauth/callback`,
        scope:                 'openid profile email User.Read',
        code_challenge:        challenge,
        code_challenge_method: 'S256',
        state,
        response_mode:         'query',
        prompt:                'select_account',
      });

      window.location.href =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
    } catch {
      this.oauthLoading.set(null);
      this.error.set('Failed to initiate Microsoft sign-in. Please try again.');
    }
  }

  private pkceVerifier(): string {
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async pkceChallenge(verifier: string): Promise<string> {
    const data   = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
