import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-aml-compliance',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './aml-compliance.component.html',
  styleUrl: './aml-compliance.component.css',
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
