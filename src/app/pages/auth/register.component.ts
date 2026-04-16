import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

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

  currentStep = signal(0);
  submitting  = signal(false);
  error       = signal<string | null>(null);

  steps = [
    { num: 1, label: 'Personal Info' },
    { num: 2, label: 'Account Setup' },
    { num: 3, label: 'KYC Docs' },
    { num: 4, label: 'Agreement' },
  ];

  form = {
    firstName: '', lastName: '', email: '', phone: '',
    nationality: '', dateOfBirth: '',
    password: '', confirmPassword: '',
    currency: 'AED',
  };

  accountTypes = [
    { value: 'individual', icon: 'person',          label: 'Individual',  desc: 'Personal investor' },
    { value: 'corporate',  icon: 'business',         label: 'Corporate',   desc: 'Company account' },
    { value: 'institution',icon: 'account_balance',  label: 'Institution', desc: 'Fund / Bank' },
  ];

  docUploads = [
    { type: 'id',     icon: 'badge',            label: 'National ID / Iqama', desc: 'Front & back sides', uploaded: false },
    { type: 'selfie', icon: 'face',             label: 'Selfie with ID',      desc: 'Clear face photo',   uploaded: false },
    { type: 'bank',   icon: 'account_balance',  label: 'Bank Statement',      desc: 'Last 3 months',      uploaded: false },
  ];

  agreements = [
    { id: 1, title: 'Terms of Service',          desc: 'I agree to the GCC Bond Trading Platform terms and conditions.', checked: false },
    { id: 2, title: 'Risk Disclosure',            desc: 'I acknowledge bond trading carries risk and I have read the risk disclosure document.', checked: false },
    { id: 3, title: 'KYC & AML Policy',          desc: 'I consent to identity verification and AML checks as required by law.', checked: false },
    { id: 4, title: 'Communication Preferences', desc: 'I agree to receive trade confirmations and alerts via email and SMS.', checked: false },
  ];

  next() { if (this.currentStep() < this.steps.length - 1) this.currentStep.update(n => n + 1); }
  prev() { if (this.currentStep() > 0) this.currentStep.update(n => n - 1); }

  submit() {
    this.error.set(null);
    if (this.form.password !== this.form.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }
    this.submitting.set(true);
    this.auth.register({
      email:       this.form.email,
      password:    this.form.password,
      phone:       this.form.phone,
      firstName:   this.form.firstName,
      lastName:    this.form.lastName,
      nationality: this.form.nationality,
      dateOfBirth: this.form.dateOfBirth,
      currency:    this.form.currency,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/auth/login'], {
          queryParams: { registered: '1' },
        });
      },
      error: err => {
        this.submitting.set(false);
        const msg = err?.error?.error ?? err?.error?.message ?? 'Registration failed. Please try again.';
        this.error.set(msg);
      },
    });
  }
}
