import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { AuditEntry } from '../../core/models/api.models';

interface LogDisplay {
  id:       string;
  date:     string;
  time:     string;
  severity: string;
  category: string;
  action:   string;
  user:     string;
  userId:   string;
  entity:   string;
  ip:       string;
  result:   string;
  hash:     string;
  fullHash: string;
  prevHash: string;
}

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './audit-trail.component.html',
  styleUrl: './audit-trail.component.css',
})
export class AuditTrailComponent implements OnInit {
  private readonly adminSvc = inject(AdminService);

  searchTerm     = '';
  categoryFilter = '';
  severityFilter = '';
  selectedLog    = signal<LogDisplay | null>(null);
  loading        = signal(true);
  total          = signal(0);
  blockHash      = '—';

  auditStats = [
    { label: 'Total Log Entries', value: '—', color: 'var(--text-primary)' },
    { label: "Today's Events",    value: '—', color: 'var(--accent-cyan)' },
    { label: 'Critical Events',   value: '—', color: 'var(--danger)' },
    { label: 'Failed Actions',    value: '—', color: 'var(--warning)' },
    { label: 'Active Sessions',   value: '—', color: 'var(--success)' },
  ];

  private _logs = signal<LogDisplay[]>([]);

  ngOnInit() { this.loadLogs(); }

  private loadLogs(offset = 0) {
    this.loading.set(true);
    this.adminSvc.getAuditTrail({ limit: 50, offset }).subscribe({
      next: res => {
        this.loading.set(false);
        const entries = res.data?.data ?? [];
        this.total.set(res.data?.total ?? 0);
        this._logs.set(entries.map((e, i) => this.mapEntry(e, offset + i)));
        this.updateStats(entries, res.data?.total ?? 0);
        if (entries.length > 0) {
          this.blockHash = entries[0]._id.slice(-16);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private mapEntry(e: AuditEntry, idx: number): LogDisplay {
    const dt       = new Date(e.created_at);
    const category = this.categoryFromType(e.event_type);
    const severity = this.severityFromType(e.event_type, e.action);
    const result   = this.resultFromAction(e.action);
    return {
      id:       String(idx + 1),
      date:     dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      time:     dt.toTimeString().slice(0, 12),
      severity,
      category,
      action:   e.action,
      user:     e.actor_id ? (e.actor_id === 'SYSTEM' || e.actor_id === 'SYS' ? 'System' : `User #${e.actor_id.slice(0, 8)}`) : 'System',
      userId:   e.actor_id ?? 'SYS',
      entity:   e.target_type && e.target_id ? `${e.target_type}: ${e.target_id.slice(0, 12)}` : (e.target_type ?? '—'),
      ip:       e.ip_address ?? '—',
      result,
      hash:     e._id.slice(-8) + '...',
      fullHash: e._id,
      prevHash: '—',
    };
  }

  private categoryFromType(eventType: string): string {
    const t = (eventType ?? '').toUpperCase();
    if (t.startsWith('AUTH') || t.startsWith('LOGIN') || t.startsWith('REGISTER') || t.startsWith('PASSWORD') || t.startsWith('TWO_FA')) return 'Auth';
    if (t.startsWith('ORDER') || t.startsWith('TRADE'))   return 'Trade';
    if (t.startsWith('KYC'))                               return 'KYC';
    if (t.startsWith('AML'))                               return 'AML';
    if (t.startsWith('SETTLEMENT'))                        return 'Settlement';
    if (t.startsWith('WALLET') || t.startsWith('PAYMENT')) return 'Wallet';
    if (t.startsWith('SCHEDULE') || t.startsWith('CRON'))  return 'Scheduler';
    return 'Admin';
  }

  private severityFromType(eventType: string, action: string): string {
    const t = (eventType ?? '').toUpperCase();
    const a = (action    ?? '').toLowerCase();
    if (t.startsWith('AML') || t.includes('BREACH') || t.includes('SANCTION')) return 'Critical';
    if (a.includes('fail') || a.includes('error') || a.includes('reject') ||
        a.includes('deny')  || a.includes('invalid') || a.includes('lock'))  return 'Warning';
    return 'Info';
  }

  private resultFromAction(action: string): string {
    const a = (action ?? '').toLowerCase();
    if (a.includes('fail') || a.includes('error') || a.includes('reject') ||
        a.includes('deny')  || a.includes('invalid') || a.includes('block')) return 'Failure';
    return 'Success';
  }

  private updateStats(entries: AuditEntry[], total: number) {
    const today     = new Date().toDateString();
    const todayCount = entries.filter(e => new Date(e.created_at).toDateString() === today).length;
    const critical  = entries.filter(e => this.severityFromType(e.event_type, e.action) === 'Critical').length;
    const failed    = entries.filter(e => this.resultFromAction(e.action) === 'Failure').length;
    this.auditStats = [
      { label: 'Total Log Entries', value: total.toLocaleString(), color: 'var(--text-primary)' },
      { label: "Today's Events",    value: todayCount.toLocaleString(), color: 'var(--accent-cyan)' },
      { label: 'Critical Events',   value: critical.toString(), color: 'var(--danger)' },
      { label: 'Failed Actions',    value: failed.toString(), color: 'var(--warning)' },
      { label: 'Active Sessions',   value: '—', color: 'var(--success)' },
    ];
  }

  filteredLogs() {
    return this._logs().filter(l =>
      (!this.searchTerm    || l.action.toLowerCase().includes(this.searchTerm.toLowerCase()) || l.user.toLowerCase().includes(this.searchTerm.toLowerCase())) &&
      (!this.categoryFilter || l.category === this.categoryFilter) &&
      (!this.severityFilter || l.severity === this.severityFilter)
    );
  }

  severityClass(s: string) { return { 'sev-info': s === 'Info', 'sev-warning': s === 'Warning', 'sev-critical': s === 'Critical' }; }
  severityIcon(s: string)  { return ({ Info: 'info', Warning: 'warning', Critical: 'error' } as Record<string, string>)[s] ?? 'info'; }
}
