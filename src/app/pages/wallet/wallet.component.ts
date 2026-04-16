import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';
import { WalletBalance, WalletTransaction } from '../../core/models/api.models';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.css',
})
export class WalletComponent implements OnInit {
  private readonly walletSvc = inject(WalletService);

  activeAction   = signal('deposit');
  selectedMethod = signal('bank');
  txFilter       = signal('All');
  depositAmount  = 0;
  withdrawAmount = 0;
  Math = Math;

  loading    = signal(true);
  txLoading  = signal(true);
  error      = signal<string | null>(null);
  submitting = signal(false);

  private _rawTx = signal<WalletTransaction[]>([]);

  txFilters = ['All', 'Deposits', 'Withdrawals', 'Trades', 'Coupons'];

  paymentMethods = [
    { id: 'bank', icon: 'account_balance', label: 'Bank Transfer (SADAD)', desc: 'Instant · Free',    color: 'var(--accent-cyan)' },
    { id: 'mada', icon: 'credit_card',     label: 'Mada Card',              desc: 'Instant · 0.5% fee', color: 'var(--accent-teal)' },
    { id: 'stc',  icon: 'phone_android',   label: 'STC Pay',                desc: 'Instant · Free',    color: 'var(--accent-purple)' },
  ];

  subBalances = [
    { label: 'Available Cash',   amount: '—', icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.1)',  iconColor: 'var(--accent-cyan)' },
    { label: 'Total Balance',    amount: '—', icon: 'trending_up',            iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)' },
    { label: 'Frozen / Pending', amount: '—', icon: 'pending',                iconBg: 'rgba(255,193,7,0.1)',  iconColor: 'var(--warning)' },
    { label: 'Coupon Income',    amount: '—', icon: 'payments',               iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)' },
  ];

  chartPath = 'M0,80 C20,75 40,65 60,60 S90,45 120,40 S150,30 180,25 S210,20 240,22 S270,18 300,15 L300,100 L0,100 Z';
  chartLine = 'M0,80 C20,75 40,65 60,60 S90,45 120,40 S150,30 180,25 S210,20 240,22 S270,18 300,15';

  // Reactive getter — re-evaluates whenever txFilter() or _rawTx() change
  get transactions() {
    const filter = this.txFilter();
    return this._rawTx()
      .filter(tx => this.matchesFilter(tx, filter))
      .map(tx => this.mapTx(tx));
  }

  ngOnInit() {
    this.loadBalance();
    this.loadTransactions();
  }

  private loadBalance() {
    this.walletSvc.getBalance().subscribe({
      next: (b: WalletBalance) => {
        this.loading.set(false);
        const fmt = (n: number) => `${b.currency} ${n.toLocaleString()}`;
        this.subBalances = [
          { label: 'Available Cash',   amount: fmt(b.availableBalance), icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.1)',  iconColor: 'var(--accent-cyan)' },
          { label: 'Total Balance',    amount: fmt(b.balance),          icon: 'trending_up',            iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)' },
          { label: 'Frozen / Pending', amount: fmt(b.frozenBalance),    icon: 'pending',                iconBg: 'rgba(255,193,7,0.1)',  iconColor: 'var(--warning)' },
          { label: 'Currency',         amount: b.currency,              icon: 'payments',               iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)' },
        ];
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTransactions() {
    this.walletSvc.getTransactions().subscribe({
      next: res => {
        this._rawTx.set(res.data ?? []);
        this.txLoading.set(false);
      },
      error: () => this.txLoading.set(false),
    });
  }

  submitDeposit() {
    if (this.depositAmount <= 0) return;
    this.submitting.set(true);
    this.error.set(null);
    this.walletSvc.deposit(this.depositAmount, 'SAR', this.selectedMethod()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.depositAmount = 0;
        this.loadBalance();
        this.loadTransactions();
      },
      error: err => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Deposit failed. Please try again.');
      },
    });
  }

  submitWithdraw() {
    if (this.withdrawAmount <= 0) return;
    this.submitting.set(true);
    this.error.set(null);
    this.walletSvc.withdraw(this.withdrawAmount, 'SAR', '', '').subscribe({
      next: () => {
        this.submitting.set(false);
        this.withdrawAmount = 0;
        this.loadBalance();
        this.loadTransactions();
      },
      error: err => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Withdrawal failed. Please try again.');
      },
    });
  }

  private matchesFilter(tx: WalletTransaction, filter: string): boolean {
    if (filter === 'All')         return true;
    if (filter === 'Deposits')    return tx.type === 'CREDIT';
    if (filter === 'Withdrawals') return tx.type === 'DEBIT';
    if (filter === 'Trades')      return tx.type === 'SETTLEMENT_CREDIT' || tx.type === 'SETTLEMENT_DEBIT';
    if (filter === 'Coupons')     return tx.type === 'COUPON';
    return true;
  }

  private mapTx(tx: WalletTransaction) {
    const amount = parseFloat(tx.amount);
    const isDebit = tx.type === 'DEBIT' || tx.type === 'SETTLEMENT_DEBIT' || tx.type === 'FREEZE';
    const styleMap: Record<string, { icon: string; bg: string; color: string }> = {
      CREDIT:            { icon: 'add_circle',    bg: 'rgba(46,213,115,0.12)',  color: 'var(--success)' },
      DEBIT:             { icon: 'remove_circle', bg: 'rgba(255,71,87,0.12)',   color: 'var(--danger)' },
      COUPON:            { icon: 'payments',      bg: 'rgba(0,212,255,0.12)',   color: 'var(--accent-cyan)' },
      SETTLEMENT_CREDIT: { icon: 'task_alt',      bg: 'rgba(46,213,115,0.12)', color: 'var(--success)' },
      SETTLEMENT_DEBIT:  { icon: 'swap_horiz',    bg: 'rgba(124,77,255,0.12)', color: 'var(--accent-purple)' },
      FREEZE:            { icon: 'lock',          bg: 'rgba(255,193,7,0.12)',   color: 'var(--warning)' },
      UNFREEZE:          { icon: 'lock_open',     bg: 'rgba(23,195,178,0.12)', color: 'var(--accent-teal)' },
    };
    const style = styleMap[tx.type] ?? { icon: 'receipt', bg: 'rgba(0,212,255,0.12)', color: 'var(--accent-cyan)' };
    return {
      id:        tx.id,
      icon:      style.icon,
      iconBg:    style.bg,
      iconColor: style.color,
      desc:      tx.description,
      ref:       tx.reference_id ?? tx.idempotency_key,
      date:      new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status:    this.mapStatus(tx.status),
      amount:    isDebit ? -Math.abs(amount) : Math.abs(amount),
    };
  }

  private mapStatus(s: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'Completed', PENDING: 'Processing',
      PROCESSING: 'Processing', FAILED: 'Failed', REVERSED: 'Failed',
    };
    return map[s] ?? s;
  }

  txStatusBadge(s: string) {
    return { 'badge-success': s === 'Completed', 'badge-warning': s === 'Processing', 'badge-danger': s === 'Failed' };
  }
}
