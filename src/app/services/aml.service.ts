import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AmlAlert, ApiResponse } from '../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class AmlService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/aml`;

  getAlerts(status?: string, limit = 50, offset = 0) {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<AmlAlert[]>>(`${this.base}/alerts`, { params });
  }

  updateAlert(id: string, status: string, sarRef?: string) {
    return this.http.patch<void>(`${this.base}/alerts/${id}`, { status, sarRef });
  }
}
