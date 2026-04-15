import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-aml-compliance',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  template: `
    <div class="aml-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>AML & Compliance</h2>
          <p>Monitor suspicious activity, manage cases and generate regulatory reports</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-dotnet">.NET Core</span>
          <button class="btn btn-secondary"><span class="material-icons-round">assessment</span> Generate Report</button>
          <button class="btn btn-primary"><span class="material-icons-round">add_alert</span> New Case</button>
        </div>
      </div>

      <!-- Alert Banner -->
      <div class="alert-banner">
        <span class="material-icons-round">warning</span>
        <strong>3 HIGH-RISK alerts require immediate review.</strong>
        <span>Last scan: 2 minutes ago · Next scan: in 8 minutes</span>
        <button class="btn btn-danger btn-sm" style="margin-left:auto">Review Now</button>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:24px">
        @for (s of amlStats; track s.label) {
          <div class="stat-card" style="padding:14px">
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" style="font-size:22px" [style.color]="s.color">{{ s.value }}</div>
          </div>
        }
      </div>

      <div class="aml-layout">
        <!-- Left: Alert List -->
        <div class="alerts-panel card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <h4>Alert Queue</h4>
            <div style="display:flex;gap:6px">
              @for (f of alertFilters; track f) {
                <span class="chip" [class.active]="alertFilter() === f" (click)="alertFilter.set(f)">{{ f }}</span>
              }
            </div>
          </div>

          <div class="alert-list">
            @for (alert of filteredAlerts(); track alert.id) {
              <div class="alert-card" [class.selected]="selectedAlert()?.id === alert.id" [class]="'risk-' + alert.risk.toLowerCase()" (click)="selectedAlert.set(alert)">
                <div class="alert-top">
                  <div class="alert-risk-badge" [ngClass]="riskBadge(alert.risk)">{{ alert.risk }}</div>
                  <span class="alert-time">{{ alert.time }}</span>
                </div>
                <strong class="alert-title">{{ alert.title }}</strong>
                <p class="alert-desc">{{ alert.desc }}</p>
                <div class="alert-meta">
                  <span class="material-icons-round" style="font-size:14px">person</span> {{ alert.user }}
                  <span style="margin-left:auto">SAR {{ alert.amount | number }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right: Alert Detail + Risk Dashboard -->
        <div class="right-col">
          <!-- Alert Detail -->
          @if (selectedAlert()) {
            <div class="card alert-detail fade-in">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
                <div>
                  <div class="alert-risk-badge" style="margin-bottom:8px" [ngClass]="riskBadge(selectedAlert()!.risk)">{{ selectedAlert()!.risk }} RISK</div>
                  <h3 style="font-size:16px">{{ selectedAlert()!.title }}</h3>
                  <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Case #{{ selectedAlert()!.id }} · {{ selectedAlert()!.time }}</p>
                </div>
                <span class="badge" [ngClass]="caseBadge(selectedAlert()!.status)">{{ selectedAlert()!.status }}</span>
              </div>

              <div class="detail-grid" style="margin-bottom:16px">
                @for (item of alertDetailItems(); track item.label) {
                  <div class="detail-item">
                    <span class="info-label">{{ item.label }}</span>
                    <span class="info-value">{{ item.value }}</span>
                  </div>
                }
              </div>

              <div class="divider"></div>

              <h4 style="font-size:13px;margin-bottom:12px">Triggered Rules</h4>
              <div class="rules-list">
                @for (rule of selectedAlert()!.rules; track rule) {
                  <div class="rule-item">
                    <span class="material-icons-round" style="font-size:16px;color:var(--danger)">gpp_maybe</span>
                    {{ rule }}
                  </div>
                }
              </div>

              <div class="divider"></div>

              <h4 style="font-size:13px;margin-bottom:12px">Transaction History (User)</h4>
              <table class="data-table">
                <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  @for (tx of selectedAlert()!.txHistory; track tx.date) {
                    <tr>
                      <td>{{ tx.date }}</td>
                      <td>{{ tx.type }}</td>
                      <td [style.color]="tx.amount > 0 ? 'var(--success)' : 'var(--danger)'">
                        {{ tx.amount > 0 ? '+' : '' }}SAR {{ Math.abs(tx.amount) | number:'1.0-0' }}
                      </td>
                      <td><span class="badge badge-success">{{ tx.status }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="divider"></div>

              <div class="action-row">
                <button class="btn btn-success"><span class="material-icons-round">check</span> Clear Alert</button>
                <button class="btn btn-warning-btn"><span class="material-icons-round">escalate</span> Escalate</button>
                <button class="btn btn-danger"><span class="material-icons-round">block</span> Freeze Account</button>
                <button class="btn btn-secondary"><span class="material-icons-round">description</span> File SAR</button>
              </div>
            </div>
          } @else {
            <div class="card empty-state">
              <span class="material-icons-round empty-icon">security</span>
              <h4>Select an alert</h4>
              <p>Click an alert from the queue to view details</p>
            </div>
          }

          <!-- Risk Score Distribution -->
          <div class="card risk-dist-card">
            <h4 style="margin-bottom:16px">Risk Score Distribution</h4>
            <div class="risk-bars">
              @for (r of riskDist; track r.label) {
                <div class="risk-bar-item">
                  <span class="rb-label" [style.color]="r.color">{{ r.label }}</span>
                  <div class="rb-track">
                    <div class="rb-fill" [style.width]="r.pct + '%'" [style.background]="r.color"></div>
                  </div>
                  <span class="rb-count">{{ r.count }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .aml-layout { display: grid; grid-template-columns: 360px 1fr; gap: 20px; }

    .alert-banner {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 20px; background: rgba(255,71,87,0.08);
      border: 1px solid rgba(255,71,87,0.3); border-radius: var(--radius-md);
      margin-bottom: 24px; font-size: 13px;
      .material-icons-round { color: var(--danger); font-size: 20px; }
      strong { color: var(--danger); }
      span { color: var(--text-secondary); }
    }

    .alerts-panel { padding: 18px; overflow: hidden; display: flex; flex-direction: column; }

    .alert-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1; }

    .alert-card {
      background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 14px; cursor: pointer; transition: all 0.15s;
      &:hover { border-color: var(--border-light); }
      &.selected { border-color: var(--accent-cyan); background: rgba(0,212,255,0.04); }
      &.risk-high { border-left: 3px solid var(--danger); }
      &.risk-medium { border-left: 3px solid var(--warning); }
      &.risk-low { border-left: 3px solid var(--success); }
    }

    .alert-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }

    .alert-risk-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; }
    .risk-high   { background: rgba(255,71,87,0.15); color: var(--danger); }
    .risk-medium { background: rgba(255,165,2,0.15); color: var(--warning); }
    .risk-low    { background: rgba(46,213,115,0.15); color: var(--success); }

    .alert-time  { font-size: 11px; color: var(--text-muted); }
    .alert-title { display: block; font-size: 13px; margin-bottom: 4px; }
    .alert-desc  { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }

    .alert-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); }

    .right-col { display: flex; flex-direction: column; gap: 16px; }

    .alert-detail { padding: 20px; }

    .detail-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }

    .detail-item { display: flex; flex-direction: column; gap: 4px; }
    .info-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 13px; font-weight: 500; color: var(--text-primary); }

    .rules-list { display: flex; flex-direction: column; gap: 8px; }

    .rule-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }

    .action-row { display: flex; gap: 10px; flex-wrap: wrap; }

    .btn-warning-btn { background: rgba(255,165,2,0.15); color: var(--warning); border: 1px solid rgba(255,165,2,0.3); padding: 9px 20px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }

    .risk-dist-card { padding: 18px; }

    .risk-bars { display: flex; flex-direction: column; gap: 12px; }

    .risk-bar-item { display: flex; align-items: center; gap: 12px; }

    .rb-label { font-size: 12px; font-weight: 600; width: 70px; }

    .rb-track { flex: 1; height: 8px; background: var(--bg-surface); border-radius: 4px; overflow: hidden; }

    .rb-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }

    .rb-count { font-size: 12px; color: var(--text-secondary); width: 30px; text-align: right; }
  `],
})
export class AmlComplianceComponent {
  alertFilter = signal('All');
  selectedAlert = signal<any>(null);
  Math = Math;

  alertFilters = ['All', 'High', 'Medium', 'Low'];

  amlStats = [
    { label: 'Total Alerts', value: '127', color: 'var(--text-primary)' },
    { label: 'High Risk', value: '3', color: 'var(--danger)' },
    { label: 'Medium Risk', value: '18', color: 'var(--warning)' },
    { label: 'Low Risk', value: '106', color: 'var(--success)' },
    { label: 'Open Cases', value: '21', color: 'var(--accent-cyan)' },
    { label: 'SARs Filed (YTD)', value: '14', color: 'var(--accent-purple)' },
  ];

  alerts = [
    {
      id: 'AML-2024-001', risk: 'HIGH', title: 'Large Cash Deposit Pattern', desc: 'Multiple deposits just below SAR 500K threshold in 72 hours', user: 'Omar Al-Farouqi (#8821)', amount: 1450000, time: '2 min ago', status: 'Open',
      rules: ['Structuring Pattern Detected (Rule 4.2)', 'Velocity Threshold Exceeded (Rule 7.1)', 'Politically Exposed Person (Rule 2.5)'],
      txHistory: [{ date: 'Apr 15 11:20', type: 'Deposit', amount: 490000, status: 'Completed' }, { date: 'Apr 15 09:45', type: 'Deposit', amount: 485000, status: 'Completed' }, { date: 'Apr 14 16:30', type: 'Deposit', amount: 475000, status: 'Completed' }],
    },
    {
      id: 'AML-2024-002', risk: 'HIGH', title: 'Sanctions List Match', desc: 'User nationality and transaction pattern matches OFAC watchlist entity', user: 'Unknown Entity (#9102)', amount: 2800000, time: '18 min ago', status: 'Open',
      rules: ['OFAC SDN List Match (Rule 1.1)', 'Unusual Geographic Pattern (Rule 5.3)'],
      txHistory: [{ date: 'Apr 15 08:00', type: 'Wire Transfer', amount: -2800000, status: 'Flagged' }],
    },
    {
      id: 'AML-2024-003', risk: 'HIGH', title: 'Rapid In-Out Transactions', desc: 'Funds deposited and withdrawn within 24h — possible layering activity', user: 'Tariq Al-Harbi (#7744)', amount: 3200000, time: '45 min ago', status: 'Under Review',
      rules: ['Rapid Funds Movement (Rule 6.1)', 'Layering Indicator (Rule 3.4)'],
      txHistory: [{ date: 'Apr 14 10:00', type: 'Deposit', amount: 3200000, status: 'Completed' }, { date: 'Apr 15 09:30', type: 'Withdrawal', amount: -3200000, status: 'Pending' }],
    },
    {
      id: 'AML-2024-004', risk: 'MEDIUM', title: 'Unusual Trading Volume Spike', desc: 'User trading volume 8x higher than 30-day average', user: 'Hind Al-Qahtani (#6633)', amount: 850000, time: '1h ago', status: 'Open',
      rules: ['Volume Anomaly (Rule 8.2)'],
      txHistory: [{ date: 'Apr 15', type: 'Bond Trade', amount: -850000, status: 'Completed' }],
    },
    {
      id: 'AML-2024-005', risk: 'LOW', title: 'New User Large Transaction', desc: 'Account <30 days old executing trade above SAR 100K', user: 'Nora Al-Shehri (#5521)', amount: 120000, time: '2h ago', status: 'Cleared',
      rules: ['New Account Large Transaction (Rule 9.1)'],
      txHistory: [{ date: 'Apr 15', type: 'Bond Purchase', amount: -120000, status: 'Completed' }],
    },
  ];

  riskDist = [
    { label: 'Critical', color: '#ff2d4b', count: 1, pct: 2 },
    { label: 'High', color: '#ff4757', count: 3, pct: 8 },
    { label: 'Medium', color: '#ffa502', count: 18, pct: 35 },
    { label: 'Low', color: '#2ed573', count: 106, pct: 100 },
  ];

  filteredAlerts() {
    const f = this.alertFilter();
    if (f === 'All') return this.alerts;
    return this.alerts.filter(a => a.risk === f.toUpperCase());
  }

  alertDetailItems() {
    const a = this.selectedAlert();
    if (!a) return [];
    return [
      { label: 'Case ID', value: a.id },
      { label: 'Status', value: a.status },
      { label: 'User', value: a.user },
      { label: 'Amount', value: 'SAR ' + a.amount.toLocaleString() },
      { label: 'Risk Level', value: a.risk },
      { label: 'Detected', value: a.time },
    ];
  }

  riskBadge(risk: string) { return { 'risk-high': risk === 'HIGH', 'risk-medium': risk === 'MEDIUM', 'risk-low': risk === 'LOW' }; }
  caseBadge(s: string) { return { 'badge-warning': s === 'Open', 'badge-info': s === 'Under Review', 'badge-success': s === 'Cleared' }; }
}
