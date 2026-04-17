import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { WalletBalance, WalletTransaction, ApiResponse } from '../core/models/api.models';

const uid  = () => Math.random().toString(36).slice(2, 10).toUpperCase();
const ago  = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const DEMO_BALANCE: WalletBalance = {
  balance:          285_000,
  availableBalance: 250_000,
  frozenBalance:     35_000,
  currency: 'SAR',
};

const DEMO_TRANSACTIONS: WalletTransaction[] = [
  { id: '1',  type: 'CREDIT',            amount: '100000', currency: 'SAR', status: 'COMPLETED',  description: 'Bank Transfer Deposit — Al Rajhi Bank',      reference_id: 'DEP-'+uid(), idempotency_key: uid(), created_at: ago(1)  },
  { id: '2',  type: 'SETTLEMENT_DEBIT',  amount: '98520',  currency: 'SAR', status: 'COMPLETED',  description: 'Bond Purchase — SABIC 4.5% 2029',           reference_id: 'TRD-'+uid(), idempotency_key: uid(), created_at: ago(2)  },
  { id: '3',  type: 'COUPON',            amount: '2250',   currency: 'SAR', status: 'COMPLETED',  description: 'Coupon Payment — Saudi Aramco 3.5% 2027',   reference_id: 'CPN-'+uid(), idempotency_key: uid(), created_at: ago(4)  },
  { id: '4',  type: 'SETTLEMENT_CREDIT', amount: '52430',  currency: 'SAR', status: 'COMPLETED',  description: 'Bond Sale — NCB Capital 5.25% 2026',        reference_id: 'TRD-'+uid(), idempotency_key: uid(), created_at: ago(5)  },
  { id: '5',  type: 'FREEZE',            amount: '35000',  currency: 'SAR', status: 'COMPLETED',  description: 'Order Reserve — KSA Government Bond 2030',  reference_id: 'FRZ-'+uid(), idempotency_key: uid(), created_at: ago(6)  },
  { id: '6',  type: 'CREDIT',            amount: '50000',  currency: 'SAR', status: 'COMPLETED',  description: 'STC Pay Deposit',                           reference_id: 'DEP-'+uid(), idempotency_key: uid(), created_at: ago(8)  },
  { id: '7',  type: 'COUPON',            amount: '3125',   currency: 'SAR', status: 'COMPLETED',  description: 'Coupon Payment — SABIC Bond 4.5% 2029',     reference_id: 'CPN-'+uid(), idempotency_key: uid(), created_at: ago(10) },
  { id: '8',  type: 'DEBIT',             amount: '20000',  currency: 'SAR', status: 'COMPLETED',  description: 'Withdrawal — Riyad Bank',                   reference_id: 'WDR-'+uid(), idempotency_key: uid(), created_at: ago(12) },
  { id: '9',  type: 'SETTLEMENT_DEBIT',  amount: '150000', currency: 'SAR', status: 'COMPLETED',  description: 'Bond Purchase — KSA Sukuk 3.75% 2031',      reference_id: 'TRD-'+uid(), idempotency_key: uid(), created_at: ago(14) },
  { id: '10', type: 'CREDIT',            amount: '200000', currency: 'SAR', status: 'COMPLETED',  description: 'Bank Transfer Deposit — Riyad Bank',         reference_id: 'DEP-'+uid(), idempotency_key: uid(), created_at: ago(15) },
  { id: '11', type: 'COUPON',            amount: '1875',   currency: 'SAR', status: 'COMPLETED',  description: 'Coupon Payment — Dubai Ports 4.0% 2028',    reference_id: 'CPN-'+uid(), idempotency_key: uid(), created_at: ago(17) },
  { id: '12', type: 'SETTLEMENT_CREDIT', amount: '78200',  currency: 'SAR', status: 'COMPLETED',  description: 'Bond Maturity — Emirates 3.9% 2024',        reference_id: 'TRD-'+uid(), idempotency_key: uid(), created_at: ago(18) },
  { id: '13', type: 'DEBIT',             amount: '30000',  currency: 'SAR', status: 'PROCESSING', description: 'Withdrawal — Al Rajhi Bank',                reference_id: 'WDR-'+uid(), idempotency_key: uid(), created_at: ago(19) },
  { id: '14', type: 'SETTLEMENT_DEBIT',  amount: '75000',  currency: 'SAR', status: 'COMPLETED',  description: 'Bond Purchase — ADQ 5.1% 2033',             reference_id: 'TRD-'+uid(), idempotency_key: uid(), created_at: ago(21) },
  { id: '15', type: 'CREDIT',            amount: '75000',  currency: 'SAR', status: 'COMPLETED',  description: 'Mada Card Deposit',                         reference_id: 'DEP-'+uid(), idempotency_key: uid(), created_at: ago(22) },
  { id: '16', type: 'COUPON',            amount: '4500',   currency: 'SAR', status: 'COMPLETED',  description: 'Coupon Payment — KSA Sovereign 5% 2030',    reference_id: 'CPN-'+uid(), idempotency_key: uid(), created_at: ago(24) },
  { id: '17', type: 'SETTLEMENT_CREDIT', amount: '105000', currency: 'SAR', status: 'COMPLETED',  description: 'Bond Sale — Aramco Bond 4.25% 2029',        reference_id: 'TRD-'+uid(), idempotency_key: uid(), created_at: ago(25) },
  { id: '18', type: 'DEBIT',             amount: '50000',  currency: 'SAR', status: 'FAILED',     description: 'Withdrawal — Al Rajhi Bank (failed)',        reference_id: 'WDR-'+uid(), idempotency_key: uid(), created_at: ago(27) },
  { id: '19', type: 'CREDIT',            amount: '500000', currency: 'SAR', status: 'COMPLETED',  description: 'Initial Deposit — Al Rajhi Bank',            reference_id: 'DEP-'+uid(), idempotency_key: uid(), created_at: ago(29) },
  { id: '20', type: 'SETTLEMENT_DEBIT',  amount: '250000', currency: 'SAR', status: 'COMPLETED',  description: 'Bond Purchase — NCB Sukuk 3.8% 2030',        reference_id: 'TRD-'+uid(), idempotency_key: uid(), created_at: ago(30) },
];

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/wallet`;

  getBalance() {
    return this.http
      .get<ApiResponse<WalletBalance>>(`${this.base}/balance`)
      .pipe(
        map(res => res.data),
        catchError(() => of(DEMO_BALANCE)),
      );
  }

  getTransactions(limit = 20, offset = 0) {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http
      .get<ApiResponse<{ data: WalletTransaction[]; total: number }>>(`${this.base}/transactions`, { params })
      .pipe(
        map(res => res.data),
        catchError(() => of({
          data:  DEMO_TRANSACTIONS.slice(offset, offset + limit),
          total: DEMO_TRANSACTIONS.length,
        })),
      );
  }

  deposit(amount: number, currency: string, method: string) {
    return this.http
      .post<ApiResponse<{ checkoutUrl: string; transactionId: string }>>(
        `${this.base}/deposit`, { amount, currency, method },
      )
      .pipe(
        map(res => res.data),
        catchError(() => of({ checkoutUrl: '', transactionId: 'DEMO-' + Date.now() })),
      );
  }

  withdraw(amount: number, currency: string, bankName: string, iban: string) {
    return this.http
      .post<ApiResponse<{ requestId: string; requiresApproval: boolean }>>(
        `${this.base}/withdraw`, { amount, currency, bankName, iban },
      )
      .pipe(
        map(res => res.data),
        catchError(() => of({ requestId: 'DEMO-' + Date.now(), requiresApproval: true })),
      );
  }

  transfer(recipientId: string, amount: number, note: string) {
    return this.http
      .post<ApiResponse<{ transferId: string }>>(
        `${this.base}/transfer`, { recipientId, amount, note },
      )
      .pipe(
        map(res => res.data),
        catchError(() => of({ transferId: 'DEMO-TRF-' + Date.now() })),
      );
  }
}
