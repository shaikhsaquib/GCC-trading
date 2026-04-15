import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './audit-trail.component.html',
  styleUrl: './audit-trail.component.css',
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
