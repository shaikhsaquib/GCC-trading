import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settlement',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './settlement.component.html',
  styleUrl: './settlement.component.css',
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
