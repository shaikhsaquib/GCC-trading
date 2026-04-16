import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PortfolioSummary, PortfolioHolding, ApiResponse } from '../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/portfolio`;

  getSummary() {
    return this.http.get<ApiResponse<PortfolioSummary>>(this.base);
  }

  getHoldings() {
    return this.http.get<ApiResponse<PortfolioHolding[]>>(`${this.base}/holdings`);
  }

  getCouponCalendar() {
    return this.http.get<ApiResponse<unknown[]>>(`${this.base}/coupon-calendar`);
  }
}
