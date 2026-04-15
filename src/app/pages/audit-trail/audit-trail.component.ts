import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="audit-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Audit Trail</h2>
          <p>Immutable log of every action — tamper-proof and cryptographically signed</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-node">Node.js</span>
          <div class="integrity-badge">
            <span class="material-icons-round">verified</span>
            Log Integrity: <strong>Verified</strong>
          </div>
          <button class="btn btn-secondary"><span class="material-icons-round">file_download</span> Export Logs</button>
          <button class="btn btn-secondary"><span class="material-icons-round">refresh</span> Refresh</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px">
        @for (s of auditStats; track s.label) {
          <div class="stat-card" style="padding:14px">
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" style="font-size:20px" [style.color]="s.color">{{ s.value }}</div>
          </div>
        }
      </div>

      <!-- Filters -->
      <div class="filter-bar card" style="margin-bottom:16px;padding:14px 18px">
        <div class="search-bar" style="flex:1">
          <span class="material-icons-round search-icon">search</span>
          <input class="form-control" style="width:100%;padding-left:36px" placeholder="Search by user, action, entity, IP address..." [(ngModel)]="searchTerm" name="as"/>
        </div>
        <select class="form-control form-select" style="width:160px" [(ngModel)]="categoryFilter" name="cat">
          <option value="">All Categories</option>
          <option>Auth</option>
          <option>Trade</option>
          <option>KYC</option>
          <option>Admin</option>
          <option>AML</option>
          <option>Settlement</option>
          <option>Wallet</option>
          <option>Scheduler</option>
        </select>
        <select class="form-control form-select" style="width:140px" [(ngModel)]="severityFilter" name="sev">
          <option value="">All Severity</option>
          <option>Info</option>
          <option>Warning</option>
          <option>Critical</option>
        </select>
        <div class="date-range">
          <input class="form-control" type="date" style="width:145px" name="fd"/>
          <span style="color:var(--text-muted)">→</span>
          <input class="form-control" type="date" style="width:145px" name="td"/>
        </div>
        <button class="btn btn-primary btn-sm">Apply</button>
      </div>

      <!-- Log Table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div class="log-header-row">
          <div class="log-header-info">
            <span class="material-icons-round" style="color:var(--accent-cyan)">lock</span>
            <span>All logs are cryptographically signed and stored immutably. Hash chain verified.</span>
          </div>
          <div class="hash-display">
            Last Block Hash: <code>{{ blockHash }}</code>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Timestamp</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Action</th>
              <th>User</th>
              <th>Entity / Resource</th>
              <th>IP Address</th>
              <th>Result</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            @for (log of filteredLogs(); track log.id) {
              <tr (click)="selectedLog.set(log)" [class.selected-row]="selectedLog()?.id === log.id">
                <td style="color:var(--text-muted);font-size:11px;font-variant-numeric:tabular-nums">{{ log.id }}</td>
                <td>
                  <div style="font-size:12px;color:var(--text-primary);font-variant-numeric:tabular-nums">{{ log.date }}</div>
                  <div style="font-size:10px;color:var(--text-muted)">{{ log.time }}</div>
                </td>
                <td>
                  <span class="severity-badge" [ngClass]="severityClass(log.severity)">
                    <span class="material-icons-round" style="font-size:12px">{{ severityIcon(log.severity) }}</span>
                    {{ log.severity }}
                  </span>
                </td>
                <td>
                  <span class="category-badge" [ngClass]="'cat-' + log.category.toLowerCase()">{{ log.category }}</span>
                </td>
                <td style="font-size:13px;font-weight:500">{{ log.action }}</td>
                <td>
                  <div style="font-size:12px;font-weight:600">{{ log.user }}</div>
                  <div style="font-size:10px;color:var(--text-muted)">{{ log.userId }}</div>
                </td>
                <td style="font-size:12px;color:var(--text-secondary)">{{ log.entity }}</td>
                <td style="font-size:11px;font-family:monospace;color:var(--text-secondary)">{{ log.ip }}</td>
                <td>
                  <span class="result-badge" [ngClass]="log.result === 'Success' ? 'badge-success' : 'badge-danger'">{{ log.result }}</span>
                </td>
                <td>
                  <code style="font-size:9px;color:var(--text-muted)">{{ log.hash }}</code>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <span class="text-muted">Showing {{ filteredLogs().length }} of 128,472 total log entries</span>
          <div class="pagination" style="display:flex;gap:6px">
            @for (p of [1,2,3,'...',127]; track p) {
              <button class="btn btn-secondary btn-sm" [class.active]="p === 1">{{ p }}</button>
            }
          </div>
        </div>
      </div>

      <!-- Log Detail Panel -->
      @if (selectedLog()) {
        <div class="log-detail-panel card fade-in">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h4>Log Entry Detail — #{{ selectedLog()!.id }}</h4>
            <button class="btn btn-icon" (click)="selectedLog.set(null)"><span class="material-icons-round">close</span></button>
          </div>
          <div class="log-detail-grid">
            <div class="ld-item"><span>Timestamp</span><strong>{{ selectedLog()!.date }} {{ selectedLog()!.time }}</strong></div>
            <div class="ld-item"><span>Severity</span><span class="severity-badge" [ngClass]="severityClass(selectedLog()!.severity)">{{ selectedLog()!.severity }}</span></div>
            <div class="ld-item"><span>Category</span><span class="category-badge" [ngClass]="'cat-' + selectedLog()!.category.toLowerCase()">{{ selectedLog()!.category }}</span></div>
            <div class="ld-item"><span>Action</span><strong>{{ selectedLog()!.action }}</strong></div>
            <div class="ld-item"><span>User</span><strong>{{ selectedLog()!.user }}</strong></div>
            <div class="ld-item"><span>User ID</span><code>{{ selectedLog()!.userId }}</code></div>
            <div class="ld-item"><span>Entity</span><strong>{{ selectedLog()!.entity }}</strong></div>
            <div class="ld-item"><span>IP Address</span><code>{{ selectedLog()!.ip }}</code></div>
            <div class="ld-item"><span>Result</span><span class="result-badge" [ngClass]="selectedLog()!.result === 'Success' ? 'badge-success' : 'badge-danger'">{{ selectedLog()!.result }}</span></div>
            <div class="ld-item" style="grid-column:1/-1"><span>Entry Hash (SHA-256)</span><code style="font-size:11px;word-break:break-all;color:var(--accent-cyan)">{{ selectedLog()!.fullHash }}</code></div>
            <div class="ld-item" style="grid-column:1/-1"><span>Previous Entry Hash</span><code style="font-size:11px;word-break:break-all">{{ selectedLog()!.prevHash }}</code></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .filter-bar { display: flex; align-items: center; gap: 12px; }

    .integrity-badge {
      display: flex; align-items: center; gap: 6px; padding: 6px 14px;
      background: rgba(46,213,115,0.08); border: 1px solid rgba(46,213,115,0.25);
      border-radius: 20px; font-size: 12px; color: var(--text-secondary);
      .material-icons-round { font-size: 16px; color: var(--success); }
      strong { color: var(--success); }
    }

    .date-range { display: flex; align-items: center; gap: 8px; }

    .log-header-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; background: rgba(0,212,255,0.04); border-bottom: 1px solid rgba(0,212,255,0.15);
      font-size: 12px; color: var(--text-secondary);

      .log-header-info { display: flex; align-items: center; gap: 8px; }
      .material-icons-round { font-size: 16px; }
    }

    .hash-display { font-size: 11px; color: var(--text-muted); code { color: var(--accent-cyan); font-size: 10px; } }

    .selected-row { background: rgba(0,212,255,0.04) !important; }

    .severity-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
    .sev-info     { background: rgba(0,212,255,0.12); color: var(--accent-cyan); }
    .sev-warning  { background: rgba(255,165,2,0.12); color: var(--warning); }
    .sev-critical { background: rgba(255,71,87,0.12); color: var(--danger); }

    .category-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .cat-auth       { background: rgba(124,77,255,0.12); color: var(--accent-purple); }
    .cat-trade      { background: rgba(0,212,255,0.12);  color: var(--accent-cyan); }
    .cat-kyc        { background: rgba(0,230,118,0.12);  color: var(--success); }
    .cat-admin      { background: rgba(23,195,178,0.12); color: var(--accent-teal); }
    .cat-aml        { background: rgba(255,71,87,0.12);  color: var(--danger); }
    .cat-settlement { background: rgba(255,193,7,0.12);  color: var(--warning); }
    .cat-wallet     { background: rgba(0,212,255,0.1);   color: var(--accent-cyan); }
    .cat-scheduler  { background: rgba(124,77,255,0.1);  color: var(--accent-purple); }

    .result-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }

    .log-detail-panel {
      position: fixed; bottom: 24px; right: 24px; width: 600px;
      z-index: 100; border-color: var(--accent-cyan); padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }

    .log-detail-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }

    .ld-item { display: flex; flex-direction: column; gap: 4px; span:first-child { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; } strong, code { font-size: 12px; } }

    .btn.active { background: rgba(0,212,255,0.1); color: var(--accent-cyan); border-color: var(--accent-cyan); }
    .pagination { display: flex; gap: 6px; }
  `],
})
export class AuditTrailComponent {
  searchTerm = '';
  categoryFilter = '';
  severityFilter = '';
  selectedLog = signal<any>(null);
  blockHash = '0x3f9a2b8c...d4e71f02';

  auditStats = [
    { label: 'Total Log Entries', value: '128,472', color: 'var(--text-primary)' },
    { label: 'Today\'s Events', value: '2,841', color: 'var(--accent-cyan)' },
    { label: 'Critical Events', value: '3', color: 'var(--danger)' },
    { label: 'Failed Actions', value: '12', color: 'var(--warning)' },
    { label: 'Active Sessions', value: '847', color: 'var(--success)' },
  ];

  logs = [
    { id: 128472, date: 'Apr 15, 2024', time: '14:32:07.124', severity: 'Info', category: 'Trade', action: 'BUY Order Executed', user: 'Mohammed Al-Rashid', userId: 'USR-0001', entity: 'Order #TRD-001 · SA1230001234', ip: '192.168.1.42', result: 'Success', hash: '3f9a2b8c...', fullHash: '3f9a2b8cd4e71f02a8b3c94d05e61f73a9b2c8d4e5f61a73b2c9d0e4f15a627b', prevHash: '2a8b1c7d...e3f60e01' },
    { id: 128471, date: 'Apr 15, 2024', time: '14:30:15.882', severity: 'Critical', category: 'AML', action: 'High Risk Alert Triggered', user: 'System', userId: 'SYS', entity: 'User #8821 · Pattern: Structuring', ip: '10.0.0.1', result: 'Success', hash: '2e8b1c7d...', fullHash: '2e8b1c7da3e60e01f7b2c8d94e05f61a73b9c2d8e4f50a62b1c9d7e3f14a820b', prevHash: '1d7a0b6c...d2e50f00' },
    { id: 128470, date: 'Apr 15, 2024', time: '14:28:44.391', severity: 'Info', category: 'KYC', action: 'User KYC Approved', user: 'Admin: Ahmed Hassan', userId: 'ADM-001', entity: 'User: Khalid Al-Mutairi (#USR-0003)', ip: '10.0.0.5', result: 'Success', hash: '1d7a0b6c...', fullHash: '1d7a0b6cd2e50f00e6a1b7c83d04e50f62a8b1c7d3e4f59a60b2c8d7e2f13a71', prevHash: '0c6940b5...c1d40e9f' },
    { id: 128469, date: 'Apr 15, 2024', time: '14:25:12.007', severity: 'Warning', category: 'Auth', action: 'Failed Login Attempt (3rd)', user: 'Unknown', userId: 'N/A', entity: 'Account: omar@example.com', ip: '185.234.12.88', result: 'Failure', hash: '0c694ab5...', fullHash: '0c6940b5c1d40e9fe5f0a6b72c03d4fe61a7b0c6d2e3f48a59b1c7d6e1f12a60', prevHash: 'fb583940...b0c3fe8e' },
    { id: 128468, date: 'Apr 15, 2024', time: '14:22:55.613', severity: 'Info', category: 'Wallet', action: 'Deposit Completed', user: 'Fatima Al-Zahrani', userId: 'USR-0002', entity: 'Wallet · SAR 500,000 · SADAD', ip: '10.0.1.22', result: 'Success', hash: 'fb583940...', fullHash: 'fb583940b0c3fe8ed4ef5a6b71c02d3fd60a6b9c5d1e2f37a48b0c6e5f01a49', prevHash: 'ea472830...af2bed7d' },
    { id: 128467, date: 'Apr 15, 2024', time: '14:18:30.219', severity: 'Info', category: 'Settlement', action: 'T+1 Settlement Confirmed', user: 'System', userId: 'SYS', entity: 'Trade #TRD-20240414-021', ip: '10.0.0.1', result: 'Success', hash: 'ea472830...', fullHash: 'ea472830af2bed7dc3de4a5b60b01c2ec59a5b8c4d0e1f26a37b9c5e4f00a38', prevHash: 'd9361720...9e1adc6c' },
    { id: 128466, date: 'Apr 15, 2024', time: '14:05:01.444', severity: 'Info', category: 'Scheduler', action: 'Coupon Calculation Job Completed', user: 'System', userId: 'SCH', entity: 'CPN-JOB-042 · 12 bonds · SAR 1.2M', ip: '10.0.0.2', result: 'Success', hash: 'd9361720...', fullHash: 'd9361720af2bed7dc3de4a5b60b01c2ec59a5b8c4d0e1f26a37b9c5e4f00a38', prevHash: 'c8250610...8d09cb5b' },
  ];

  filteredLogs() {
    return this.logs.filter(l =>
      (!this.searchTerm || l.action.toLowerCase().includes(this.searchTerm.toLowerCase()) || l.user.toLowerCase().includes(this.searchTerm.toLowerCase())) &&
      (!this.categoryFilter || l.category === this.categoryFilter) &&
      (!this.severityFilter || l.severity === this.severityFilter)
    );
  }

  severityClass(s: string) { return { 'sev-info': s === 'Info', 'sev-warning': s === 'Warning', 'sev-critical': s === 'Critical' }; }
  severityIcon(s: string) { return { Info: 'info', Warning: 'warning', Critical: 'error' }[s] || 'info'; }
}
