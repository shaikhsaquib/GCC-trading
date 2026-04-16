import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse, KycSubmission, KycQueueItem, RiskLevel, DocumentType,
} from '../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class KycService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/kyc`;

  // ── Investor ─────────────────────────────────────────────────────────────────

  getMyStatus() {
    return this.http
      .get<ApiResponse<{ submission: KycSubmission | null }>>(`${this.base}/status`)
      .pipe(map(res => res.data.submission));
  }

  startSubmission() {
    return this.http
      .post<ApiResponse<{ submission: KycSubmission }>>(`${this.base}/start`, {})
      .pipe(map(res => res.data.submission));
  }

  uploadDocument(kycId: string, documentType: DocumentType, file: File) {
    const fd = new FormData();
    fd.append('documentType', documentType);
    fd.append('file', file);
    return this.http
      .post<ApiResponse<{ uploaded: boolean }>>(`${this.base}/${kycId}/documents`, fd)
      .pipe(map(res => res.data));
  }

  submit(kycId: string) {
    return this.http
      .post<ApiResponse<{ submitted: boolean }>>(`${this.base}/${kycId}/submit`, {})
      .pipe(map(res => res.data));
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────

  getQueue(status?: string, limit = 20, offset = 0) {
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('offset', String(offset));
    if (status && status !== 'all') params = params.set('status', status);
    return this.http
      .get<ApiResponse<{ data: KycQueueItem[]; total: number }>>(
        `${this.base}/admin/queue`, { params },
      )
      .pipe(map(res => res.data));
  }

  approve(kycId: string, riskLevel: RiskLevel, reviewNotes?: string) {
    return this.http
      .post<ApiResponse<{ approved: boolean }>>(
        `${this.base}/admin/${kycId}/approve`, { riskLevel, reviewNotes },
      )
      .pipe(map(res => res.data));
  }

  reject(kycId: string, reason: string) {
    return this.http
      .post<ApiResponse<{ rejected: boolean }>>(
        `${this.base}/admin/${kycId}/reject`, { reason },
      )
      .pipe(map(res => res.data));
  }
}
