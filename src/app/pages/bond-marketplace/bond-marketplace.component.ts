import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BondService } from '../../services/bond.service';
import { Bond } from '../../core/models/api.models';

interface BondDisplay {
  id:           string;
  name:         string;
  issuer:       string;
  isin:         string;
  type:         string;
  typeColor:    string;
  rating:       string;
  coupon:       number;
  maturityRaw:  string;
  maturity:     string;
  faceValue:    number;
  minInvest:    number;
  shariah:      boolean;
  price:        string;
  priceNum:     number;
  ytm:          number;
  volume:       string;
}

@Component({
  selector: 'app-bond-marketplace',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './bond-marketplace.component.html',
  styleUrl: './bond-marketplace.component.css',
})
export class BondMarketplaceComponent implements OnInit {
  private readonly bondSvc = inject(BondService);

  viewMode      = signal<'table' | 'grid'>('table');
  searchTerm    = '';
  sortBy        = 'yield';
  minCoupon     = null as number | null;
  maxCoupon     = null as number | null;
  selectedBond  = signal<BondDisplay | null>(null);
  compareList   = signal<string[]>([]);
  activeRatings = signal<string[]>([]);
  activeTypes   = signal<string[]>([]);

  loading = signal(true);
  error   = signal<string | null>(null);

  bondTypes = ['Government', 'Corporate', 'Sukuk'];
  ratings   = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB'];
  maturities = [
    { label: '< 1 year',   max: 1,   min: 0  },
    { label: '1–3 years',  max: 3,   min: 1  },
    { label: '3–5 years',  max: 5,   min: 3  },
    { label: '5–10 years', max: 10,  min: 5  },
    { label: '> 10 years', max: 999, min: 10 },
  ];
  activeMaturities = signal<string[]>(['< 1 year', '1–3 years', '3–5 years', '5–10 years', '> 10 years']);

  marketStats = [
    { label: 'Total Bonds',   value: '—', sub: 'listed' },
    { label: 'Avg YTM',       value: '—', sub: 'yield to maturity' },
    { label: 'Avg Coupon',    value: '—', sub: 'annual rate' },
    { label: 'Sharia-Comp.',  value: '—', sub: 'sukuk & compliant' },
  ];

  private _bonds = signal<BondDisplay[]>([]);

  get bonds() { return this._bonds(); }

  ngOnInit() { this.loadBonds(); }

  private loadBonds() {
    this.bondSvc.search({ page: 1, pageSize: 100 }).subscribe({
      next: res => {
        this.loading.set(false);
        const items = res.data?.items ?? [];
        this._bonds.set(items.map(b => this.mapBond(b)));
        this.updateMarketStats(items);
      },
      error: () => this.loading.set(false),
    });
  }

  private mapBond(b: Bond): BondDisplay {
    const type = b.isShariaCompliant ? 'Sukuk' : b.issuerType;
    const typeColorMap: Record<string, string> = {
      Government: '#00d4ff', Corporate: '#7c4dff', Sukuk: '#17c3b2',
    };
    const price    = b.currentPrice ?? 100;
    const ytm      = this.calcYtm(b.couponRate, price, b.maturityDate);
    const volume   = this.simVolume(b);
    return {
      id:          b.id,
      name:        b.name,
      issuer:      b.issuerName,
      isin:        b.isin,
      type,
      typeColor:   typeColorMap[type] ?? '#00d4ff',
      rating:      b.creditRating,
      coupon:      b.couponRate,
      maturityRaw: b.maturityDate,
      maturity:    new Date(b.maturityDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      faceValue:   b.faceValue,
      minInvest:   b.minInvestment,
      shariah:     b.isShariaCompliant,
      price:       price.toFixed(2),
      priceNum:    price,
      ytm,
      volume,
    };
  }

  private calcYtm(couponRate: number, price: number, maturityDate: string): number {
    const yearsLeft = Math.max(0.1,
      (new Date(maturityDate).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    const F   = 100;
    const C   = couponRate;          // annual coupon (% of face value 100)
    const P   = price;
    const ytm = ((C + (F - P) / yearsLeft) / ((F + P) / 2)) * 100;
    return +Math.max(0, ytm).toFixed(2);
  }

  private simVolume(b: Bond): string {
    const seed = b.isin.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const m    = ((seed % 90) + 10);          // 10 – 100
    const unit = m >= 100 ? `${(m / 100).toFixed(1)}B` : `${m}M`;
    return `SAR ${unit}`;
  }

  private updateMarketStats(bonds: Bond[]) {
    if (!bonds.length) return;
    const mapped      = this._bonds();
    const avgYtm      = (mapped.reduce((s, b) => s + b.ytm,    0) / mapped.length).toFixed(2);
    const avgCoupon   = (bonds.reduce((s,  b) => s + b.couponRate, 0) / bonds.length).toFixed(2);
    const shariahCount= bonds.filter(b => b.isShariaCompliant).length;
    this.marketStats  = [
      { label: 'Total Bonds',  value: bonds.length.toString(),  sub: 'active listings' },
      { label: 'Avg YTM',      value: `${avgYtm}%`,             sub: 'yield to maturity' },
      { label: 'Avg Coupon',   value: `${avgCoupon}%`,          sub: 'annual coupon rate' },
      { label: 'Sharia-Comp.', value: shariahCount.toString(),  sub: 'sukuk / compliant' },
    ];
  }

  filteredBonds(): BondDisplay[] {
    const term      = this.searchTerm.toLowerCase();
    const ratings   = this.activeRatings();
    const types     = this.activeTypes();
    const mats      = this.activeMaturities();
    const minC      = this.minCoupon;
    const maxC      = this.maxCoupon;
    const now       = Date.now();

    let list = this._bonds().filter(b => {
      if (term && !b.name.toLowerCase().includes(term) &&
                  !b.isin.toLowerCase().includes(term) &&
                  !b.issuer.toLowerCase().includes(term)) return false;
      if (ratings.length && !ratings.includes(b.rating))    return false;
      if (types.length   && !types.includes(b.type))        return false;
      if (minC != null   && b.coupon < minC)                 return false;
      if (maxC != null   && b.coupon > maxC)                 return false;
      if (mats.length) {
        const yrs = (new Date(b.maturityRaw).getTime() - now) / (365.25 * 24 * 60 * 60 * 1000);
        const matched = this.maturities.filter(m => mats.includes(m.label))
                                       .some(m => yrs >= m.min && yrs < m.max);
        if (!matched) return false;
      }
      return true;
    });

    switch (this.sortBy) {
      case 'yield':    list = [...list].sort((a, b) => b.ytm     - a.ytm);     break;
      case 'price':    list = [...list].sort((a, b) => b.priceNum - a.priceNum); break;
      case 'coupon':   list = [...list].sort((a, b) => b.coupon  - a.coupon);  break;
      case 'maturity': list = [...list].sort((a, b) => a.maturityRaw.localeCompare(b.maturityRaw)); break;
    }

    return list;
  }

  toggleCompare(isin: string) {
    const list = [...this.compareList()];
    const idx  = list.indexOf(isin);
    if (idx >= 0) list.splice(idx, 1);
    else if (list.length < 4) list.push(isin);
    this.compareList.set(list);
  }

  toggleRating(r: string) {
    const list = [...this.activeRatings()];
    const idx  = list.indexOf(r);
    if (idx >= 0) list.splice(idx, 1); else list.push(r);
    this.activeRatings.set(list);
  }

  toggleType(t: string) {
    const list = [...this.activeTypes()];
    const idx  = list.indexOf(t);
    if (idx >= 0) list.splice(idx, 1); else list.push(t);
    this.activeTypes.set(list);
  }

  toggleMaturity(label: string) {
    const list = [...this.activeMaturities()];
    const idx  = list.indexOf(label);
    if (idx >= 0) list.splice(idx, 1); else list.push(label);
    this.activeMaturities.set(list);
  }

  resetFilters() {
    this.searchTerm = '';
    this.sortBy     = 'yield';
    this.minCoupon  = null;
    this.maxCoupon  = null;
    this.activeRatings.set([]);
    this.activeTypes.set([]);
    this.activeMaturities.set(this.maturities.map(m => m.label));
  }

  ratingClass(r: string) {
    if (r.startsWith('AAA')) return 'rating-aaa';
    if (r.startsWith('AA'))  return 'rating-aa';
    if (r.startsWith('A'))   return 'rating-a';
    if (r.startsWith('BBB')) return 'rating-bbb';
    return 'rating-bb';
  }

  ytmColor(ytm: number): string {
    if (ytm >= 5)   return 'var(--success)';
    if (ytm >= 3)   return 'var(--accent-teal)';
    if (ytm >= 2)   return 'var(--warning)';
    return 'var(--danger)';
  }
}
