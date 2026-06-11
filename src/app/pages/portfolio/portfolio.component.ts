import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { PortfolioService } from '../../services/portfolio.service';
import { PortfolioHolding, PortfolioSummary, CouponEvent } from '../../core/models/api.models';
import { ToastService } from '../../core/services/toast.service';
import { exportToCsv } from '../../core/utils/csv-export';
import { CountUpDirective } from '../../shared/count-up.directive';

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
  value:  number;
  color:  string;
  dash:   string;
  offset: number;
}

interface PortfolioKpi {
  label:     string;
  value:     string;
  raw:       number | null;
  prefix?:   string;
  suffix?:   string;
  decimals?: number;
  color:     string;
  sub:       string | null;
  up:        boolean;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgClass, DecimalPipe, CountUpDirective],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.css',
})
export class PortfolioComponent implements OnInit {
  private readonly portfolioSvc = inject(PortfolioService);
  private readonly toast        = inject(ToastService);

  loading         = signal(true);
  holdingsLoading = signal(true);
  activeType      = signal<string>('All');
  totalValue      = signal(0);
  currency        = signal('AED');

  kpis: PortfolioKpi[] = [
    { label: 'Total Portfolio Value', value: '—', raw: null, color: 'var(--text-primary)', sub: null, up: true },
    { label: 'Unrealized P&L',        value: '—', raw: null, color: 'var(--success)',      sub: null, up: true },
    { label: 'Avg YTM',               value: '—', raw: null, color: 'var(--accent-cyan)',  sub: null, up: true },
    { label: 'Accrued Interest',       value: '—', raw: null, color: 'var(--accent-teal)', sub: null, up: true },
    { label: 'Holdings Count',         value: '—', raw: null, color: 'var(--text-primary)', sub: null, up: true },
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
        const currency = s.currency ?? 'AED';
        this.currency.set(currency);
        const pnlUp    = s.unrealizedPnl >= 0;
        const pnlPct   = s.totalCost > 0
          ? ((s.unrealizedPnl / s.totalCost) * 100).toFixed(2)
          : '0.00';
        this.totalValue.set(s.totalValue);
        this.kpis = [
          { label: 'Total Portfolio Value', value: `${currency} ${s.totalValue.toLocaleString()}`,  raw: s.totalValue, prefix: `${currency} `, color: 'var(--text-primary)', sub: null, up: true },
          { label: 'Unrealized P&L',        value: `${pnlUp ? '+' : ''}${currency} ${s.unrealizedPnl.toLocaleString()}`, raw: s.unrealizedPnl, prefix: `${pnlUp ? '+' : ''}${currency} `, color: pnlUp ? 'var(--success)' : 'var(--danger)', sub: `${pnlUp ? '+' : ''}${pnlPct}%`, up: pnlUp },
          { label: 'Avg YTM',               value: '—',                                              raw: null, color: 'var(--accent-cyan)',  sub: null, up: true },
          { label: 'Accrued Interest',       value: `${currency} ${s.totalCouponReceived.toLocaleString()}`, raw: s.totalCouponReceived, prefix: `${currency} `, color: 'var(--accent-teal)', sub: null, up: true },
          { label: 'Holdings Count',         value: s.holdingsCount.toString(),                      raw: s.holdingsCount, color: 'var(--text-primary)', sub: null, up: true },
        ];
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load portfolio summary — please try again');
      },
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
      error: () => {
        this.holdingsLoading.set(false);
        this.toast.error('Could not load holdings — please try again');
      },
    });
  }

  exportHoldings() {
    const rows = this.filteredHoldings();
    if (!rows.length) { this.toast.info('No holdings to export'); return; }
    exportToCsv('portfolio-holdings', [
      { label: 'Bond',           key: 'name'     },
      { label: 'Issuer',         key: 'issuer'   },
      { label: 'ISIN',           key: 'isin'     },
      { label: 'Type',           key: 'type'     },
      { label: 'Units',          key: 'units'    },
      { label: 'Avg Cost',       key: 'avgCost'  },
      { label: 'Market Price',   key: 'mktPrice' },
      { label: 'Market Value',   key: 'mktValue' },
      { label: 'Unrealized P&L', key: 'pnl'      },
      { label: 'P&L %',          key: 'pnlPct'   },
      { label: 'YTM %',          key: 'ytm'      },
      { label: 'Maturity',       key: 'maturity' },
      { label: 'Weight %',       key: 'weight'   },
    ], rows as unknown as Record<string, unknown>[]);
    this.toast.success(`Exported ${rows.length} rows`);
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
    // Value-weighted average — a small position must not skew the portfolio YTM
    const totalMv = holdings.reduce((s, h) => s + h.mktValue, 0);
    const avg = totalMv > 0
      ? holdings.reduce((s, h) => s + h.ytm * h.mktValue, 0) / totalMv
      : holdings.reduce((s, h) => s + h.ytm, 0) / holdings.length;
    this.kpis = this.kpis.map((k, i) => i === 2
      ? { ...k, value: `${avg.toFixed(2)}%`, raw: avg, suffix: '%', decimals: 2 }
      : k);
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
        const seg: DonutSegment = { label, pct, value: v, color: colors[label] ?? '#00d4ff', dash, offset: -offset };
        offset += (pct / 100) * c;
        return seg;
      });
  }

  // ── Donut tooltip ─────────────────────────────────────────────────────────────

  donutTooltip = signal<{ x: number; y: number; lines: string[] } | null>(null);
  hoveredSeg   = signal<string | null>(null);

  onSegHover(ev: MouseEvent, seg: DonutSegment) {
    const wrap = (ev.currentTarget as Element).closest('.donut-chart-wrapper');
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    this.hoveredSeg.set(seg.label);
    this.donutTooltip.set({
      x: ev.clientX - box.left,
      y: ev.clientY - box.top - 12,
      lines: [
        seg.label,
        `${seg.pct}% · ${this.currency()} ${seg.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      ],
    });
  }

  onSegLeave() {
    this.hoveredSeg.set(null);
    this.donutTooltip.set(null);
  }

  ytmColor(ytm: number): string {
    if (ytm >= 5) return 'var(--success)';
    if (ytm >= 3) return 'var(--accent-cyan)';
    if (ytm >= 2) return 'var(--warning)';
    return 'var(--danger)';
  }
}
