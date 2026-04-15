import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
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
