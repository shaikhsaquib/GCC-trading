import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.css',
})
export class WalletComponent {
  activeAction = signal('deposit');
  selectedMethod = signal('bank');
  txFilter = signal('All');
  depositAmount = 0;
  withdrawAmount = 0;
  Math = Math;

  txFilters = ['All', 'Deposits', 'Withdrawals', 'Trades', 'Coupons'];

  subBalances = [
    { label: 'Available Cash', amount: 'SAR 248,320', icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)' },
    { label: 'Invested', amount: 'SAR 920,000', icon: 'trending_up', iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)' },
    { label: 'Pending', amount: 'SAR 116,180', icon: 'pending', iconBg: 'rgba(255,193,7,0.1)', iconColor: 'var(--warning)' },
    { label: 'Coupon Income', amount: 'SAR 48,200', icon: 'payments', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)' },
  ];

  paymentMethods = [
    { id: 'bank', icon: 'account_balance', label: 'Bank Transfer (SADAD)', desc: 'Instant · Free', color: 'var(--accent-cyan)' },
    { id: 'mada', icon: 'credit_card', label: 'Mada Card', desc: 'Instant · 0.5% fee', color: 'var(--accent-teal)' },
    { id: 'stc', icon: 'phone_android', label: 'STC Pay', desc: 'Instant · Free', color: 'var(--accent-purple)' },
  ];

  transactions = [
    { id: 1, icon: 'add_circle', iconBg: 'rgba(46,213,115,0.12)', iconColor: 'var(--success)', desc: 'Bank Transfer Deposit', ref: 'TXN-20240415-001', date: 'Apr 15, 2024', status: 'Completed', amount: 500000 },
    { id: 2, icon: 'swap_horiz', iconBg: 'rgba(124,77,255,0.12)', iconColor: 'var(--accent-purple)', desc: 'Bond Purchase — ISIN SA123456789', ref: 'TRD-20240415-042', date: 'Apr 15, 2024', status: 'Completed', amount: -250000 },
    { id: 3, icon: 'payments', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)', desc: 'Coupon Payment Received', ref: 'CPN-20240410-018', date: 'Apr 10, 2024', status: 'Completed', amount: 12500 },
    { id: 4, icon: 'remove_circle', iconBg: 'rgba(255,71,87,0.12)', iconColor: 'var(--danger)', desc: 'Withdrawal to Al Rajhi Bank', ref: 'WDR-20240408-007', date: 'Apr 8, 2024', status: 'Processing', amount: -100000 },
    { id: 5, icon: 'swap_horiz', iconBg: 'rgba(124,77,255,0.12)', iconColor: 'var(--accent-purple)', desc: 'Bond Sale — ISIN SA987654321', ref: 'TRD-20240406-031', date: 'Apr 6, 2024', status: 'Completed', amount: 185000 },
    { id: 6, icon: 'add_circle', iconBg: 'rgba(46,213,115,0.12)', iconColor: 'var(--success)', desc: 'SADAD Payment Received', ref: 'TXN-20240402-012', date: 'Apr 2, 2024', status: 'Completed', amount: 300000 },
    { id: 7, icon: 'payments', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)', desc: 'Maturity Payment — ISIN SA000000001', ref: 'MAT-20240401-003', date: 'Apr 1, 2024', status: 'Completed', amount: 500000 },
  ];

  chartPath = 'M0,80 C20,75 40,65 60,60 S90,45 120,40 S150,30 180,25 S210,20 240,22 S270,18 300,15 L300,100 L0,100 Z';
  chartLine = 'M0,80 C20,75 40,65 60,60 S90,45 120,40 S150,30 180,25 S210,20 240,22 S270,18 300,15';

  txStatusBadge(s: string) { return { 'badge-success': s === 'Completed', 'badge-warning': s === 'Processing', 'badge-danger': s === 'Failed' }; }
}
