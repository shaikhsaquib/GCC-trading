import { Component, signal, ElementRef, ViewChildren, QueryList, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-two-factor',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass],
  templateUrl: './two-factor.component.html',
  styleUrl: './two-factor.component.css',
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
