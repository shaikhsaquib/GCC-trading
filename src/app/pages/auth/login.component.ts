import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  email    = '';
  password = '';
  remember = false;
  showPass = signal(false);
  loading  = this.auth.loading;
  error    = signal<string | null>(null);

  features = [
    { icon: 'security',         text: 'Bank-grade security with 2FA & biometrics' },
    { icon: 'bolt',             text: 'Real-time order matching engine' },
    { icon: 'public',           text: 'Access to 5,000+ GCC & global bonds' },
    { icon: 'account_balance',  text: 'Regulated by SAMA & CMA' },
  ];

  stats = [
    { value: 'SAR 4.2B', label: 'Assets Under Mgmt' },
    { value: '40K+',     label: 'Active Investors' },
    { value: '99.9%',    label: 'Uptime SLA' },
  ];

  onLogin() {
    this.error.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next: res => {
        if ('requires2FA' in res) {
          this.router.navigate(['/auth/2fa'], {
            state: { tempToken: res.tempToken },
          });
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
}
