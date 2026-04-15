import { Component, signal, ElementRef, ViewChildren, QueryList, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-two-factor',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass],
  template: `
    <div class="auth-page">
      <div class="auth-bg">
        <div class="bg-circle c1"></div>
      </div>

      <div class="twofa-container">
        <div class="twofa-card">
          <!-- Logo -->
          <div class="twofa-brand">
            <div class="shield-icon">
              <span class="material-icons-round">shield</span>
            </div>
            <h2>Two-Factor Authentication</h2>
            <p>Enter the 6-digit code from your authenticator app or SMS to continue.</p>
          </div>

          <!-- Tab: TOTP or SMS -->
          <div class="method-tabs">
            <button class="method-tab" [class.active]="method() === 'totp'" (click)="method.set('totp')">
              <span class="material-icons-round">smartphone</span> Authenticator App
            </button>
            <button class="method-tab" [class.active]="method() === 'sms'" (click)="method.set('sms')">
              <span class="material-icons-round">sms</span> SMS Code
            </button>
          </div>

          @if (method() === 'totp') {
            <div class="qr-section fade-in">
              <div class="qr-placeholder">
                <div class="qr-inner">
                  <div class="qr-corners"></div>
                  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                    <rect x="10" y="10" width="30" height="30" rx="3" fill="none" stroke="var(--accent-cyan)" stroke-width="2"/>
                    <rect x="80" y="10" width="30" height="30" rx="3" fill="none" stroke="var(--accent-cyan)" stroke-width="2"/>
                    <rect x="10" y="80" width="30" height="30" rx="3" fill="none" stroke="var(--accent-cyan)" stroke-width="2"/>
                    @for (r of qrDots; track $index) {
                      <rect [attr.x]="r.x" [attr.y]="r.y" width="6" height="6" fill="var(--accent-cyan)" opacity="0.6"/>
                    }
                  </svg>
                  <p class="qr-label">Scan with Google Authenticator</p>
                </div>
              </div>
              <p class="setup-key">
                Manual key: <code>JBSW Y3DP EHPK 3PXP</code>
                <button class="btn btn-secondary btn-sm" (click)="copied.set(true)">
                  <span class="material-icons-round" style="font-size:14px">{{ copied() ? 'check' : 'content_copy' }}</span>
                </button>
              </p>
            </div>
          }

          @if (method() === 'sms') {
            <div class="sms-section fade-in">
              <p class="sms-info">
                <span class="material-icons-round">phone</span>
                Code sent to <strong>+966 5X*** **78</strong>
              </p>
              <button class="resend-btn" [disabled]="resendTimer() > 0">
                @if (resendTimer() > 0) { Resend in {{ resendTimer() }}s }
                @else { Resend Code }
              </button>
            </div>
          }

          <!-- OTP Input -->
          <div class="otp-section">
            <label class="otp-label">Enter verification code</label>
            <div class="otp-inputs">
              @for (i of [0,1,2,3,4,5]; track i) {
                <input
                  class="otp-box"
                  type="text"
                  maxlength="1"
                  inputmode="numeric"
                  [value]="otpDigits()[i]"
                  (input)="onOtpInput($event, i)"
                  (keydown)="onOtpKeydown($event, i)"
                  [class.filled]="otpDigits()[i] !== ''"
                />
              }
            </div>
          </div>

          <!-- Verify button -->
          <button
            class="btn btn-primary btn-lg verify-btn"
            [disabled]="!isComplete()"
            (click)="verify()"
            [class.loading]="verifying()"
          >
            @if (verifying()) {
              <span class="spinner"></span> Verifying...
            } @else {
              <span class="material-icons-round">verified</span> Verify & Continue
            }
          </button>

          @if (error()) {
            <div class="error-banner">
              <span class="material-icons-round">error</span>
              {{ error() }}
            </div>
          }

          <!-- Backup codes -->
          <div class="backup-section">
            <button class="backup-toggle" (click)="showBackup.set(!showBackup())">
              <span class="material-icons-round">key</span>
              Use backup code instead
              <span class="material-icons-round">{{ showBackup() ? 'expand_less' : 'expand_more' }}</span>
            </button>
            @if (showBackup()) {
              <div class="backup-input fade-in">
                <input class="form-control" type="text" placeholder="XXXX-XXXX-XXXX"/>
                <button class="btn btn-secondary">Apply</button>
              </div>
            }
          </div>

          <a routerLink="/auth/login" class="back-link">
            <span class="material-icons-round">arrow_back</span> Back to Sign In
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; background: var(--bg-darkest); display: flex; align-items: center; justify-content: center; position: relative; }
    .auth-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
    .bg-circle { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.08; &.c1 { width: 500px; height: 500px; background: var(--accent-cyan); top: 50%; left: 50%; transform: translate(-50%,-50%); } }

    .twofa-container { position: relative; z-index: 1; width: 440px; }

    .twofa-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-xl); padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      display: flex; flex-direction: column; gap: 24px;
    }

    .twofa-brand { text-align: center; }

    .shield-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: rgba(0,212,255,0.1); border: 2px solid rgba(0,212,255,0.3);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
      .material-icons-round { font-size: 28px; color: var(--accent-cyan); }
    }

    .twofa-brand h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .twofa-brand p  { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

    .method-tabs { display: flex; gap: 8px; }

    .method-tab {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 9px; border-radius: var(--radius-sm);
      background: var(--bg-input); border: 1px solid var(--border);
      color: var(--text-secondary); font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all 0.2s; font-family: inherit;
      .material-icons-round { font-size: 16px; }
      &.active { background: rgba(0,212,255,0.1); border-color: var(--accent-cyan); color: var(--accent-cyan); }
      &:hover:not(.active) { border-color: var(--border-light); color: var(--text-primary); }
    }

    .qr-section { display: flex; flex-direction: column; align-items: center; gap: 12px; }

    .qr-placeholder {
      width: 160px; height: 160px;
      border: 2px solid var(--border); border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-input);
    }

    .qr-inner { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .qr-label { font-size: 10px; color: var(--text-muted); text-align: center; }

    .setup-key {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: var(--text-secondary);
      code { color: var(--accent-cyan); font-family: monospace; }
    }

    .sms-section { display: flex; flex-direction: column; align-items: center; gap: 10px; }

    .sms-info {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: var(--text-secondary);
      .material-icons-round { font-size: 18px; color: var(--accent-teal); }
      strong { color: var(--text-primary); }
    }

    .resend-btn {
      background: none; border: none; color: var(--accent-cyan); font-size: 13px;
      cursor: pointer; font-family: inherit; padding: 0;
      &:disabled { color: var(--text-muted); cursor: default; }
    }

    .otp-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

    .otp-inputs { display: flex; gap: 10px; justify-content: center; margin-top: 10px; }

    .otp-box {
      width: 52px; height: 56px; text-align: center;
      font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums;
      background: var(--bg-input); border: 1.5px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-primary);
      outline: none; transition: all 0.2s; font-family: inherit;
      &:focus { border-color: var(--accent-cyan); box-shadow: 0 0 0 2px rgba(0,212,255,0.15); }
      &.filled { border-color: var(--accent-teal); }
    }

    .verify-btn { width: 100%; justify-content: center; &.loading { opacity: 0.7; } }

    .spinner { width: 16px; height: 16px; border: 2px solid rgba(0,0,0,0.2); border-top-color: var(--bg-darkest); border-radius: 50%; animation: spin 0.7s linear infinite; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 12px; background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3);
      border-radius: var(--radius-sm); font-size: 13px; color: var(--danger);
      .material-icons-round { font-size: 16px; }
    }

    .backup-section { display: flex; flex-direction: column; gap: 10px; }

    .backup-toggle {
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; color: var(--text-secondary);
      font-size: 13px; cursor: pointer; font-family: inherit; padding: 0;
      .material-icons-round { font-size: 16px; }
      &:hover { color: var(--text-primary); }
    }

    .backup-input { display: flex; gap: 10px; }

    .back-link {
      display: flex; align-items: center; gap: 6px; justify-content: center;
      color: var(--text-secondary); text-decoration: none; font-size: 13px;
      .material-icons-round { font-size: 16px; }
      &:hover { color: var(--accent-cyan); }
    }
  `],
})
export class TwoFactorComponent {
  method = signal<'totp' | 'sms'>('totp');
  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  copied = signal(false);
  resendTimer = signal(0);
  showBackup = signal(false);
  verifying = signal(false);
  error = signal('');

  qrDots = Array.from({ length: 18 }, (_, i) => ({
    x: 20 + (i % 6) * 14,
    y: 46 + Math.floor(i / 6) * 14,
  }));

  isComplete() {
    return this.otpDigits().every((d) => d !== '');
  }

  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    const digits = [...this.otpDigits()];
    digits[index] = val;
    this.otpDigits.set(digits);

    if (val && index < 5) {
      const next = input.parentElement?.children[index + 1] as HTMLInputElement;
      next?.focus();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.otpDigits()[index] && index > 0) {
      const input = event.target as HTMLInputElement;
      const prev = input.parentElement?.children[index - 1] as HTMLInputElement;
      prev?.focus();
    }
  }

  verify() {
    this.verifying.set(true);
    this.error.set('');
    setTimeout(() => {
      this.verifying.set(false);
      this.error.set('Invalid code. Please try again.');
    }, 1500);
  }
}
