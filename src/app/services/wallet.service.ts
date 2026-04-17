import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { WalletBalance, WalletTransaction, ApiResponse } from '../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/wallet`;

  getBalance() {
    return this.http
      .get<ApiResponse<WalletBalance>>(`${this.base}/balance`)
      .pipe(map(res => res.data));
  }

  getTransactions(limit = 20, offset = 0) {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http
      .get<ApiResponse<{ data: WalletTransaction[]; total: number }>>(`${this.base}/transactions`, { params })
      .pipe(map(res => res.data));
  }

  deposit(amount: number, currency: string, method: string) {
    return this.http
      .post<ApiResponse<{ checkoutUrl: string; transactionId: string }>>(
        `${this.base}/deposit`, { amount, currency, method },
      )
      .pipe(map(res => res.data));
  }

  withdraw(amount: number, currency: string, bankName: string, iban: string) {
    return this.http
      .post<ApiResponse<{ requestId: string; requiresApproval: boolean }>>(
        `${this.base}/withdraw`, { amount, currency, bankName, iban },
      )
      .pipe(map(res => res.data));
  }
}
