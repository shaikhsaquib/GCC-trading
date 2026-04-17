import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Notification } from '../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  getAll(limit = 20, offset = 0) {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<Notification[]>(this.base + '/', { params });
  }

  markRead(id: string) {
    return this.http.patch<void>(`${this.base}/${id}/read`, {});
  }

  markAllRead() {
    return this.http.patch<void>(`${this.base}/read-all`, {});
  }
}
