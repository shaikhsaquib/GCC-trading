import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgClass, DecimalPipe],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.css',
})
export class PortfolioComponent {
  kpis = [
    { label: 'Total Portfolio Value', value: 'SAR 920M', color: 'var(--text-primary)', sub: '12.3% YTD', up: true },
    { label: 'Unrealized P&L', value: '+SAR 116K', color: 'var(--success)', sub: '+12.65%', up: true },
    { label: 'Avg YTM', value: '4.18%', color: 'var(--accent-cyan)', sub: null, up: true },
    { label: 'Accrued Interest', value: 'SAR 18,750', color: 'var(--accent-teal)', sub: null, up: true },
    { label: 'Duration (years)', value: '4.82', color: 'var(--text-primary)', sub: null, up: true },
  ];

  donutSegments = (() => {
    const data = [
      { label: 'Government', pct: 45, color: '#00d4ff' },
      { label: 'Corporate', pct: 28, color: '#7c4dff' },
      { label: 'Sukuk', pct: 18, color: '#17c3b2' },
      { label: 'Municipal', pct: 9, color: '#ffc107' },
    ];
    const circumference = 2 * Math.PI * 70;
    let offset = 0;
    return data.map(d => {
      const dash = `${(d.pct / 100) * circumference} ${circumference}`;
      const seg = { ...d, dash, offset: -offset };
      offset += (d.pct / 100) * circumference;
      return seg;
    });
  })();

  upcomingCoupons = [
    { month: 'APR', day: 30, bond: 'SAG Bond 2029', rate: 4.25, period: 'Semi-annual', amount: '10,625' },
    { month: 'MAY', day: 15, bond: 'Aramco Sukuk 2026', rate: 3.75, period: 'Quarterly', amount: '4,688' },
    { month: 'JUN', day: 1, bond: 'SABIC Bond 2028', rate: 4.50, period: 'Annual', amount: '13,500' },
    { month: 'JUN', day: 30, bond: 'ADG Bond 2030', rate: 3.90, period: 'Semi-annual', amount: '7,800' },
  ];

  holdings = [
    { name: 'Saudi Govt. Bond 2029', issuer: 'Ministry of Finance', isin: 'SA1230001234', type: 'Government', typeColor: '#00d4ff', units: 10000, avgCost: '99.80', mktPrice: '101.45', mktValue: 1014500, pnl: 16500, pnlPct: 1.65, ytm: 3.98, maturity: 'Mar 2029', weight: 38 },
    { name: 'Saudi Aramco Sukuk 2026', issuer: 'Saudi Aramco', isin: 'SA2340015678', type: 'Sukuk', typeColor: '#17c3b2', units: 5000, avgCost: '100.10', mktPrice: '99.82', mktValue: 499100, pnl: -1400, pnlPct: -0.28, ytm: 3.83, maturity: 'Jun 2026', weight: 18 },
    { name: 'SABIC Corporate Bond 2028', issuer: 'SABIC', isin: 'SA3450029012', type: 'Corporate', typeColor: '#7c4dff', units: 7000, avgCost: '99.50', mktPrice: '100.75', mktValue: 705250, pnl: 8750, pnlPct: 1.26, ytm: 4.34, maturity: 'Dec 2028', weight: 26 },
    { name: 'Abu Dhabi Govt. Bond 2030', issuer: 'Emirate of Abu Dhabi', isin: 'AE0040012345', type: 'Government', typeColor: '#00d4ff', units: 3000, avgCost: '99.20', mktPrice: '98.60', mktValue: 295800, pnl: -1800, pnlPct: -0.60, ytm: 4.12, maturity: 'Sep 2030', weight: 11 },
    { name: 'Kuwait Finance Sukuk', issuer: 'Kuwait Finance House', isin: 'KW0050023456', type: 'Sukuk', typeColor: '#17c3b2', units: 2000, avgCost: '100.80', mktPrice: '102.10', mktValue: 204200, pnl: 2600, pnlPct: 1.29, ytm: 4.52, maturity: 'Jan 2027', weight: 7 },
  ];
}
