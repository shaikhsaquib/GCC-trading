import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  template: `
    <div class="auth-page">
      <!-- Background decoration -->
      <div class="auth-bg">
        <div class="bg-circle c1"></div>
        <div class="bg-circle c2"></div>
        <div class="bg-grid"></div>
      </div>

      <!-- Left panel -->
      <div class="auth-left">
        <div class="brand-block">
          <div class="brand-logo-lg">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="url(#lg1)"/>
              <path d="M12 30V18l12-6 12 6v12l-12 6-12-6z" fill="none" stroke="white" stroke-width="2"/>
              <path d="M12 18l12 6 12-6" stroke="white" stroke-width="2"/>
              <path d="M24 24v12" stroke="white" stroke-width="2"/>
              <defs>
                <linearGradient id="lg1" x1="0" y1="0" x2="48" y2="48">
                  <stop stop-color="#00d4ff"/><stop offset="1" stop-color="#17c3b2"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 class="brand-title">GCC Bond Trading</h1>
          <p class="brand-tagline">Institutional-grade bond trading platform for the Gulf region</p>
        </div>

        <div class="features-list">
          @for (f of features; track f.text) {
            <div class="feature-item">
              <span class="material-icons-round feature-icon">{{ f.icon }}</span>
              <span>{{ f.text }}</span>
            </div>
          }
        </div>

        <div class="stats-row">
          @for (s of stats; track s.label) {
            <div class="auth-stat">
              <span class="auth-stat-val">{{ s.value }}</span>
              <span class="auth-stat-label">{{ s.label }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Right panel: form -->
      <div class="auth-right">
        <div class="auth-card">
          <div class="auth-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your trading account</p>
          </div>

          <form class="auth-form" (ngSubmit)="onLogin()">
            <div class="form-group">
              <label>Email Address</label>
              <div class="input-wrapper">
                <span class="input-icon material-icons-round">email</span>
                <input
                  class="form-control"
                  type="email"
                  [(ngModel)]="email"
                  name="email"
                  placeholder="you@example.com"
                  style="padding-left: 40px"
                />
              </div>
            </div>

            <div class="form-group">
              <label>
                Password
                <a routerLink="/auth/2fa" class="forgot-link">Forgot password?</a>
              </label>
              <div class="input-wrapper">
                <span class="input-icon material-icons-round">lock</span>
                <input
                  class="form-control"
                  [type]="showPass() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="••••••••"
                  style="padding-left: 40px; padding-right: 40px"
                />
                <button type="button" class="pass-toggle" (click)="showPass.set(!showPass())">
                  <span class="material-icons-round">{{ showPass() ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>

            <div class="form-row">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="remember" name="remember" />
                <span>Remember me for 30 days</span>
              </label>
            </div>

            <button type="submit" class="btn btn-primary btn-lg" style="width:100%; justify-content:center" [class.loading]="loading()">
              @if (loading()) {
                <span class="spinner"></span> Signing in...
              } @else {
                <span class="material-icons-round">login</span> Sign In
              }
            </button>
          </form>

          <div class="divider"><span>or continue with</span></div>

          <div class="social-buttons">
            <button class="btn btn-secondary" style="flex:1;justify-content:center">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button class="btn btn-secondary" style="flex:1;justify-content:center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0078d4"><path d="M11.5 0C5.149 0 0 5.149 0 11.5S5.149 23 11.5 23 23 17.851 23 11.5 17.851 0 11.5 0zm0 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm0 15.5a8.5 8.5 0 01-7.09-3.795C5.668 14.21 8.476 13 11.5 13s5.832 1.21 7.09 3.205A8.5 8.5 0 0111.5 19.5z"/></svg>
              Microsoft
            </button>
          </div>

          <p class="auth-switch">
            Don't have an account?
            <a routerLink="/auth/register">Create account</a>
          </p>

          <!-- 2FA Note -->
          <div class="twofa-note">
            <span class="material-icons-round">shield</span>
            <span>Two-factor authentication is required for all trading accounts.</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      background: var(--bg-darkest);
      overflow: hidden;
      position: relative;
    }

    .auth-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    .bg-circle {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.08;
      &.c1 { width: 500px; height: 500px; background: var(--accent-cyan); top: -100px; left: -100px; }
      &.c2 { width: 400px; height: 400px; background: var(--accent-teal); bottom: -100px; right: 30%; }
    }

    .bg-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    /* Left panel */
    .auth-left {
      flex: 1;
      padding: 60px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      z-index: 1;
    }

    .brand-block { margin-bottom: 48px; }

    .brand-logo-lg {
      margin-bottom: 20px;
      filter: drop-shadow(0 4px 24px rgba(0,212,255,0.3));
    }

    .brand-title {
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(135deg, #fff 0%, var(--accent-cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 12px;
    }

    .brand-tagline {
      font-size: 15px;
      color: var(--text-secondary);
      line-height: 1.6;
      max-width: 400px;
    }

    .features-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 48px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: var(--text-secondary);

      .feature-icon {
        font-size: 18px;
        color: var(--accent-cyan);
      }
    }

    .stats-row {
      display: flex;
      gap: 40px;
    }

    .auth-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .auth-stat-val {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .auth-stat-label {
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Right panel */
    .auth-right {
      width: 480px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 40px 40px 0;
      position: relative;
      z-index: 1;
    }

    .auth-card {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    .auth-card-header {
      margin-bottom: 28px;
      h2 { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
      p  { font-size: 14px; color: var(--text-secondary); }
    }

    .auth-form { display: flex; flex-direction: column; gap: 18px; }

    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .forgot-link {
      font-size: 12px;
      color: var(--accent-cyan);
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 500;
      &:hover { text-decoration: underline; }
    }

    .input-wrapper {
      position: relative;
      .input-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 18px;
        color: var(--text-muted);
      }
    }

    .pass-toggle {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      padding: 4px;
      .material-icons-round { font-size: 18px; }
      &:hover { color: var(--text-secondary); }
    }

    .form-row { display: flex; align-items: center; }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
      input[type=checkbox] { accent-color: var(--accent-cyan); width: 14px; height: 14px; }
    }

    .btn.loading { opacity: 0.7; cursor: not-allowed; }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0,0,0,0.2);
      border-top-color: var(--bg-darkest);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 24px 0;
      font-size: 12px;
      color: var(--text-muted);
      &::before, &::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    }

    .social-buttons {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .auth-switch {
      text-align: center;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 20px;
      a { color: var(--accent-cyan); text-decoration: none; font-weight: 600; }
    }

    .twofa-note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: rgba(0,212,255,0.06);
      border: 1px solid rgba(0,212,255,0.15);
      border-radius: var(--radius-sm);
      font-size: 12px;
      color: var(--text-secondary);
      .material-icons-round { font-size: 16px; color: var(--accent-cyan); flex-shrink: 0; }
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  remember = false;
  showPass = signal(false);
  loading = signal(false);

  features = [
    { icon: 'security', text: 'Bank-grade security with 2FA & biometrics' },
    { icon: 'bolt', text: 'Real-time order matching engine' },
    { icon: 'public', text: 'Access to 5,000+ GCC & global bonds' },
    { icon: 'account_balance', text: 'Regulated by SAMA & CMA' },
  ];

  stats = [
    { value: 'SAR 4.2B', label: 'Assets Under Mgmt' },
    { value: '40K+', label: 'Active Investors' },
    { value: '99.9%', label: 'Uptime SLA' },
  ];

  onLogin() {
    this.loading.set(true);
    setTimeout(() => this.loading.set(false), 2000);
  }
}
