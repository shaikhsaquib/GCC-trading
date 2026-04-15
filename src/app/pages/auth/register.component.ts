import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  template: `
    <div class="auth-page register-page">
      <div class="auth-bg">
        <div class="bg-circle c1"></div>
        <div class="bg-circle c2"></div>
      </div>

      <div class="register-container">
        <!-- Header -->
        <div class="reg-header">
          <div class="brand-mini">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#rg1)"/>
              <path d="M8 20V12l8-4 8 4v8l-8 4-8-4z" fill="none" stroke="white" stroke-width="1.5"/>
              <path d="M8 12l8 4 8-4M16 16v8" stroke="white" stroke-width="1.5"/>
              <defs><linearGradient id="rg1" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#00d4ff"/><stop offset="1" stop-color="#17c3b2"/></linearGradient></defs>
            </svg>
            <span>GCC Bond Trading</span>
          </div>
          <a routerLink="/auth/login" class="btn btn-secondary btn-sm">
            <span class="material-icons-round" style="font-size:16px">login</span> Sign In
          </a>
        </div>

        <!-- Steps indicator -->
        <div class="steps-bar">
          @for (step of steps; track step.num; let i = $index) {
            <div class="step-item" [class.active]="currentStep() === i" [class.done]="currentStep() > i">
              <div class="step-num">
                @if (currentStep() > i) {
                  <span class="material-icons-round" style="font-size:14px">check</span>
                } @else {
                  {{ step.num }}
                }
              </div>
              <span class="step-label">{{ step.label }}</span>
            </div>
            @if (i < steps.length - 1) {
              <div class="step-connector" [class.done]="currentStep() > i"></div>
            }
          }
        </div>

        <div class="reg-card">
          <!-- Step 1: Personal Info -->
          @if (currentStep() === 0) {
            <div class="step-content fade-in">
              <h3>Personal Information</h3>
              <p class="step-desc">Tell us about yourself</p>
              <div class="form-grid">
                <div class="form-group">
                  <label>First Name</label>
                  <input class="form-control" type="text" placeholder="Mohammed" [(ngModel)]="form.firstName" name="fn"/>
                </div>
                <div class="form-group">
                  <label>Last Name</label>
                  <input class="form-control" type="text" placeholder="Al-Rashid" [(ngModel)]="form.lastName" name="ln"/>
                </div>
                <div class="form-group" style="grid-column: 1/-1">
                  <label>Email Address</label>
                  <input class="form-control" type="email" placeholder="mohammed@example.com" [(ngModel)]="form.email" name="em"/>
                </div>
                <div class="form-group">
                  <label>Phone Number</label>
                  <input class="form-control" type="tel" placeholder="+966 5X XXX XXXX" [(ngModel)]="form.phone" name="ph"/>
                </div>
                <div class="form-group">
                  <label>Nationality</label>
                  <select class="form-control form-select" [(ngModel)]="form.nationality" name="nat">
                    <option value="">Select nationality</option>
                    <option>Saudi Arabian</option>
                    <option>Emirati</option>
                    <option>Kuwaiti</option>
                    <option>Bahraini</option>
                    <option>Qatari</option>
                    <option>Omani</option>
                    <option>Other</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column: 1/-1">
                  <label>National ID / Iqama Number</label>
                  <input class="form-control" type="text" placeholder="1XXXXXXXXX" [(ngModel)]="form.nationalId" name="nid"/>
                </div>
              </div>
            </div>
          }

          <!-- Step 2: Account Setup -->
          @if (currentStep() === 1) {
            <div class="step-content fade-in">
              <h3>Account Setup</h3>
              <p class="step-desc">Configure your trading account</p>
              <div class="form-grid">
                <div class="form-group" style="grid-column: 1/-1">
                  <label>Password</label>
                  <input class="form-control" type="password" placeholder="Min. 8 chars, upper, lower, number" [(ngModel)]="form.password" name="pw"/>
                </div>
                <div class="form-group" style="grid-column: 1/-1">
                  <label>Confirm Password</label>
                  <input class="form-control" type="password" placeholder="Repeat password" [(ngModel)]="form.confirmPassword" name="cpw"/>
                </div>
                <div class="form-group" style="grid-column: 1/-1">
                  <label>Account Type</label>
                  <div class="acc-type-grid">
                    @for (type of accountTypes; track type.value) {
                      <div class="acc-type-card" [class.selected]="form.accountType === type.value" (click)="form.accountType = type.value">
                        <span class="material-icons-round" style="font-size:24px; color: var(--accent-cyan)">{{ type.icon }}</span>
                        <strong>{{ type.label }}</strong>
                        <small>{{ type.desc }}</small>
                      </div>
                    }
                  </div>
                </div>
                <div class="form-group" style="grid-column: 1/-1">
                  <label>Investment Experience</label>
                  <select class="form-control form-select" [(ngModel)]="form.experience" name="exp">
                    <option value="">Select experience level</option>
                    <option>Beginner (0-2 years)</option>
                    <option>Intermediate (2-5 years)</option>
                    <option>Advanced (5-10 years)</option>
                    <option>Professional (10+ years)</option>
                  </select>
                </div>
              </div>
            </div>
          }

          <!-- Step 3: KYC Docs -->
          @if (currentStep() === 2) {
            <div class="step-content fade-in">
              <h3>Identity Verification</h3>
              <p class="step-desc">Upload your documents to complete KYC</p>
              <div class="doc-upload-grid">
                @for (doc of docUploads; track doc.type) {
                  <div class="doc-upload-card" [class.uploaded]="doc.uploaded">
                    <span class="material-icons-round doc-icon">{{ doc.uploaded ? 'check_circle' : doc.icon }}</span>
                    <strong>{{ doc.label }}</strong>
                    <small>{{ doc.desc }}</small>
                    <button class="btn btn-secondary btn-sm" (click)="doc.uploaded = !doc.uploaded">
                      {{ doc.uploaded ? 'Change File' : 'Upload' }}
                    </button>
                  </div>
                }
              </div>
              <div class="kyc-note">
                <span class="material-icons-round">info</span>
                Documents are encrypted and securely stored. Verified within 24 hours.
              </div>
            </div>
          }

          <!-- Step 4: Agreement -->
          @if (currentStep() === 3) {
            <div class="step-content fade-in">
              <h3>Terms & Agreements</h3>
              <p class="step-desc">Review and accept to proceed</p>
              <div class="agreement-list">
                @for (agree of agreements; track agree.id) {
                  <label class="agree-item">
                    <input type="checkbox" [(ngModel)]="agree.checked" [name]="'agree' + agree.id" style="accent-color: var(--accent-cyan); width:16px; height:16px;"/>
                    <div>
                      <strong>{{ agree.title }}</strong>
                      <p>{{ agree.desc }}</p>
                    </div>
                  </label>
                }
              </div>
            </div>
          }

          <!-- Navigation -->
          <div class="step-nav">
            @if (currentStep() > 0) {
              <button class="btn btn-secondary" (click)="prev()">
                <span class="material-icons-round">chevron_left</span> Back
              </button>
            } @else {
              <div></div>
            }
            @if (currentStep() < steps.length - 1) {
              <button class="btn btn-primary" (click)="next()">
                Next <span class="material-icons-round">chevron_right</span>
              </button>
            } @else {
              <button class="btn btn-primary" (click)="submit()">
                <span class="material-icons-round">check</span> Create Account
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; background: var(--bg-darkest); overflow-y: auto; position: relative; }
    .auth-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
    .bg-circle {
      position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.06;
      &.c1 { width: 600px; height: 600px; background: var(--accent-cyan); top: -200px; left: -200px; }
      &.c2 { width: 400px; height: 400px; background: var(--accent-purple); bottom: -100px; right: -100px; }
    }

    .register-container { max-width: 760px; margin: 0 auto; padding: 32px 24px 60px; position: relative; z-index: 1; }

    .reg-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 40px;
    }

    .brand-mini {
      display: flex; align-items: center; gap: 10px;
      span { font-size: 16px; font-weight: 700; color: var(--text-primary); }
    }

    .steps-bar {
      display: flex; align-items: center; gap: 0; margin-bottom: 32px;
    }

    .step-item {
      display: flex; align-items: center; gap: 8px;
      &.active .step-num { background: var(--accent-cyan); color: var(--bg-darkest); }
      &.done .step-num { background: var(--success); color: var(--bg-darkest); }
    }

    .step-num {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--bg-surface); color: var(--text-secondary);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0;
      transition: all 0.3s;
    }

    .step-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); white-space: nowrap; }
    .step-item.active .step-label { color: var(--accent-cyan); }
    .step-item.done .step-label  { color: var(--success); }

    .step-connector { flex: 1; height: 1px; background: var(--border); margin: 0 12px; &.done { background: var(--success); } }

    .reg-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 36px; }

    .step-content h3 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
    .step-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 28px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    .acc-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

    .acc-type-card {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 16px; border-radius: var(--radius-md);
      border: 1px solid var(--border); background: var(--bg-input);
      cursor: pointer; text-align: center; transition: all 0.2s;
      strong { font-size: 13px; } small { font-size: 11px; color: var(--text-secondary); }
      &.selected { border-color: var(--accent-cyan); background: rgba(0,212,255,0.06); }
      &:hover:not(.selected) { border-color: var(--border-light); }
    }

    .doc-upload-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }

    .doc-upload-card {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 24px 16px; border-radius: var(--radius-md);
      border: 1px dashed var(--border); background: var(--bg-input);
      text-align: center; transition: all 0.2s;
      strong { font-size: 13px; } small { font-size: 11px; color: var(--text-secondary); }
      &.uploaded { border-color: var(--success); border-style: solid; .doc-icon { color: var(--success); } }
      .doc-icon { font-size: 32px; color: var(--text-muted); }
    }

    .kyc-note {
      display: flex; align-items: center; gap: 8px;
      padding: 12px; background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.15);
      border-radius: var(--radius-sm); font-size: 12px; color: var(--text-secondary);
      .material-icons-round { font-size: 16px; color: var(--accent-cyan); }
    }

    .agreement-list { display: flex; flex-direction: column; gap: 16px; }

    .agree-item {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 16px; border-radius: var(--radius-md);
      border: 1px solid var(--border); background: var(--bg-input);
      cursor: pointer; transition: border-color 0.2s;
      strong { font-size: 13px; font-weight: 600; display: block; margin-bottom: 4px; }
      p { font-size: 12px; color: var(--text-secondary); }
      &:hover { border-color: var(--border-light); }
    }

    .step-nav { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border); }
  `],
})
export class RegisterComponent {
  currentStep = signal(0);

  steps = [
    { num: 1, label: 'Personal Info' },
    { num: 2, label: 'Account Setup' },
    { num: 3, label: 'KYC Docs' },
    { num: 4, label: 'Agreement' },
  ];

  form = {
    firstName: '', lastName: '', email: '', phone: '',
    nationality: '', nationalId: '',
    password: '', confirmPassword: '',
    accountType: 'individual', experience: '',
  };

  accountTypes = [
    { value: 'individual', icon: 'person', label: 'Individual', desc: 'Personal investor' },
    { value: 'corporate', icon: 'business', label: 'Corporate', desc: 'Company account' },
    { value: 'institution', icon: 'account_balance', label: 'Institution', desc: 'Fund / Bank' },
  ];

  docUploads = [
    { type: 'id', icon: 'badge', label: 'National ID / Iqama', desc: 'Front & back sides', uploaded: false },
    { type: 'selfie', icon: 'face', label: 'Selfie with ID', desc: 'Clear face photo', uploaded: false },
    { type: 'bank', icon: 'account_balance', label: 'Bank Statement', desc: 'Last 3 months', uploaded: false },
  ];

  agreements = [
    { id: 1, title: 'Terms of Service', desc: 'I agree to the GCC Bond Trading Platform terms and conditions governing use of the service.', checked: false },
    { id: 2, title: 'Risk Disclosure', desc: 'I acknowledge bond trading carries risk and I have read the risk disclosure document.', checked: false },
    { id: 3, title: 'KYC & AML Policy', desc: 'I consent to identity verification and anti-money laundering checks as required by law.', checked: false },
    { id: 4, title: 'Communication Preferences', desc: 'I agree to receive trade confirmations, alerts and platform updates via email and SMS.', checked: false },
  ];

  next() { if (this.currentStep() < this.steps.length - 1) this.currentStep.update(n => n + 1); }
  prev() { if (this.currentStep() > 0) this.currentStep.update(n => n - 1); }
  submit() { console.log('Form submitted', this.form); }
}
