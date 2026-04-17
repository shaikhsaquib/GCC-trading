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

  activeAction   = signal<'deposit' | 'withdraw'>('deposit');
  selectedMethod = signal('bank');
  txFilter       = signal('All');
  page           = signal(1);
  readonly pageSize = 10;

  depositAmount  = 0;
  withdrawAmount = 0;
  searchTerm     = '';
  selectedBankIdx = 0;

  Math = Math;

  loading    = signal(true);
  txLoading  = signal(true);
  error      = signal<string | null>(null);
  success    = signal<string | null>(null);
  submitting = signal(false);
  apiError   = signal<string | null>(null);

  availableBalance = signal(0);
  totalBalance     = signal(0);
  frozenBalance    = signal(0);
  balanceCurrency  = signal('SAR');

  banks = [
    { name: 'Al Rajhi Bank', iban: 'SA0380000000608010167519' },
    { name: 'Riyad Bank',    iban: 'SA4620000001234567891234' },
  ];

  txFilters = ['All', 'Deposits', 'Withdrawals', 'Trades', 'Coupons'];

  paymentMethods = [
    { id: 'bank', icon: 'account_balance', label: 'Bank Transfer (SADAD)', desc: 'Instant · Free',     color: 'var(--accent-cyan)'   },
    { id: 'mada', icon: 'credit_card',     label: 'Mada Card',             desc: 'Instant · 0.5% fee', color: 'var(--accent-teal)'   },
    { id: 'stc',  icon: 'phone_android',   label: 'STC Pay',               desc: 'Instant · Free',     color: 'var(--accent-purple)' },
  ];

  subBalances = [
    { label: 'Available Cash',   amount: '—', icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.1)',  iconColor: 'var(--accent-cyan)'   },
    { label: 'Total Balance',    amount: '—', icon: 'trending_up',            iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)'   },
    { label: 'Frozen / Pending', amount: '—', icon: 'pending',                iconBg: 'rgba(255,193,7,0.1)',  iconColor: 'var(--warning)'       },
    { label: 'Coupon Income',    amount: '—', icon: 'payments',               iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)'       },
  ];

  chartPath       = '';
  chartLine       = '';
  chartDateLabels: string[] = [];
  monthChangeAmt  = 0;
  monthChangePct  = 0;

  private _rawTx = signal<WalletTransaction[]>([]);

  // ── Computed ─────────────────────────────────────────────────────────────────

  get filteredTx(): WalletTransaction[] {
    const f = this.txFilter();
    const s = this.searchTerm.toLowerCase();
    return this._rawTx()
      .filter(tx => this.matchesFilter(tx, f))
      .filter(tx => !s ||
        tx.description.toLowerCase().includes(s) ||
        (tx.reference_id ?? '').toLowerCase().includes(s));
  }

  get transactions() {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredTx.slice(start, start + this.pageSize).map(tx => this.mapTx(tx));
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTx.length / this.pageSize));
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngOnInit() {
    this.initChartLabels();
    this.loadBalance();
    this.loadTransactions();
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  private loadBalance() {
    this.walletSvc.getBalance().subscribe({
      next: (b: WalletBalance) => {
        this.loading.set(false);
        this.availableBalance.set(b.availableBalance);
        this.totalBalance.set(b.balance);
        this.frozenBalance.set(b.frozenBalance);
        this.balanceCurrency.set(b.currency);
        this.syncSubBalances(b);
      },
      error: (err) => {
        this.loading.set(false);
        this.apiError.set(err?.error?.error?.message ?? 'Unable to load wallet balance. Check API connection.');
      },
    });
  }

  private loadTransactions() {
    this.walletSvc.getTransactions(50, 0).subscribe({
      next: res => {
        this._rawTx.set(res?.data ?? []);
        this.txLoading.set(false);
        this.generateChart(res?.data ?? []);
        this.computeMonthChange(res?.data ?? []);
      },
      error: () => this.txLoading.set(false),
    });
  }

  private syncSubBalances(b: WalletBalance) {
    const c   = b.currency;
    const fmt = (n: number) =>
      `${c} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const couponIncome = this._rawTx()
      .filter(t => t.type === 'COUPON' && t.status === 'COMPLETED')
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    this.subBalances = [
      { label: 'Available Cash',   amount: fmt(b.availableBalance), icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.1)',  iconColor: 'var(--accent-cyan)'   },
      { label: 'Total Balance',    amount: fmt(b.balance),          icon: 'trending_up',            iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)'   },
      { label: 'Frozen / Pending', amount: fmt(b.frozenBalance),    icon: 'pending',                iconBg: 'rgba(255,193,7,0.1)',  iconColor: 'var(--warning)'       },
      { label: 'Coupon Income',    amount: fmt(couponIncome),       icon: 'payments',               iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)'       },
    ];
  }

  private initChartLabels() {
    this.chartDateLabels = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(Date.now() - (4 - i) * 7 * 86_400_000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
  }

  private generateChart(txs: WalletTransaction[]) {
    const days = 30;
    const now  = Date.now();
    let   bal  = this.availableBalance();
    const pts  = new Array<number>(days).fill(0);
    pts[days - 1] = bal;

    for (let i = days - 2; i >= 0; i--) {
      const dayStart = now - (days - 1 - i) * 86_400_000;
      const dayEnd   = dayStart + 86_400_000;
      for (const tx of txs) {
        const ms = new Date(tx.created_at).getTime();
        if (ms >= dayStart && ms < dayEnd) {
          const amt  = parseFloat(tx.amount);
          const isIn = tx.type === 'CREDIT' || tx.type === 'SETTLEMENT_CREDIT'
                    || tx.type === 'COUPON'  || tx.type === 'UNFREEZE';
          bal = isIn ? bal - amt : bal + amt;
        }
      }
      pts[i] = Math.max(0, bal);
    }

    const maxVal = Math.max(...pts, 1);
    const W = 300; const H = 80;
    const coords = pts.map((v, i) => {
      const x = ((i / (days - 1)) * W).toFixed(1);
      const y = (H - (v / maxVal) * (H - 6)).toFixed(1);
      return `${x},${y}`;
    });
    this.chartLine = `M ${coords.join(' L ')}`;
    this.chartPath = `${this.chartLine} L ${W},${H} L 0,${H} Z`;
  }

  private computeMonthChange(txs: WalletTransaction[]) {
    const cutoff = Date.now() - 30 * 86_400_000;
    const net = txs
      .filter(tx => new Date(tx.created_at).getTime() > cutoff && tx.status !== 'FAILED')
      .reduce((sum, tx) => {
        const amt  = parseFloat(tx.amount);
        const isIn = tx.type === 'CREDIT' || tx.type === 'SETTLEMENT_CREDIT' || tx.type === 'COUPON';
        return sum + (isIn ? amt : -amt);
      }, 0);
    const base = this.totalBalance() - net;
    this.monthChangeAmt = net;
    this.monthChangePct = base > 0 ? (net / base) * 100 : 0;
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  submitDeposit() {
    if (this.depositAmount <= 0) { this.error.set('Enter an amount greater than 0.'); return; }
    this.submitting.set(true); this.error.set(null); this.success.set(null);
    const amount = this.depositAmount;
    const label  = this.paymentMethods.find(m => m.id === this.selectedMethod())?.label ?? 'Bank';
    this.walletSvc.deposit(amount, this.balanceCurrency(), this.selectedMethod()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set(`Deposit of ${this.balanceCurrency()} ${amount.toLocaleString()} initiated successfully.`);
        this.addLocalTx('CREDIT', amount, `Deposit via ${label}`);
        this.depositAmount = 0;
        setTimeout(() => this.success.set(null), 5000);
        this.loadBalance();
        this.loadTransactions();
      },
      error: err => {
        this.submitting.set(false);
        this.error.set(err?.error?.error?.message ?? 'Deposit failed. Please try again.');
      },
    });
  }

  submitWithdraw() {
    if (this.withdrawAmount <= 0) { this.error.set('Enter an amount greater than 0.'); return; }
    if (this.withdrawAmount > this.availableBalance()) { this.error.set('Amount exceeds available balance.'); return; }
    const bank   = this.banks[this.selectedBankIdx];
    const amount = this.withdrawAmount;
    this.submitting.set(true); this.error.set(null); this.success.set(null);
    this.walletSvc.withdraw(amount, this.balanceCurrency(), bank.name, bank.iban).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set(`Withdrawal of ${this.balanceCurrency()} ${amount.toLocaleString()} submitted. Processing in 1-2 business days.`);
        this.addLocalTx('DEBIT', amount, `Withdrawal — ${bank.name}`, 'PROCESSING');
        this.withdrawAmount = 0;
        setTimeout(() => this.success.set(null), 5000);
        this.loadBalance();
        this.loadTransactions();
      },
      error: err => {
        this.submitting.set(false);
        this.error.set(err?.error?.error?.message ?? 'Withdrawal failed. Please try again.');
      },
    });
  }

  private addLocalTx(
    type: WalletTransaction['type'],
    amount: number,
    description: string,
    status: WalletTransaction['status'] = 'COMPLETED',
  ) {
    const prefix = type === 'CREDIT' ? 'DEP' : 'WDR';
    const tx: WalletTransaction = {
      id:              Date.now().toString(),
      type,
      amount:          amount.toString(),
      currency:        this.balanceCurrency(),
      status,
      description,
      reference_id:    `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      idempotency_key: Math.random().toString(36).slice(2),
      created_at:      new Date().toISOString(),
    };
    this._rawTx.update(list => [tx, ...list]);
    this.page.set(1);
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  goToPage(n: number) {
    if (n >= 1 && n <= this.totalPages) this.page.set(n);
  }

  onFilterChange() { this.page.set(1); }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private matchesFilter(tx: WalletTransaction, filter: string): boolean {
    if (filter === 'All')         return true;
    if (filter === 'Deposits')    return tx.type === 'CREDIT';
    if (filter === 'Withdrawals') return tx.type === 'DEBIT';
    if (filter === 'Trades')      return tx.type === 'SETTLEMENT_CREDIT' || tx.type === 'SETTLEMENT_DEBIT';
    if (filter === 'Coupons')     return tx.type === 'COUPON';
    return true;
  }

  private mapTx(tx: WalletTransaction) {
    const amount  = parseFloat(tx.amount);
    const isDebit = tx.type === 'DEBIT' || tx.type === 'SETTLEMENT_DEBIT' || tx.type === 'FREEZE';
    const styleMap: Record<string, { icon: string; bg: string; color: string }> = {
      CREDIT:            { icon: 'add_circle',    bg: 'rgba(46,213,115,0.12)',  color: 'var(--success)'        },
      DEBIT:             { icon: 'remove_circle', bg: 'rgba(255,71,87,0.12)',   color: 'var(--danger)'         },
      COUPON:            { icon: 'payments',      bg: 'rgba(0,212,255,0.12)',   color: 'var(--accent-cyan)'    },
      SETTLEMENT_CREDIT: { icon: 'task_alt',      bg: 'rgba(46,213,115,0.12)', color: 'var(--success)'        },
      SETTLEMENT_DEBIT:  { icon: 'swap_horiz',    bg: 'rgba(124,77,255,0.12)', color: 'var(--accent-purple)'  },
      FREEZE:            { icon: 'lock',          bg: 'rgba(255,193,7,0.12)',   color: 'var(--warning)'        },
      UNFREEZE:          { icon: 'lock_open',     bg: 'rgba(23,195,178,0.12)', color: 'var(--accent-teal)'    },
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
