import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { PortfolioService } from '../../services/portfolio.service';
import { PortfolioHolding, PortfolioSummary } from '../../core/models/api.models';

interface HoldingDisplay {
  name:      string;
  issuer:    string;
  isin:      string;
  type:      string;
  typeColor: string;
  units:     number;
  avgCost:   string;
  mktPrice:  string;
  mktValue:  number;
  pnl:       number;
  pnlPct:    number;
  ytm:       number;
  maturity:  string;
  weight:    number;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgClass, DecimalPipe],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.css',
})
export class PortfolioComponent implements OnInit {
  private readonly portfolioSvc = inject(PortfolioService);

  loading         = signal(true);
  holdingsLoading = signal(true);

  kpis: Array<{ label: string; value: string; color: string; sub: string | null; up: boolean }> = [
    { label: 'Total Portfolio Value', value: '—', color: 'var(--text-primary)', sub: null, up: true },
    { label: 'Unrealized P&L',        value: '—', color: 'var(--success)',      sub: null, up: true },
    { label: 'Avg YTM',               value: '—', color: 'var(--accent-cyan)',  sub: null, up: true },
    { label: 'Accrued Interest',       value: '—', color: 'var(--accent-teal)', sub: null, up: true },
    { label: 'Holdings Count',         value: '—', color: 'var(--text-primary)', sub: null, up: true },
  ];

  donutSegments = (() => {
    const data = [
      { label: 'Government', pct: 45, color: '#00d4ff' },
      { label: 'Corporate',  pct: 28, color: '#7c4dff' },
      { label: 'Sukuk',      pct: 18, color: '#17c3b2' },
      { label: 'Municipal',  pct: 9,  color: '#ffc107' },
    ];
    const c = 2 * Math.PI * 70;
    let offset = 0;
    return data.map(d => {
      const dash = `${(d.pct / 100) * c} ${c}`;
      const seg  = { ...d, dash, offset: -offset };
      offset += (d.pct / 100) * c;
      return seg;
    });
  })();

  upcomingCoupons: Array<{ month: string; day: number; bond: string; rate: number; period: string; amount: string }> = [];

  private _holdings = signal<HoldingDisplay[]>([]);

  get holdings() {
    return this._holdings();
  }

  ngOnInit() {
    this.loadSummary();
    this.loadHoldings();
    this.loadCouponCalendar();
  }

  private loadSummary() {
    this.portfolioSvc.getSummary().subscribe({
      next: res => {
        this.loading.set(false);
        const s: PortfolioSummary = res.data;
        const currency = s.currency ?? 'SAR';
        const pnlUp    = s.unrealizedPnl >= 0;
        const pnlPct   = s.totalCost > 0 ? ((s.unrealizedPnl / s.totalCost) * 100).toFixed(2) : '0.00';
        this.kpis = [
          { label: 'Total Portfolio Value', value: `${currency} ${s.totalValue.toLocaleString()}`, color: 'var(--text-primary)', sub: null,         up: true },
          { label: 'Unrealized P&L',        value: `${pnlUp ? '+' : ''}${currency} ${s.unrealizedPnl.toLocaleString()}`, color: pnlUp ? 'var(--success)' : 'var(--danger)', sub: `${pnlUp ? '+' : ''}${pnlPct}%`, up: pnlUp },
          { label: 'Avg YTM',               value: '—',                                             color: 'var(--accent-cyan)',  sub: null,         up: true },
          { label: 'Accrued Interest',       value: `${currency} ${s.totalCouponReceived.toLocaleString()}`, color: 'var(--accent-teal)', sub: null, up: true },
          { label: 'Holdings Count',         value: s.holdingsCount.toString(),                     color: 'var(--text-primary)', sub: null,         up: true },
        ];
      },
      error: () => this.loading.set(false),
    });
  }

  private loadHoldings() {
    this.portfolioSvc.getHoldings().subscribe({
      next: res => {
        this.holdingsLoading.set(false);
        const items = res.data ?? [];
        const total = items.reduce((sum, h) => sum + h.currentValue, 0);
        this._holdings.set(items.map(h => this.mapHolding(h, total)));
        this.updateDonutFromHoldings(items);
      },
      error: () => this.holdingsLoading.set(false),
    });
  }

  private loadCouponCalendar() {
    this.portfolioSvc.getCouponCalendar().subscribe({
      next: (res: any) => {
        const items: any[] = res.data ?? res ?? [];
        this.upcomingCoupons = items.slice(0, 4).map((c: any) => ({
          month:  new Date(c.paymentDate ?? c.payment_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
          day:    new Date(c.paymentDate ?? c.payment_date).getDate(),
          bond:   c.bondName ?? c.bond_name ?? '—',
          rate:   c.couponRate ?? c.coupon_rate ?? 0,
          period: c.frequency ?? 'Semi-annual',
          amount: (c.amount ?? 0).toLocaleString(),
        }));
      },
      error: () => { /* keep empty */ },
    });
  }

  private mapHolding(h: PortfolioHolding, totalPortfolio: number): HoldingDisplay {
    const pnl    = h.unrealizedPnl;
    const pnlPct = h.currentValue > 0 ? (pnl / (h.currentValue - pnl)) * 100 : 0;
    const weight = totalPortfolio > 0 ? Math.round((h.currentValue / totalPortfolio) * 100) : 0;
    return {
      name:      h.bondName,
      issuer:    '—',
      isin:      h.isin,
      type:      'Bond',
      typeColor: '#00d4ff',
      units:     h.quantity,
      avgCost:   h.avgBuyPrice.toFixed(2),
      mktPrice:  '—',
      mktValue:  h.currentValue,
      pnl,
      pnlPct:    parseFloat(pnlPct.toFixed(2)),
      ytm:       0,
      maturity:  '—',
      weight,
    };
  }

  private updateDonutFromHoldings(holdings: PortfolioHolding[]) {
    // Placeholder — bond type is not in PortfolioHolding, keep static chart
  }
}
