import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AmlService } from '../../services/aml.service';
import { AmlAlert } from '../../core/models/api.models';

interface AlertDisplay {
  id:         string;
  risk:       string;
  title:      string;
  desc:       string;
  user:       string;
  amount:     number;
  currency:   string;
  time:       string;
  status:     string;
  rules:      string[];
  txHistory:  Array<{ date: string; type: string; amount: number; status: string }>;
}

@Component({
  selector: 'app-aml-compliance',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './aml-compliance.component.html',
  styleUrl: './aml-compliance.component.css',
})
export class AmlComplianceComponent implements OnInit {
  private readonly amlSvc = inject(AmlService);

  alertFilter   = signal('All');
  selectedAlert = signal<AlertDisplay | null>(null);
  loading       = signal(true);
  Math          = Math;

  alertFilters = ['All', 'High', 'Medium', 'Low'];

  amlStats = [
    { label: 'Total Alerts',   value: '—', color: 'var(--text-primary)' },
    { label: 'High Risk',      value: '—', color: 'var(--danger)' },
    { label: 'Medium Risk',    value: '—', color: 'var(--warning)' },
    { label: 'Low Risk',       value: '—', color: 'var(--success)' },
    { label: 'Open Cases',     value: '—', color: 'var(--accent-cyan)' },
    { label: 'SARs Filed (YTD)', value: '—', color: 'var(--accent-purple)' },
  ];

  riskDist = [
    { label: 'Critical', color: '#ff2d4b', count: 0, pct: 2 },
    { label: 'High',     color: '#ff4757', count: 0, pct: 8 },
    { label: 'Medium',   color: '#ffa502', count: 0, pct: 35 },
    { label: 'Low',      color: '#2ed573', count: 0, pct: 100 },
  ];

  private _alerts = signal<AlertDisplay[]>([]);

  get alerts() { return this._alerts(); }

  ngOnInit() {
    this.loadAlerts();
  }

  private loadAlerts() {
    this.amlSvc.getAlerts(undefined, 100).subscribe({
      next: res => {
        this.loading.set(false);
        const items = res.data ?? [];
        this._alerts.set(items.map(a => this.mapAlert(a)));
        this.updateStats(items);
        this.updateRiskDist(items);
      },
      error: () => this.loading.set(false),
    });
  }

  private mapAlert(a: AmlAlert): AlertDisplay {
    return {
      id:       a.id,
      risk:     a.severity.toUpperCase(),
      title:    this.titleFromRule(a.ruleCode),
      desc:     a.description,
      user:     `User #${a.userId.slice(0, 6)}`,
      amount:   a.amount,
      currency: a.currency,
      time:     this.relativeTime(a.createdAt),
      status:   this.mapStatus(a.status),
      rules:    [a.ruleCode],
      txHistory: [],
    };
  }

  private titleFromRule(code: string): string {
    const map: Record<string, string> = {
      STRUCTURING:        'Large Cash Deposit Pattern',
      SANCTIONS_MATCH:    'Sanctions List Match',
      RAPID_MOVEMENT:     'Rapid In-Out Transactions',
      VOLUME_SPIKE:       'Unusual Trading Volume Spike',
      NEW_ACCOUNT_LARGE:  'New User Large Transaction',
      VELOCITY_EXCEEDED:  'Velocity Threshold Exceeded',
      PEP_MATCH:          'Politically Exposed Person Match',
    };
    return map[code] ?? code.replace(/_/g, ' ');
  }

  private mapStatus(s: string): string {
    const map: Record<string, string> = {
      Open: 'Open', UnderReview: 'Under Review',
      Escalated: 'Under Review', Cleared: 'Cleared', SarFiled: 'SAR Filed',
    };
    return map[s] ?? s;
  }

  private relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }

  private updateStats(alerts: AmlAlert[]) {
    const high   = alerts.filter(a => a.severity === 'High' || a.severity === 'Critical').length;
    const medium = alerts.filter(a => a.severity === 'Medium').length;
    const low    = alerts.filter(a => a.severity === 'Low').length;
    const open   = alerts.filter(a => a.status === 'Open' || a.status === 'UnderReview' || a.status === 'Escalated').length;
    const sars   = alerts.filter(a => a.status === 'SarFiled').length;
    this.amlStats = [
      { label: 'Total Alerts',    value: alerts.length.toString(), color: 'var(--text-primary)' },
      { label: 'High Risk',       value: high.toString(),          color: 'var(--danger)' },
      { label: 'Medium Risk',     value: medium.toString(),        color: 'var(--warning)' },
      { label: 'Low Risk',        value: low.toString(),           color: 'var(--success)' },
      { label: 'Open Cases',      value: open.toString(),          color: 'var(--accent-cyan)' },
      { label: 'SARs Filed (YTD)',value: sars.toString(),          color: 'var(--accent-purple)' },
    ];
  }

  private updateRiskDist(alerts: AmlAlert[]) {
    const total    = alerts.length || 1;
    const critical = alerts.filter(a => a.severity === 'Critical').length;
    const high     = alerts.filter(a => a.severity === 'High').length;
    const medium   = alerts.filter(a => a.severity === 'Medium').length;
    const low      = alerts.filter(a => a.severity === 'Low').length;
    this.riskDist = [
      { label: 'Critical', color: '#ff2d4b', count: critical, pct: Math.round((critical / total) * 100) },
      { label: 'High',     color: '#ff4757', count: high,     pct: Math.round((high     / total) * 100) },
      { label: 'Medium',   color: '#ffa502', count: medium,   pct: Math.round((medium   / total) * 100) },
      { label: 'Low',      color: '#2ed573', count: low,      pct: 100 },
    ];
  }

  filteredAlerts() {
    const f = this.alertFilter();
    if (f === 'All') return this._alerts();
    return this._alerts().filter(a => a.risk === f.toUpperCase() || a.risk === 'CRITICAL' && f === 'High');
  }

  updateAlertStatus(id: string, status: string, sarRef?: string) {
    this.amlSvc.updateAlert(id, status, sarRef).subscribe({
      next: () => {
        this._alerts.update(list =>
          list.map(a => a.id === id ? { ...a, status: this.mapStatus(status) } : a)
        );
        if (this.selectedAlert()?.id === id) {
          this.selectedAlert.update(a => a ? { ...a, status: this.mapStatus(status) } : a);
        }
      },
    });
  }

  alertDetailItems() {
    const a = this.selectedAlert();
    if (!a) return [];
    return [
      { label: 'Case ID',   value: a.id },
      { label: 'Status',    value: a.status },
      { label: 'User',      value: a.user },
      { label: 'Amount',    value: `${a.currency} ${a.amount.toLocaleString()}` },
      { label: 'Risk Level',value: a.risk },
      { label: 'Detected',  value: a.time },
    ];
  }

  riskBadge(risk: string) { return { 'risk-high': risk === 'HIGH' || risk === 'CRITICAL', 'risk-medium': risk === 'MEDIUM', 'risk-low': risk === 'LOW' }; }
  caseBadge(s: string)    { return { 'badge-warning': s === 'Open', 'badge-info': s === 'Under Review', 'badge-success': s === 'Cleared', 'badge-danger': s === 'SAR Filed' }; }
}
