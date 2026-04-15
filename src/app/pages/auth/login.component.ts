import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
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
