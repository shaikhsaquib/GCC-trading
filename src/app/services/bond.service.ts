import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Bond, PagedBondResponse, ApiResponse } from '../core/models/api.models';

export interface BondSearchParams {
  search?:   string;
  status?:   string;
  type?:     string;
  page?:     number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class BondService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bonds`;

  search(params: BondSearchParams = {}) {
    let p = new HttpParams();
    if (params.search)   p = p.set('search',   params.search);
    if (params.status)   p = p.set('status',   params.status);
    if (params.type)     p = p.set('type',      params.type);
    if (params.page)     p = p.set('page',      params.page);
    if (params.pageSize) p = p.set('pageSize',  params.pageSize);
    return this.http.get<ApiResponse<PagedBondResponse>>(this.base, { params: p });
  }

  getById(id: string) {
    return this.http.get<ApiResponse<Bond>>(`${this.base}/${id}`);
  }
}
