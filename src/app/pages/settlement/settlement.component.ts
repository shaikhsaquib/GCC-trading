import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settlement',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  template: `
    <div class="settlement-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Settlement</h2>
          <p>Finalize trades — T+1 settlement queue and history</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-dotnet">.NET Core</span>
          <button class="btn btn-secondary"><span class="material-icons-round">file_download</span> Export</button>
          <button class="btn btn-primary"><span class="material-icons-round">sync</span> Refresh</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px">
        @for (s of settlStats; track s.label) {
          <div class="stat-card" style="padding:16px">
            <div class="stat-icon" [style.background]="s.iconBg" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">
              <span class="material-icons-round" [style.color]="s.iconColor" style="font-size:18px">{{ s.icon }}</span>
            </div>
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" style="font-size:22px" [style.color]="s.color">{{ s.value }}</div>
          </div>
        }
      </div>

      <!-- Tab Bar -->
      <div class="tab-bar">
        @for (tab of tabs; track tab) {
          <div class="tab" [class.active]="activeTab() === tab" (click)="activeTab.set(tab)">{{ tab }}</div>
        }
      </div>

      <!-- Toolbar -->
      <div class="toolbar" style="margin-bottom:16px">
        <div class="search-bar" style="flex:1">
          <span class="material-icons-round search-icon">search</span>
          <input class="form-control" style="width:100%;padding-left:36px" placeholder="Search by trade ID, ISIN, counterparty..." name="ss"/>
        </div>
        <select class="form-control form-select" style="width:160px" name="sf">
          <option>All Dates</option>
          <option>Today</option>
          <option>This Week</option>
        </select>
        <select class="form-control form-select" style="width:140px" name="sc">
          <option>All Currencies</option>
          <option>SAR</option>
          <option>USD</option>
          <option>AED</option>
        </select>
      </div>

      <!-- Settlement Table -->
      <div class="card" style="padding:0;overflow:hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" style="accent-color:var(--accent-cyan)"/></th>
              <th>Trade ID</th>
              <th>Bond</th>
              <th>ISIN</th>
              <th>Side</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Value (SAR)</th>
              <th>Counterparty</th>
              <th>Trade Date</th>
              <th>Settlement Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (s of filteredSettlements(); track s.id) {
              <tr [class.selected-row]="selectedSettlement()?.id === s.id" (click)="selectedSettlement.set(s)">
                <td (click)="$event.stopPropagation()">
                  <input type="checkbox" style="accent-color:var(--accent-cyan)"/>
                </td>
                <td><code style="font-size:11px;color:var(--accent-cyan)">{{ s.id }}</code></td>
                <td>
                  <div>
                    <div style="font-weight:600;font-size:13px">{{ s.bond }}</div>
                    <div style="font-size:11px;color:var(--text-secondary)">{{ s.issuer }}</div>
                  </div>
                </td>
                <td><code style="font-size:11px">{{ s.isin }}</code></td>
                <td>
                  <span class="side-badge" [ngClass]="s.side === 'BUY' ? 'buy' : 'sell'">{{ s.side }}</span>
                </td>
                <td style="font-variant-numeric:tabular-nums">{{ s.qty | number }}</td>
                <td>{{ s.price }}</td>
                <td style="font-weight:600">SAR {{ s.value | number:'1.0-0' }}</td>
                <td style="color:var(--text-secondary)">{{ s.counterparty }}</td>
                <td style="color:var(--text-secondary)">{{ s.tradeDate }}</td>
                <td style="color:var(--accent-cyan);font-weight:600">{{ s.settlementDate }}</td>
                <td><span class="badge" [ngClass]="statusBadge(s.status)">{{ s.status }}</span></td>
                <td (click)="$event.stopPropagation()">
                  @if (s.status === 'Pending') {
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-success btn-sm">Confirm</button>
                      <button class="btn btn-danger btn-sm">Fail</button>
                    </div>
                  } @else if (s.status === 'Failed') {
                    <button class="btn btn-secondary btn-sm">Retry</button>
                  } @else {
                    <button class="btn btn-secondary btn-sm">Details</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Settlement Detail Modal (side panel) -->
      @if (selectedSettlement()) {
        <div class="detail-drawer card fade-in">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <h4>Settlement Details</h4>
            <button class="btn btn-icon" (click)="selectedSettlement.set(null)">
              <span class="material-icons-round">close</span>
            </button>
          </div>

          <div class="detail-info-grid">
            <div class="detail-item"><span>Trade ID</span><code style="color:var(--accent-cyan)">{{ selectedSettlement()!.id }}</code></div>
            <div class="detail-item"><span>Status</span><span class="badge" [ngClass]="statusBadge(selectedSettlement()!.status)">{{ selectedSettlement()!.status }}</span></div>
            <div class="detail-item"><span>Bond</span><strong>{{ selectedSettlement()!.bond }}</strong></div>
            <div class="detail-item"><span>ISIN</span><code>{{ selectedSettlement()!.isin }}</code></div>
            <div class="detail-item"><span>Side</span><span class="side-badge" [ngClass]="selectedSettlement()!.side === 'BUY' ? 'buy' : 'sell'">{{ selectedSettlement()!.side }}</span></div>
            <div class="detail-item"><span>Quantity</span><strong>{{ selectedSettlement()!.qty | number }}</strong></div>
            <div class="detail-item"><span>Price</span><strong>{{ selectedSettlement()!.price }}</strong></div>
            <div class="detail-item"><span>Value</span><strong>SAR {{ selectedSettlement()!.value | number:'1.0-0' }}</strong></div>
            <div class="detail-item"><span>Counterparty</span><strong>{{ selectedSettlement()!.counterparty }}</strong></div>
            <div class="detail-item"><span>Trade Date</span><strong>{{ selectedSettlement()!.tradeDate }}</strong></div>
            <div class="detail-item"><span>Settlement Date</span><strong style="color:var(--accent-cyan)">{{ selectedSettlement()!.settlementDate }}</strong></div>
          </div>

          <div class="timeline-section">
            <h4 style="margin-bottom:14px;font-size:13px">Settlement Timeline</h4>
            @for (step of settlSteps; track step.label) {
              <div class="timeline-step" [class.done]="step.done" [class.active]="step.active">
                <div class="ts-dot"></div>
                <div class="ts-content">
                  <strong>{{ step.label }}</strong>
                  <small>{{ step.time }}</small>
                </div>
              </div>
            }
          </div>

          @if (selectedSettlement()!.status === 'Pending') {
            <div style="display:flex;gap:10px;margin-top:16px">
              <button class="btn btn-success" style="flex:1;justify-content:center">
                <span class="material-icons-round">check</span> Confirm Settlement
              </button>
              <button class="btn btn-danger" style="flex:1;justify-content:center">
                <span class="material-icons-round">close</span> Mark Failed
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .settlement-page { position: relative; }

    .selected-row { background: rgba(0,212,255,0.05) !important; }

    .toolbar { display: flex; align-items: center; gap: 12px; }

    .side-badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; &.buy { background: rgba(46,213,115,0.15); color: var(--success); } &.sell { background: rgba(255,71,87,0.15); color: var(--danger); } }

    .detail-drawer {
      position: fixed; right: 24px; top: 100px; width: 380px; max-height: calc(100vh - 140px);
      overflow-y: auto; z-index: 100; border: 1px solid var(--accent-cyan);
      box-shadow: -4px 0 30px rgba(0,212,255,0.1);
    }

    .detail-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }

    .detail-item { display: flex; flex-direction: column; gap: 4px; span:first-child { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; } strong, code { font-size: 13px; } }

    .timeline-section { border-top: 1px solid var(--border); padding-top: 16px; }

    .timeline-step { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-left: 2px solid var(--border); margin-left: 8px; padding-left: 16px; position: relative;
      &.done { border-left-color: var(--success); .ts-dot { background: var(--success); } }
      &.active { border-left-color: var(--accent-cyan); .ts-dot { background: var(--accent-cyan); box-shadow: 0 0 8px rgba(0,212,255,0.5); } }
    }

    .ts-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border); position: absolute; left: -6px; top: 14px; }

    .ts-content { strong { display: block; font-size: 13px; } small { font-size: 11px; color: var(--text-secondary); } }
  `],
})
export class SettlementComponent {
  activeTab = signal('Pending T+1');
  selectedSettlement = signal<any>(null);

  tabs = ['Pending T+1', 'In Progress', 'Settled', 'Failed', 'All'];

  settlStats = [
    { label: 'Pending T+1', value: '34', icon: 'pending', iconBg: 'rgba(255,193,7,0.1)', iconColor: 'var(--warning)', color: 'var(--warning)' },
    { label: 'In Progress', value: '12', icon: 'sync', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' },
    { label: 'Settled Today', value: '89', icon: 'task_alt', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)', color: 'var(--success)' },
    { label: 'Failed', value: '2', icon: 'error', iconBg: 'rgba(255,71,87,0.1)', iconColor: 'var(--danger)', color: 'var(--danger)' },
    { label: 'Total Value', value: 'SAR 1.4B', icon: 'payments', iconBg: 'rgba(124,77,255,0.1)', iconColor: 'var(--accent-purple)', color: 'var(--text-primary)' },
  ];

  settlements = [
    { id: 'TRD-20240415-001', bond: 'Saudi Govt. Bond 2029', issuer: 'Ministry of Finance', isin: 'SA1230001234', side: 'BUY', qty: 5000, price: '101.45', value: 507250, counterparty: 'Riyad Capital', tradeDate: 'Apr 15, 2024', settlementDate: 'Apr 16, 2024', status: 'Pending' },
    { id: 'TRD-20240415-002', bond: 'Saudi Aramco Sukuk', issuer: 'Saudi Aramco', isin: 'SA2340015678', side: 'SELL', qty: 2000, price: '99.82', value: 199640, counterparty: 'Al Rajhi Capital', tradeDate: 'Apr 15, 2024', settlementDate: 'Apr 16, 2024', status: 'Pending' },
    { id: 'TRD-20240415-003', bond: 'SABIC Corporate Bond', issuer: 'SABIC', isin: 'SA3450029012', side: 'BUY', qty: 3000, price: '100.75', value: 302250, counterparty: 'NCB Capital', tradeDate: 'Apr 15, 2024', settlementDate: 'Apr 16, 2024', status: 'Processing' },
    { id: 'TRD-20240414-021', bond: 'Abu Dhabi Govt. Bond', issuer: 'Emirate of Abu Dhabi', isin: 'AE0040012345', side: 'BUY', qty: 8000, price: '98.60', value: 788800, counterparty: 'Emirates NBD Sec.', tradeDate: 'Apr 14, 2024', settlementDate: 'Apr 15, 2024', status: 'Settled' },
    { id: 'TRD-20240414-019', bond: 'Qatar National Bank Bond', issuer: 'QNB Group', isin: 'QA0060034567', side: 'SELL', qty: 1500, price: '101.25', value: 151875, counterparty: 'QInvest', tradeDate: 'Apr 14, 2024', settlementDate: 'Apr 15, 2024', status: 'Settled' },
    { id: 'TRD-20240413-014', bond: 'NCB Capital Sukuk', issuer: 'NCB Capital', isin: 'SA0070045678', side: 'BUY', qty: 4000, price: '99.95', value: 399800, counterparty: 'Aljazira Capital', tradeDate: 'Apr 13, 2024', settlementDate: 'Apr 14, 2024', status: 'Failed' },
  ];

  settlSteps = [
    { label: 'Trade Executed', time: 'Apr 15, 2024 · 10:32:07', done: true, active: false },
    { label: 'Trade Confirmed', time: 'Apr 15, 2024 · 10:33:15', done: true, active: false },
    { label: 'CSD Notification Sent', time: 'Apr 15, 2024 · 10:35:00', done: true, active: false },
    { label: 'Counterparty Confirmation', time: 'Waiting...', done: false, active: true },
    { label: 'Securities Delivery (T+1)', time: 'Apr 16, 2024', done: false, active: false },
    { label: 'Cash Settlement', time: 'Apr 16, 2024', done: false, active: false },
  ];

  filteredSettlements() {
    const tab = this.activeTab();
    if (tab === 'All') return this.settlements;
    if (tab === 'Pending T+1') return this.settlements.filter(s => s.status === 'Pending');
    if (tab === 'In Progress') return this.settlements.filter(s => s.status === 'Processing');
    if (tab === 'Settled') return this.settlements.filter(s => s.status === 'Settled');
    if (tab === 'Failed') return this.settlements.filter(s => s.status === 'Failed');
    return this.settlements;
  }

  statusBadge(s: string) { return { 'badge-warning': s === 'Pending', 'badge-info': s === 'Processing', 'badge-success': s === 'Settled', 'badge-danger': s === 'Failed' }; }
}
