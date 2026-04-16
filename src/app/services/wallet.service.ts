import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WalletBalance, WalletTransaction, Paginated } from '../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/wallet`;

  getBalance() {
    return this.http.get<WalletBalance>(`${this.base}/balance`);
  }

  getTransactions(limit = 20, offset = 0) {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<Paginated<WalletTransaction>>(`${this.base}/transactions`, { params });
  }

  deposit(amount: number, currency: string, method: string) {
    return this.http.post<{ checkoutUrl: string; transactionId: string }>(
      `${this.base}/deposit`, { amount, currency, method },
    );
  }

  withdraw(amount: number, currency: string, bankName: string, iban: string) {
    return this.http.post<{ requestId: string; requiresApproval: boolean }>(
      `${this.base}/withdraw`, { amount, currency, bankName, iban },
    );
  }
}
