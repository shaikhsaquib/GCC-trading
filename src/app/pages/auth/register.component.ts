import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

// ── Static data ───────────────────────────────────────────────────────────────

const NATIONALITIES = [
  { label: 'Saudi Arabian', code: 'SA' },
  { label: 'Emirati (UAE)', code: 'AE' },
  { label: 'Kuwaiti',       code: 'KW' },
  { label: 'Bahraini',      code: 'BH' },
  { label: 'Qatari',        code: 'QA' },
  { label: 'Omani',         code: 'OM' },
  { label: 'Egyptian',      code: 'EG' },
  { label: 'Jordanian',     code: 'JO' },
  { label: 'Lebanese',      code: 'LB' },
  { label: 'Syrian',        code: 'SY' },
  { label: 'Yemeni',        code: 'YE' },
  { label: 'Iraqi',         code: 'IQ' },
  { label: 'Pakistani',     code: 'PK' },
  { label: 'Indian',        code: 'IN' },
  { label: 'Filipino',      code: 'PH' },
  { label: 'Bangladeshi',   code: 'BD' },
  { label: 'Sri Lankan',    code: 'LK' },
  { label: 'Nepalese',      code: 'NP' },
  { label: 'Turkish',       code: 'TR' },
  { label: 'Iranian',       code: 'IR' },
  { label: 'British',       code: 'GB' },
  { label: 'American',      code: 'US' },
  { label: 'French',        code: 'FR' },
  { label: 'German',        code: 'DE' },
];

const CURRENCIES = [
  { label: 'AED — UAE Dirham',     value: 'AED' },
  { label: 'SAR — Saudi Riyal',    value: 'SAR' },
  { label: 'KWD — Kuwaiti Dinar',  value: 'KWD' },
  { label: 'QAR — Qatari Riyal',   value: 'QAR' },
  { label: 'OMR — Omani Rial',     value: 'OMR' },
  { label: 'BHD — Bahraini Dinar', value: 'BHD' },
  { label: 'USD — US Dollar',      value: 'USD' },
];

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  // ── State ─────────────────────────────────────────────────────────────────────
  currentStep  = signal(0);
  submitting   = signal(false);
  serverError  = signal<string | null>(null);
  showPassword = signal(false);
  showConfirm  = signal(false);

  // ── Steps ─────────────────────────────────────────────────────────────────────
  steps = [
    { num: 1, label: 'Personal Info'   },
    { num: 2, label: 'Account Details' },
    { num: 3, label: 'Security'        },
    { num: 4, label: 'Agreement'       },
  ];

  // ── Form model ────────────────────────────────────────────────────────────────
  form = {
    firstName:       '',
    lastName:        '',
    email:           '',
    phone:           '',
    dateOfBirth:     '',
    nationality:     '',
    currency:        'AED',
    accountType:     '',
    password:        '',
    confirmPassword: '',
  };

  accountTypes = [
    { value: 'individual',  icon: 'person',         label: 'Individual',  desc: 'Personal investor' },
    { value: 'corporate',   icon: 'business',        label: 'Corporate',   desc: 'Company account'   },
    { value: 'institution', icon: 'account_balance', label: 'Institution', desc: 'Fund / Bank'       },
  ];

  agreements = [
    { id: 1, title: 'Terms of Service',          desc: 'I agree to the GCC Bond Trading Platform terms and conditions.', checked: false },
    { id: 2, title: 'Risk Disclosure',            desc: 'I acknowledge bond trading carries risk and I have read the risk disclosure document.', checked: false },
    { id: 3, title: 'KYC & AML Policy',          desc: 'I consent to identity verification and AML checks as required by law.', checked: false },
    { id: 4, title: 'Communication Preferences', desc: 'I agree to receive trade confirmations and alerts via email and SMS.', checked: false },
  ];

  readonly nationalities = NATIONALITIES;
  readonly currencies    = CURRENCIES;

  // ── Date constraints (must be 18+) ────────────────────────────────────────────
  readonly maxDOB = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  readonly minDOB = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 100);
    return d.toISOString().split('T')[0];
  })();

  // ── Touched tracking ──────────────────────────────────────────────────────────
  touched: Record<string, boolean> = {};

  touch(field: string) {
    this.touched[field] = true;
  }

  // ── Per-field validators ──────────────────────────────────────────────────────
  private validators: Record<string, () => string | null> = {
    firstName: () => {
      const v = this.form.firstName.trim();
      if (!v)         return 'First name is required';
      if (v.length < 2)  return 'Must be at least 2 characters';
      if (v.length > 50) return 'Must be 50 characters or less';
      return null;
    },
    lastName: () => {
      const v = this.form.lastName.trim();
      if (!v)         return 'Last name is required';
      if (v.length < 2)  return 'Must be at least 2 characters';
      if (v.length > 50) return 'Must be 50 characters or less';
      return null;
    },
    email: () => {
      const v = this.form.email.trim();
      if (!v) return 'Email address is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
      return null;
    },
    phone: () => {
      const v = this.form.phone.trim();
      if (!v) return 'Phone number is required';
      if (!/^\+[1-9]\d{7,14}$/.test(v))
        return 'Use E.164 format, e.g. +971501234567';
      return null;
    },
    dateOfBirth: () => {
      const v = this.form.dateOfBirth;
      if (!v) return 'Date of birth is required';
      const age = this.calcAge(v);
      if (age < 18)  return 'You must be at least 18 years old';
      if (age > 100) return 'Enter a valid date of birth';
      return null;
    },
    nationality: () => {
      if (!this.form.nationality) return 'Nationality is required';
      return null;
    },
    currency: () => {
      if (!this.form.currency) return 'Currency is required';
      return null;
    },
    password: () => {
      const v = this.form.password;
      if (!v)             return 'Password is required';
      if (v.length < 8)   return 'Must be at least 8 characters';
      if (!/[A-Z]/.test(v))        return 'Must contain an uppercase letter';
      if (!/[0-9]/.test(v))        return 'Must contain a number';
      if (!/[^A-Za-z0-9]/.test(v)) return 'Must contain a special character';
      return null;
    },
    confirmPassword: () => {
      if (!this.form.confirmPassword) return 'Please confirm your password';
      if (this.form.confirmPassword !== this.form.password) return 'Passwords do not match';
      return null;
    },
  };

  getError(field: string): string | null {
    return this.validators[field]?.() ?? null;
  }

  showError(field: string): string | null {
    return this.touched[field] ? this.getError(field) : null;
  }

  fieldClass(field: string): string {
    if (!this.touched[field]) return '';
    return this.getError(field) ? 'has-error' : 'has-success';
  }

  // ── Password strength ─────────────────────────────────────────────────────────
  get pwReqs() {
    const p = this.form.password;
    return {
      length:    p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      number:    /[0-9]/.test(p),
      special:   /[^A-Za-z0-9]/.test(p),
    };
  }

  get pwStrength(): number {
    if (!this.form.password) return 0;
    const r = this.pwReqs;
    return [r.length, r.uppercase, r.number, r.special].filter(Boolean).length;
  }

  get pwStrengthLabel(): string {
    return ['', 'Weak', 'Fair', 'Good', 'Strong'][this.pwStrength];
  }

  get pwStrengthColor(): string {
    return ['', '#ff4757', '#ffa502', '#e6c200', '#2ed573'][this.pwStrength];
  }

  // ── Step gating ───────────────────────────────────────────────────────────────
  private stepFields = [
    ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth'],
    ['nationality', 'currency'],
    ['password', 'confirmPassword'],
    [],
  ];

  private validateCurrentStep(): boolean {
    const fields = this.stepFields[this.currentStep()] ?? [];
    fields.forEach(f => (this.touched[f] = true));
    return fields.every(f => this.getError(f) === null);
  }

  next() {
    if (!this.validateCurrentStep()) return;
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update(n => n + 1);
      this.serverError.set(null);
    }
  }

  prev() {
    if (this.currentStep() > 0) {
      this.currentStep.update(n => n - 1);
      this.serverError.set(null);
    }
  }

  allAgreed(): boolean {
    return this.agreements.every(a => a.checked);
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  submit() {
    if (!this.allAgreed()) return;
    this.serverError.set(null);
    this.submitting.set(true);

    this.auth.register({
      email:       this.form.email.trim(),
      password:    this.form.password,
      phone:       this.form.phone.trim(),
      firstName:   this.form.firstName.trim(),
      lastName:    this.form.lastName.trim(),
      nationality: this.form.nationality,
      dateOfBirth: this.form.dateOfBirth,
      currency:    this.form.currency,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/auth/login'], { queryParams: { registered: '1' } });
      },
      error: err => {
        this.submitting.set(false);
        const msg =
          err?.error?.error ??
          err?.error?.message ??
          'Registration failed. Please try again.';
        this.serverError.set(msg);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private calcAge(dob: string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
