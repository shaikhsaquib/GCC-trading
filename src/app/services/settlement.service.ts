import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../core/models/api.models';

export interface Settlement {
  id:             string;
  tradeId:        string;
  bondName:       string;
  isin:           string;
  side:           string;
  quantity:       number;
  price:          number;
  value:          number;
  buyerId:        string;
  sellerId:       string;
  status:         string;
  tradeDate:      string;
  settlementDate: string;
  failureReason:  string | null;
}

export interface SettlementStats {
  pending:     number;
  processing:  number;
  completed:   number;
  failed:      number;
  totalValue:  number;
}

@Injectable({ providedIn: 'root' })
export class SettlementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/settlements`;

  getAll(status?: string, page = 1, pageSize = 50) {
    let p = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) p = p.set('status', status);
    return this.http.get<ApiResponse<{ items: Settlement[]; stats: SettlementStats; total: number }>>(this.base, { params: p });
  }
}
