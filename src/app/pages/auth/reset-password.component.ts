import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  template: `
    <div class="auth-page">
      <div class="auth-left">
        <div class="brand">
          <span class="material-icons-round brand-icon">account_balance</span>
          <span class="brand-name">GCC<strong>Bond</strong></span>
        </div>
        <h1>Set a new password</h1>
        <p style="color:var(--text-secondary);margin-top:8px">
          Choose a strong password — at least 8 characters with a mix of letters and numbers.
        </p>
      </div>

      <div class="auth-right">
        <div class="auth-card">
          <h2>New Password</h2>

          @if (!token) {
            <div class="alert alert-danger">
              <span class="material-icons-round">error</span>
              Invalid or missing reset token. Please request a new reset link.
            </div>
            <a routerLink="/auth/forgot-password" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:16px">
              Request New Link
            </a>
          } @else if (done()) {
            <div class="alert alert-success" style="margin-bottom:20px">
              <span class="material-icons-round">check_circle</span>
              Password updated successfully! You can now sign in.
            </div>
            <a routerLink="/auth/login" class="btn btn-primary" style="width:100%;justify-content:center">
              Sign In
            </a>
          } @else {
            @if (error()) {
              <div class="alert alert-danger" style="margin-bottom:16px">{{ error() }}</div>
            }

            <form (ngSubmit)="submit()" #f="ngForm">
              <div class="form-group">
                <label>New Password</label>
                <div class="input-wrap">
                  <input
                    class="form-control"
                    [type]="showPass() ? 'text' : 'password'"
                    name="password"
                    [(ngModel)]="password"
                    required
                    minlength="8"
                    placeholder="Min. 8 characters"
                    [class.is-invalid]="f.submitted && password.length < 8"
                  />
                  <button type="button" class="toggle-vis" (click)="showPass.set(!showPass())">
                    <span class="material-icons-round">{{ showPass() ? 'visibility_off' : 'visibility' }}</span>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label>Confirm Password</label>
                <input
                  class="form-control"
                  type="password"
                  name="confirm"
                  [(ngModel)]="confirm"
                  required
                  placeholder="Repeat new password"
                  [class.is-invalid]="f.submitted && confirm !== password"
                />
                @if (f.submitted && confirm !== password) {
                  <div class="field-error">Passwords do not match</div>
                }
              </div>

              <button
                class="btn btn-primary"
                type="submit"
                style="width:100%;justify-content:center;margin-top:8px"
                [disabled]="loading()"
              >
                @if (loading()) {
                  <span class="material-icons-round spin">sync</span> Updating...
                } @else {
                  <span class="material-icons-round">lock_reset</span> Set New Password
                }
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page  { display: flex; min-height: 100vh; background: var(--bg-primary); }
    .auth-left  { flex: 1; padding: 60px; display: flex; flex-direction: column; justify-content: center; background: var(--bg-secondary); border-right: 1px solid var(--border); }
    .auth-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; }
    .auth-card  { width: 100%; max-width: 400px; }
    .brand      { display: flex; align-items: center; gap: 10px; font-size: 24px; margin-bottom: 40px; }
    .brand-icon { color: var(--accent-cyan); font-size: 32px; }
    .form-group { margin-bottom: 16px; label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; } }
    .input-wrap { position: relative; .toggle-vis { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0; } }
    .field-error { font-size: 11px; color: var(--danger); margin-top: 4px; }
    .alert      { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 8px; font-size: 13px; &.alert-success { background: rgba(46,213,115,0.1); color: var(--success); border: 1px solid rgba(46,213,115,0.2); } &.alert-danger { background: rgba(255,71,87,0.1); color: var(--danger); border: 1px solid rgba(255,71,87,0.2); } }
    .spin       { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin-bottom: 24px; }
  `],
})
export class ResetPasswordComponent implements OnInit {
  private readonly auth  = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  token   = '';
  password = '';
  confirm  = '';
  showPass = signal(false);
  loading  = signal(false);
  error    = signal<string | null>(null);
  done     = signal(false);

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  submit() {
    if (this.password.length < 8 || this.password !== this.confirm) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.error ?? err?.error?.message ?? 'Reset failed. The link may have expired.',
        );
      },
    });
  }
}
