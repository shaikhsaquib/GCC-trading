import { Component, signal, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

type Stage = 'form' | 'processing' | 'success' | 'cancelled';

@Component({
  selector: 'app-demo-payment',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './demo-payment.component.html',
  styleUrl: './demo-payment.component.css',
})
export class DemoPaymentComponent implements OnInit {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http   = inject(HttpClient);

  stage     = signal<Stage>('form');
  error     = signal<string | null>(null);
  txId      = '';

  // Pre-filled demo card values
  cardNumber = '4242 4242 4242 4242';
  cardName   = 'Demo User';
  cardExpiry = '12/28';
  cardCvv    = '123';

  ngOnInit() {
    this.txId = this.route.snapshot.queryParamMap.get('txId') ?? '';
    if (!this.txId) this.router.navigate(['/wallet']);
  }

  pay() {
    this.stage.set('processing');
    this.error.set(null);

    // Simulate network delay for realism
    setTimeout(() => {
      this.http.post(
        `${environment.apiUrl}/wallet/demo-complete`,
        { transactionId: this.txId },
        { withCredentials: true },
      ).subscribe({
        next: () => this.stage.set('success'),
        error: (err) => {
          this.stage.set('form');
          this.error.set(err?.error?.error?.message ?? 'Payment failed. Please try again.');
        },
      });
    }, 1800);
  }

  cancel() {
    this.stage.set('cancelled');
    setTimeout(() => this.router.navigate(['/wallet']), 2000);
  }

  goToWallet() {
    this.router.navigate(['/wallet']);
  }

  formatCardNumber(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    this.cardNumber = digits.replace(/(.{4})/g, '$1 ').trim();
  }

  formatExpiry(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      this.cardExpiry = digits.slice(0, 2) + '/' + digits.slice(2);
    } else {
      this.cardExpiry = digits;
    }
  }
}
