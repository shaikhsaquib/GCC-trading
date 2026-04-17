import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AdminStats, AdminUser, Paginated, AuditEntry, ApiResponse } from '../core/models/api.models';

export interface UserListFilter {
  status?: string;
  role?:   string;
  search?: string;
  limit?:  number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  getDashboard() {
    return this.http.get<AdminStats>(`${this.base}/dashboard`);
  }

  listUsers(filter: UserListFilter = {}) {
    let params = new HttpParams();
    if (filter.status) params = params.set('status', filter.status);
    if (filter.role)   params = params.set('role',   filter.role);
    if (filter.search) params = params.set('search', filter.search);
    if (filter.limit)  params = params.set('limit',  filter.limit);
    if (filter.offset) params = params.set('offset', filter.offset);
    return this.http.get<Paginated<AdminUser>>(`${this.base}/users`, { params });
  }

  suspendUser(id: string) {
    return this.http.patch<void>(`${this.base}/users/${id}/suspend`, {});
  }

  activateUser(id: string) {
    return this.http.patch<void>(`${this.base}/users/${id}/activate`, {});
  }

  getAuditTrail(filter: { eventType?: string; limit?: number; offset?: number } = {}) {
    let params = new HttpParams()
      .set('limit',  String(filter.limit  ?? 50))
      .set('offset', String(filter.offset ?? 0));
    if (filter.eventType) params = params.set('eventType', filter.eventType);
    return this.http.get<ApiResponse<{ data: AuditEntry[]; total: number }>>(`${this.base}/audit`, { params });
  }

  getDailyReport() {
    return this.http.get<unknown[]>(`${this.base}/reports/daily`);
  }
}
