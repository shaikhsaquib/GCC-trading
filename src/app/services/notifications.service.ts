import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Notification, ApiResponse } from '../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  getAll(limit = 20, offset = 0) {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<ApiResponse<Notification[]>>(this.base + '/', { params })
      .pipe(map(res => res.data ?? []));
  }

  markRead(id: string) {
    return this.http.patch<void>(`${this.base}/${id}/read`, {});
  }

  markAllRead() {
    return this.http.patch<void>(`${this.base}/read-all`, {});
  }
}
