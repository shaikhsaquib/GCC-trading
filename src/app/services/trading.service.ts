import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Order, OrderBookResponse, ApiResponse, Paginated } from '../core/models/api.models';

export interface PlaceOrderDto {
  bondId:    string;
  side:      'Buy' | 'Sell';
  orderType: 'Market' | 'Limit';
  quantity:  number;
  price?:    number;
}

@Injectable({ providedIn: 'root' })
export class TradingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/orders`;

  placeOrder(dto: PlaceOrderDto) {
    return this.http.post<ApiResponse<Order>>(this.base, dto);
  }

  getMyOrders(status?: string, limit = 20, offset = 0) {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<Order[]>>(this.base, { params });
  }

  cancelOrder(id: string) {
    return this.http.delete<ApiResponse<Order>>(`${this.base}/${id}`);
  }

  getOrderBook(bondId: string, depth = 20) {
    const params = new HttpParams().set('depth', depth);
    return this.http.get<ApiResponse<OrderBookResponse>>(
      `${this.base}/book/${bondId}`, { params },
    );
  }
}
