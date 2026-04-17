import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { PortfolioService } from '../../services/portfolio.service';
import { PortfolioHolding, PortfolioSummary, CouponEvent } from '../../core/models/api.models';

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

interface DonutSegment {
  label:  string;
  pct:    number;
  color:  string;
  dash:   string;
  offset: number;
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
  activeType      = signal<string>('All');
  totalValue      = signal(0);

  kpis: Array<{ label: string; value: string; color: string; sub: string | null; up: boolean }> = [
    { label: 'Total Portfolio Value', value: '—', color: 'var(--text-primary)', sub: null, up: true },
    { label: 'Unrealized P&L',        value: '—', color: 'var(--success)',      sub: null, up: true },
    { label: 'Avg YTM',               value: '—', color: 'var(--accent-cyan)',  sub: null, up: true },
    { label: 'Accrued Interest',       value: '—', color: 'var(--accent-teal)', sub: null, up: true },
    { label: 'Holdings Count',         value: '—', color: 'var(--text-primary)', sub: null, up: true },
  ];

  donutSegments: DonutSegment[] = [];

  upcomingCoupons: Array<{ month: string; day: number; bond: string; rate: number; amount: string }> = [];

  private _holdings = signal<HoldingDisplay[]>([]);

  get holdings() { return this._holdings(); }

  filteredHoldings(): HoldingDisplay[] {
    const t = this.activeType();
    if (t === 'All') return this._holdings();
    return this._holdings().filter(h => h.type === t);
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
        const pnlPct   = s.totalCost > 0
          ? ((s.unrealizedPnl / s.totalCost) * 100).toFixed(2)
          : '0.00';
        this.totalValue.set(s.totalValue);
        this.kpis = [
          { label: 'Total Portfolio Value', value: `${currency} ${s.totalValue.toLocaleString()}`,  color: 'var(--text-primary)', sub: null, up: true },
          { label: 'Unrealized P&L',        value: `${pnlUp ? '+' : ''}${currency} ${s.unrealizedPnl.toLocaleString()}`, color: pnlUp ? 'var(--success)' : 'var(--danger)', sub: `${pnlUp ? '+' : ''}${pnlPct}%`, up: pnlUp },
          { label: 'Avg YTM',               value: '—',                                              color: 'var(--accent-cyan)',  sub: null, up: true },
          { label: 'Accrued Interest',       value: `${currency} ${s.totalCouponReceived.toLocaleString()}`, color: 'var(--accent-teal)', sub: null, up: true },
          { label: 'Holdings Count',         value: s.holdingsCount.toString(),                      color: 'var(--text-primary)', sub: null, up: true },
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
        const mapped = items.map(h => this.mapHolding(h, total));
        this._holdings.set(mapped);
        this.updateAvgYtm(mapped);
        this.updateDonutFromHoldings(items);
      },
      error: () => this.holdingsLoading.set(false),
    });
  }

  private loadCouponCalendar() {
    this.portfolioSvc.getCouponCalendar().subscribe({
      next: res => {
        const items: CouponEvent[] = res.data ?? [];
        this.upcomingCoupons = items.slice(0, 4).map(c => {
          const d = new Date(c.date);
          return {
            month:  d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
            day:    d.getDate(),
            bond:   c.bondName,
            rate:   c.couponRate,
            amount: c.amount.toLocaleString(),
          };
        });
      },
      error: () => { /* keep empty */ },
    });
  }

  private mapHolding(h: PortfolioHolding, totalPortfolio: number): HoldingDisplay {
    const pnl      = h.unrealizedPnl;
    const cost     = h.currentValue - pnl;
    const pnlPct   = cost > 0 ? (pnl / cost) * 100 : 0;
    const weight   = totalPortfolio > 0 ? Math.round((h.currentValue / totalPortfolio) * 100) : 0;
    const type     = h.isShariaCompliant ? 'Sukuk' : (h.issuerType || 'Corporate');
    const typeColorMap: Record<string, string> = {
      Government: '#00d4ff', Corporate: '#7c4dff', Sukuk: '#17c3b2',
    };
    const price = h.currentPrice > 0
      ? h.currentPrice
      : (h.quantity > 0 ? h.currentValue / h.quantity : 100);
    const ytm = this.calcYtm(h.couponRate, price, h.maturityDate);

    return {
      name:      h.bondName,
      issuer:    h.issuerName || '—',
      isin:      h.isin,
      type,
      typeColor: typeColorMap[type] ?? '#00d4ff',
      units:     h.quantity,
      avgCost:   h.avgBuyPrice.toFixed(2),
      mktPrice:  price.toFixed(2),
      mktValue:  h.currentValue,
      pnl,
      pnlPct:    parseFloat(pnlPct.toFixed(2)),
      ytm,
      maturity:  h.maturityDate
        ? new Date(h.maturityDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—',
      weight,
    };
  }

  private calcYtm(couponRate: number, price: number, maturityDate: string): number {
    if (!maturityDate || !couponRate || !price) return 0;
    const yearsLeft = Math.max(0.1,
      (new Date(maturityDate).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000),
    );
    const F   = 100;
    const C   = couponRate;
    const P   = price;
    const ytm = ((C + (F - P) / yearsLeft) / ((F + P) / 2)) * 100;
    return +Math.max(0, ytm).toFixed(2);
  }

  private updateAvgYtm(holdings: HoldingDisplay[]) {
    if (!holdings.length) return;
    const avg = (holdings.reduce((s, h) => s + h.ytm, 0) / holdings.length).toFixed(2);
    this.kpis = this.kpis.map((k, i) => i === 2 ? { ...k, value: `${avg}%` } : k);
  }

  private updateDonutFromHoldings(holdings: PortfolioHolding[]) {
    if (!holdings.length) return;
    const buckets: Record<string, number> = {};
    for (const h of holdings) {
      const key = h.isShariaCompliant ? 'Sukuk' : (h.issuerType || 'Corporate');
      buckets[key] = (buckets[key] ?? 0) + h.currentValue;
    }
    const total = Object.values(buckets).reduce((s, v) => s + v, 0);
    if (!total) return;

    const colors: Record<string, string> = {
      Government: '#00d4ff', Corporate: '#7c4dff', Sukuk: '#17c3b2',
    };
    const c = 2 * Math.PI * 70;
    let offset = 0;
    this.donutSegments = Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([label, v]) => {
        const pct  = Math.round((v / total) * 100);
        const dash = `${(pct / 100) * c} ${c}`;
        const seg: DonutSegment = { label, pct, color: colors[label] ?? '#00d4ff', dash, offset: -offset };
        offset += (pct / 100) * c;
        return seg;
      });
  }

  ytmColor(ytm: number): string {
    if (ytm >= 5) return 'var(--success)';
    if (ytm >= 3) return 'var(--accent-cyan)';
    if (ytm >= 2) return 'var(--warning)';
    return 'var(--danger)';
  }
}
