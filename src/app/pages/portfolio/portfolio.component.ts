import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgClass, DecimalPipe],
  template: `
    <div class="portfolio-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Portfolio Management</h2>
          <p>Track holdings, monitor P&L and manage coupon schedule</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-dotnet">.NET Core</span>
          <button class="btn btn-secondary"><span class="material-icons-round">filter_list</span> Filters</button>
          <button class="btn btn-primary"><span class="material-icons-round">file_download</span> Export</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px">
        @for (k of kpis; track k.label) {
          <div class="stat-card" style="padding:18px">
            <div class="stat-label">{{ k.label }}</div>
            <div class="stat-value" style="font-size:22px" [style.color]="k.color">{{ k.value }}</div>
            @if (k.sub) {
              <div class="stat-change" [class.up]="k.up" [class.down]="!k.up">{{ k.up ? '▲' : '▼' }} {{ k.sub }}</div>
            }
          </div>
        }
      </div>

      <div class="portfolio-layout">

        <!-- Left: Allocation Chart (SVG) + Breakdown -->
        <div class="side-panel">
          <div class="card">
            <h4 style="margin-bottom:16px">Allocation</h4>

            <!-- Donut Chart -->
            <div class="donut-chart-wrapper">
              <svg width="180" height="180" viewBox="0 0 180 180">
                @for (seg of donutSegments; track seg.label; let i = $index) {
                  <circle
                    cx="90" cy="90" r="70"
                    fill="none"
                    [attr.stroke]="seg.color"
                    stroke-width="28"
                    [attr.stroke-dasharray]="seg.dash"
                    [attr.stroke-dashoffset]="seg.offset"
                    transform="rotate(-90 90 90)"
                    stroke-linecap="butt"
                  />
                }
                <text x="90" y="85" text-anchor="middle" fill="white" font-size="14" font-weight="700">SAR</text>
                <text x="90" y="104" text-anchor="middle" fill="#8fa3b8" font-size="11">920M</text>
              </svg>
            </div>

            <div class="allocation-legend">
              @for (seg of donutSegments; track seg.label) {
                <div class="legend-item">
                  <span class="legend-dot" [style.background]="seg.color"></span>
                  <span class="legend-label">{{ seg.label }}</span>
                  <span class="legend-pct">{{ seg.pct }}%</span>
                </div>
              }
            </div>
          </div>

          <!-- Coupon Calendar -->
          <div class="card" style="margin-top:16px">
            <h4 style="margin-bottom:14px">Upcoming Coupons</h4>
            <div class="coupon-list">
              @for (c of upcomingCoupons; track c.bond) {
                <div class="coupon-item">
                  <div class="coupon-date-box">
                    <span class="coupon-month">{{ c.month }}</span>
                    <span class="coupon-day">{{ c.day }}</span>
                  </div>
                  <div class="coupon-info">
                    <strong>{{ c.bond }}</strong>
                    <small>{{ c.rate }}% · {{ c.period }}</small>
                  </div>
                  <span class="coupon-amount text-cyan">SAR {{ c.amount }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Right: Holdings Table + P&L Chart -->
        <div class="main-panel">

          <!-- P&L Mini Bars -->
          <div class="pnl-bar-row">
            <div class="card pnl-card" style="flex:1">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">UNREALIZED P&L</div>
              <div style="font-size:24px;font-weight:800;color:var(--success)">+SAR 116,420</div>
              <div style="font-size:12px;color:var(--success)">▲ +12.65% since purchase</div>
            </div>
            <div class="card pnl-card" style="flex:1">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">REALIZED P&L (YTD)</div>
              <div style="font-size:24px;font-weight:800;color:var(--success)">+SAR 84,200</div>
              <div style="font-size:12px;color:var(--success)">▲ +8.42% vs beginning of year</div>
            </div>
            <div class="card pnl-card" style="flex:1">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">ACCRUED INTEREST</div>
              <div style="font-size:24px;font-weight:800;color:var(--accent-cyan)">SAR 18,750</div>
              <div style="font-size:12px;color:var(--text-secondary)">Next payment: Apr 30</div>
            </div>
          </div>

          <!-- Holdings Table -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <h4 style="font-size:14px;font-weight:700">Holdings</h4>
              <div style="display:flex;gap:8px">
                <span class="chip active">All</span>
                <span class="chip">Government</span>
                <span class="chip">Corporate</span>
                <span class="chip">Sukuk</span>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bond</th>
                  <th>ISIN</th>
                  <th>Type</th>
                  <th>Units</th>
                  <th>Avg Cost</th>
                  <th>Mkt Price</th>
                  <th>Market Value</th>
                  <th>Unrealized P&L</th>
                  <th>YTM</th>
                  <th>Maturity</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                @for (h of holdings; track h.isin) {
                  <tr>
                    <td>
                      <div>
                        <div style="font-weight:600;font-size:13px">{{ h.name }}</div>
                        <div style="font-size:11px;color:var(--text-secondary)">{{ h.issuer }}</div>
                      </div>
                    </td>
                    <td><code style="font-size:11px;color:var(--accent-cyan)">{{ h.isin }}</code></td>
                    <td><span class="type-tag" [style.background]="h.typeColor + '22'" [style.color]="h.typeColor">{{ h.type }}</span></td>
                    <td>{{ h.units | number }}</td>
                    <td>{{ h.avgCost }}</td>
                    <td>{{ h.mktPrice }}</td>
                    <td style="font-weight:600">SAR {{ h.mktValue | number:'1.0-0' }}</td>
                    <td>
                      <div [style.color]="h.pnl >= 0 ? 'var(--success)' : 'var(--danger)'" style="font-weight:600">
                        {{ h.pnl >= 0 ? '+' : '' }}SAR {{ h.pnl | number:'1.0-0' }}
                      </div>
                      <div style="font-size:11px" [style.color]="h.pnlPct >= 0 ? 'var(--success)' : 'var(--danger)'">
                        {{ h.pnlPct >= 0 ? '+' : '' }}{{ h.pnlPct }}%
                      </div>
                    </td>
                    <td [style.color]="h.ytm > 4 ? 'var(--success)' : 'var(--warning)'">{{ h.ytm }}%</td>
                    <td style="color:var(--text-secondary)">{{ h.maturity }}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <div class="progress-bar" style="width:60px">
                          <div class="progress-fill" [style.width]="h.weight + '%'"></div>
                        </div>
                        <span style="font-size:12px;color:var(--text-secondary)">{{ h.weight }}%</span>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .portfolio-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }

    .side-panel { display: flex; flex-direction: column; }

    .donut-chart-wrapper { display: flex; justify-content: center; margin-bottom: 16px; }

    .allocation-legend { display: flex; flex-direction: column; gap: 8px; }

    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-label { flex: 1; color: var(--text-secondary); }
    .legend-pct { font-weight: 700; color: var(--text-primary); }

    .coupon-list { display: flex; flex-direction: column; gap: 10px; }

    .coupon-item { display: flex; align-items: center; gap: 12px; }

    .coupon-date-box { width: 44px; background: var(--bg-input); border-radius: var(--radius-sm); text-align: center; padding: 6px; }
    .coupon-month { display: block; font-size: 9px; font-weight: 600; color: var(--accent-cyan); text-transform: uppercase; }
    .coupon-day { display: block; font-size: 18px; font-weight: 800; color: var(--text-primary); }

    .coupon-info { flex: 1; strong { display: block; font-size: 12px; } small { font-size: 11px; color: var(--text-secondary); } }

    .coupon-amount { font-size: 13px; font-weight: 700; white-space: nowrap; }

    .pnl-bar-row { display: flex; gap: 14px; margin-bottom: 16px; }

    .pnl-card { padding: 16px; }

    .type-tag { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
  `],
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
