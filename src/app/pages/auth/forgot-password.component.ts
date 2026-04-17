import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  template: `
    <div class="auth-page">
      <div class="auth-left">
        <div class="brand">
          <span class="material-icons-round brand-icon">account_balance</span>
          <span class="brand-name">GCC<strong>Bond</strong></span>
        </div>
        <h1>Forgot your password?</h1>
        <p style="color:var(--text-secondary);margin-top:8px">
          Enter your registered email address and we'll send you a reset link.
        </p>
      </div>

      <div class="auth-right">
        <div class="auth-card">
          <h2>Reset Password</h2>

          @if (sent()) {
            <div class="alert alert-success" style="margin-bottom:20px">
              <span class="material-icons-round">mark_email_read</span>
              If that email is registered, a reset link has been sent. Check your inbox.
            </div>
            <a routerLink="/auth/login" class="btn btn-primary" style="width:100%;justify-content:center">
              Back to Login
            </a>
          } @else {
            @if (error()) {
              <div class="alert alert-danger" style="margin-bottom:16px">{{ error() }}</div>
            }

            <form (ngSubmit)="submit()" #f="ngForm">
              <div class="form-group">
                <label>Email Address</label>
                <input
                  class="form-control"
                  type="email"
                  name="email"
                  [(ngModel)]="email"
                  required
                  placeholder="investor@example.com"
                  [class.is-invalid]="f.submitted && !email"
                />
              </div>

              <button
                class="btn btn-primary"
                type="submit"
                style="width:100%;justify-content:center;margin-top:8px"
                [disabled]="loading()"
              >
                @if (loading()) {
                  <span class="material-icons-round spin">sync</span> Sending...
                } @else {
                  <span class="material-icons-round">send</span> Send Reset Link
                }
              </button>
            </form>

            <p style="text-align:center;margin-top:20px;font-size:13px;color:var(--text-secondary)">
              Remembered it? <a routerLink="/auth/login" class="text-link">Sign in</a>
            </p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { display: flex; min-height: 100vh; background: var(--bg-primary); }
    .auth-left  { flex: 1; padding: 60px; display: flex; flex-direction: column; justify-content: center; background: var(--bg-secondary); border-right: 1px solid var(--border); }
    .auth-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; }
    .auth-card  { width: 100%; max-width: 400px; }
    .brand      { display: flex; align-items: center; gap: 10px; font-size: 24px; margin-bottom: 40px; }
    .brand-icon { color: var(--accent-cyan); font-size: 32px; }
    .form-group { margin-bottom: 16px; label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; } }
    .text-link  { color: var(--accent-cyan); text-decoration: none; &:hover { text-decoration: underline; } }
    .alert      { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 8px; font-size: 13px; &.alert-success { background: rgba(46,213,115,0.1); color: var(--success); border: 1px solid rgba(46,213,115,0.2); } &.alert-danger { background: rgba(255,71,87,0.1); color: var(--danger); border: 1px solid rgba(255,71,87,0.2); } }
    .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin-bottom: 24px; }
  `],
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);

  email   = '';
  loading = signal(false);
  error   = signal<string | null>(null);
  sent    = signal(false);

  submit() {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.requestPasswordReset(this.email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.sent.set(true); // still show success to prevent email enumeration
      },
    });
  }
}
