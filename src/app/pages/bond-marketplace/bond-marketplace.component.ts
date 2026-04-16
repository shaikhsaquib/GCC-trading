import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BondService } from '../../services/bond.service';
import { Bond } from '../../core/models/api.models';

interface BondDisplay {
  id:        string;
  name:      string;
  issuer:    string;
  isin:      string;
  type:      string;
  typeColor: string;
  rating:    string;
  coupon:    number;
  maturity:  string;
  price:     string;
  ytm:       number;
  volume:    string;
}

@Component({
  selector: 'app-bond-marketplace',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './bond-marketplace.component.html',
  styleUrl: './bond-marketplace.component.css',
})
export class BondMarketplaceComponent implements OnInit {
  private readonly bondSvc = inject(BondService);

  viewMode      = signal<'table' | 'grid'>('table');
  searchTerm    = '';
  sortBy        = 'yield';
  minCoupon     = null;
  maxCoupon     = null;
  selectedBond  = signal<BondDisplay | null>(null);
  compareList   = signal<string[]>([]);
  activeRatings = signal<string[]>([]);

  loading = signal(true);
  error   = signal<string | null>(null);

  bondTypes = ['Government', 'Corporate', 'Sukuk', 'Municipal', 'Supranational'];
  regions   = ['Saudi Arabia', 'UAE', 'Kuwait', 'Bahrain', 'Qatar', 'Oman', 'International'];
  ratings   = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB'];
  maturities = [
    { label: '< 1 year',   checked: true },
    { label: '1-3 years',  checked: true },
    { label: '3-5 years',  checked: true },
    { label: '5-10 years', checked: true },
    { label: '> 10 years', checked: false },
  ];

  marketStats = [
    { label: 'Total Bonds Listed', value: '—',  chg: '—',    up: true },
    { label: 'Market Cap',         value: '—',  chg: '—',    up: true },
    { label: 'Avg YTM',            value: '—',  chg: '—',    up: false },
    { label: 'Trading Volume',     value: '—',  chg: '—',    up: true },
  ];

  private _bonds = signal<BondDisplay[]>([]);

  get bonds() {
    return this._bonds();
  }

  ngOnInit() {
    this.loadBonds();
  }

  private loadBonds() {
    this.bondSvc.search({ page: 1, pageSize: 50 }).subscribe({
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
      Government: '#00d4ff',
      Corporate:  '#7c4dff',
      Sukuk:      '#17c3b2',
    };
    return {
      id:        b.id,
      name:      b.name,
      issuer:    b.issuerName,
      isin:      b.isin,
      type,
      typeColor: typeColorMap[type] ?? '#00d4ff',
      rating:    b.creditRating,
      coupon:    b.couponRate,
      maturity:  new Date(b.maturityDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      price:     b.currentPrice?.toFixed(2) ?? '—',
      ytm:       0,
      volume:    '—',
    };
  }

  private updateMarketStats(bonds: Bond[]) {
    const count = bonds.length;
    const avgCoupon = bonds.length
      ? (bonds.reduce((s, b) => s + b.couponRate, 0) / bonds.length).toFixed(2)
      : '—';
    this.marketStats = [
      { label: 'Total Bonds Listed', value: count.toString(), chg: '',     up: true },
      { label: 'Market Cap',         value: '—',              chg: '',     up: true },
      { label: 'Avg Coupon',         value: `${avgCoupon}%`,  chg: '',     up: true },
      { label: 'Trading Volume',     value: '—',              chg: '',     up: true },
    ];
  }

  filteredBonds() {
    const term = this.searchTerm.toLowerCase();
    const ratings = this.activeRatings();
    return this._bonds().filter(b => {
      const matchSearch = !term
        || b.name.toLowerCase().includes(term)
        || b.isin.toLowerCase().includes(term)
        || b.issuer.toLowerCase().includes(term);
      const matchRating = ratings.length === 0 || ratings.includes(b.rating);
      return matchSearch && matchRating;
    });
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
    if (idx >= 0) list.splice(idx, 1);
    else list.push(r);
    this.activeRatings.set(list);
  }

  ratingClass(r: string) {
    if (r.startsWith('AAA')) return 'rating-aaa';
    if (r.startsWith('AA'))  return 'rating-aa';
    if (r.startsWith('A'))   return 'rating-a';
    if (r.startsWith('BBB')) return 'rating-bbb';
    return 'rating-bb';
  }
}
