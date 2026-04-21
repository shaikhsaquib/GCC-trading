import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AdminStats, AdminUser, Paginated, AuditEntry, ApiResponse } from '../core/models/api.models';

export interface UserListFilter {
  status?: string;
  role?:   string;
  search?: string;
  limit?:  number;
  offset?: number;
}

export interface SchedulerJob {
  name:           string;
  schedule:       string;
  description:    string;
  lastRunAt:      string | null;
  lastStatus:     'success' | 'failed' | null;
  lastDurationMs: number | null;
  runsToday:      number;
}

export interface ServiceHealth {
  status:    string;
  timestamp: string;
  services:  { postgresql: boolean; redis: boolean; mongodb: boolean };
}

export interface DailyReportRow {
  trade_date:     string;
  trade_count:    string;
  trade_volume:   string;
  total_fees:     string;
  unique_buyers:  string;
  unique_sellers: string;
}

type Wrapped<T> = { success: boolean; data: T };

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;
  // Strip /api/vN suffix to reach the root health endpoint (e.g. /health)
  private readonly apiRoot = environment.apiUrl.replace(/\/api\/v\d+$/, '');

  getDashboard() {
    return this.http
      .get<Wrapped<AdminStats>>(`${this.base}/dashboard`)
      .pipe(map(res => res.data));
  }

  listUsers(filter: UserListFilter = {}) {
    let params = new HttpParams();
    if (filter.status) params = params.set('status', filter.status);
    if (filter.role)   params = params.set('role',   filter.role);
    if (filter.search) params = params.set('search', filter.search);
    if (filter.limit)  params = params.set('limit',  filter.limit);
    if (filter.offset) params = params.set('offset', filter.offset);
    return this.http
      .get<Wrapped<Paginated<AdminUser>>>(`${this.base}/users`, { params })
      .pipe(map(res => res.data));
  }

  suspendUser(id: string) {
    return this.http.patch<void>(`${this.base}/users/${id}/suspend`, {});
  }

  activateUser(id: string) {
    return this.http.patch<void>(`${this.base}/users/${id}/activate`, {});
  }

  getAuditTrail(filter: { actorId?: string; eventType?: string; limit?: number; offset?: number } = {}) {
    let params = new HttpParams()
      .set('limit',  String(filter.limit  ?? 50))
      .set('offset', String(filter.offset ?? 0));
    if (filter.eventType) params = params.set('eventType', filter.eventType);
    if (filter.actorId)   params = params.set('actorId',   filter.actorId);
    return this.http.get<ApiResponse<{ data: AuditEntry[]; total: number }>>(`${this.base}/audit`, { params });
  }

  getDailyReport() {
    return this.http
      .get<Wrapped<DailyReportRow[]>>(`${this.base}/reports/daily`)
      .pipe(map(res => res.data));
  }

  getSchedulerJobs() {
    return this.http
      .get<ApiResponse<SchedulerJob[]>>(`${this.base}/scheduler/jobs`)
      .pipe(map(res => res.data));
  }

  getServiceHealth() {
    return this.http.get<ServiceHealth>(`${this.apiRoot}/health`);
  }
}
