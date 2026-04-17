import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService }     from '../../core/services/auth.service';
import { AdminService, DailyReportRow } from '../../services/admin.service';
import { WalletService }   from '../../services/wallet.service';
import { PortfolioService } from '../../services/portfolio.service';
import { KycService }      from '../../services/kyc.service';
import {
  AdminStats, WalletBalance, PortfolioSummary, KycSubmission, WalletTransaction, AuditEntry,
} from '../../core/models/api.models';

interface Kpi {
  label:     string;
  value:     string;
  icon:      string;
  iconBg:    string;
  iconColor: string;
  change:    string | null;
  up:        boolean;
}

interface ModuleCard {
  title:     string;
  desc:      string;
  icon:      string;
  tech:      string;
  techClass: string;
  route:     string;
  color:     string;
  isNode:    boolean;
}

interface ChartBar {
  x: number; y: number; width: number; height: number;
  date: string; volume: number; count: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly adminSvc     = inject(AdminService);
  private readonly walletSvc    = inject(WalletService);
  private readonly portfolioSvc = inject(PortfolioService);
  private readonly kycSvc       = inject(KycService);
  readonly auth                 = inject(AuthService);

  readonly isAdmin   = this.auth.isAdmin;
  readonly isActive  = this.auth.isActive;
  readonly isPending = () => !this.auth.isAdmin() && !this.auth.isActive();

  // ── Admin state ──────────────────────────────────────────────────────────────

  adminLoading = signal(true);
  adminError   = signal(false);
  adminStats   = signal<AdminStats | null>(null);
  chartData    = signal<DailyReportRow[]>([]);

  kpis: Kpi[] = [];

  modules: ModuleCard[] = [
    { title: 'Identity & Auth',   desc: 'Register, login, 2FA, sessions',            icon: 'lock',                   tech: 'Node.js',   techClass: 'node',   route: '/identity',      color: '0,230,118',  isNode: true  },
    { title: 'KYC & Onboarding',  desc: 'Upload ID, selfie verify, approve user',    icon: 'verified_user',          tech: 'Node.js',   techClass: 'node',   route: '/kyc',           color: '0,212,255',  isNode: true  },
    { title: 'Wallet & Payments', desc: 'Add money, withdraw, check balance',        icon: 'account_balance_wallet', tech: 'Node.js',   techClass: 'node',   route: '/wallet',        color: '0,230,118',  isNode: true  },
    { title: 'Bond Marketplace',  desc: 'List bonds, search, filter, compare',       icon: 'public',                 tech: '.NET Core', techClass: 'dotnet', route: '/marketplace',   color: '124,77,255', isNode: false },
    { title: 'Trading Engine',    desc: 'Place buy/sell orders, match trades',       icon: 'swap_horiz',             tech: '.NET Core', techClass: 'dotnet', route: '/trading',       color: '124,77,255', isNode: false },
    { title: 'Settlement',        desc: 'Finalize trades after T+1 day',             icon: 'task_alt',               tech: '.NET Core', techClass: 'dotnet', route: '/settlement',    color: '124,77,255', isNode: false },
    { title: 'Portfolio Mgmt',    desc: 'Track holdings, show P&L, coupons',        icon: 'trending_up',            tech: '.NET Core', techClass: 'dotnet', route: '/portfolio',     color: '124,77,255', isNode: false },
    { title: 'AML & Compliance',  desc: 'Watch for suspicious activity, report',    icon: 'security',               tech: '.NET Core', techClass: 'dotnet', route: '/aml',           color: '255,71,87',  isNode: false },
    { title: 'Notifications',     desc: 'Send push, email, SMS alerts',              icon: 'notifications',          tech: 'Node.js',   techClass: 'node',   route: '/notifications', color: '0,212,255',  isNode: true  },
    { title: 'Admin Module',      desc: 'Manage users, review KYC, reports',        icon: 'manage_accounts',        tech: 'Node.js',   techClass: 'node',   route: '/admin',         color: '0,230,118',  isNode: true  },
    { title: 'Audit Trail',       desc: 'Log every action (immutable)',              icon: 'storage',                tech: 'Node.js',   techClass: 'node',   route: '/audit',         color: '255,193,7',  isNode: true  },
    { title: 'Scheduler',         desc: 'Run cron jobs: coupons, maturity, cleanup', icon: 'schedule',              tech: 'Node-cron', techClass: 'cron',   route: '/scheduler',     color: '0,212,255',  isNode: true  },
  ];

  recentActivity: Array<{
    id: number; icon: string; iconBg: string; iconColor: string;
    title: string; meta: string; time: string;
  }> = [];

  services: Array<{ name: string; uptime: number; up: boolean }> = [];

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Investor state ───────────────────────────────────────────────────────────

  investorLoading = signal(true);
  wallet          = signal<WalletBalance | null>(null);
  portfolio       = signal<PortfolioSummary | null>(null);
  kyc             = signal<KycSubmission | null>(null);
  recentTxns      = signal<WalletTransaction[]>([]);

  // ── Admin computed getters ───────────────────────────────────────────────────

  get healthBadge(): { label: string; cls: string } {
    if (!this.services.length) return { label: 'Checking…', cls: 'badge-secondary' };
    const down = this.services.filter(s => !s.up).length;
    if (down === 0) return { label: 'All Systems Operational', cls: 'badge-success' };
    if (down < 3)   return { label: `${down} Service${down > 1 ? 's' : ''} Degraded`, cls: 'badge-warning' };
    return { label: 'System Degraded', cls: 'badge-danger' };
  }

  get nodeUp(): boolean {
    return this.services.length === 0 || this.services.some(s => s.name.includes('Auth') && s.up);
  }

  moduleStatus(mod: ModuleCard): 'active' | 'idle' | 'warning' {
    if (mod.isNode) return this.nodeUp ? 'active' : 'warning';
    if (mod.title === 'AML & Compliance') return 'warning';
    if (mod.title === 'Settlement') return 'idle';
    return 'active';
  }

  pendingActions() {
    const s = this.adminStats();
    if (!s) return [];
    return [
      { label: 'KYC Reviews',     value: s.pendingKyc,     icon: 'verified_user', iconBg: 'rgba(0,212,255,0.12)',  iconColor: '#00d4ff', route: '/admin' },
      { label: 'Open Orders',     value: s.openOrders,     icon: 'swap_horiz',    iconBg: 'rgba(124,77,255,0.12)', iconColor: '#7c4dff', route: '/trading' },
      { label: 'New Users Today', value: s.newUsersToday,  icon: 'person_add',    iconBg: 'rgba(46,213,115,0.12)', iconColor: '#2ed573', route: '/admin' },
      { label: 'Suspended Users', value: s.suspendedUsers, icon: 'block',         iconBg: 'rgba(255,71,87,0.12)',  iconColor: '#ff4757', route: '/admin' },
    ];
  }

  chartBars(): ChartBar[] {
    const rows = this.chartData();
    if (!rows.length) return [];

    const sorted = [...rows].sort((a, b) =>
      new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime(),
    );
    const recent = sorted.slice(-30);
    const maxVol = Math.max(...recent.map(r => parseFloat(r.trade_volume) || 0), 1);
    const n      = recent.length;
    const viewW  = 600;
    const viewH  = 100;
    const barW   = (viewW / n) * 0.65;
    const gapW   = (viewW / n) * 0.35;

    return recent.map((r, i) => {
      const vol = parseFloat(r.trade_volume) || 0;
      const h   = Math.max(2, (vol / maxVol) * viewH);
      return {
        x: i * (viewW / n) + gapW / 2,
        y: viewH - h,
        width: barW, height: h,
        date:   r.trade_date,
        volume: vol,
        count:  parseInt(r.trade_count) || 0,
      };
    });
  }

  chartTotalVolume(): number {
    return this.chartData().reduce((s, r) => s + (parseFloat(r.trade_volume) || 0), 0);
  }

  chartTotalTrades(): number {
    return this.chartData().reduce((s, r) => s + (parseInt(r.trade_count) || 0), 0);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit() {
    if (this.isAdmin()) {
      this.loadAdminStats(true);
      this.refreshTimer = setInterval(() => this.loadAdminStats(false), 30_000);
    } else {
      this.loadInvestorData();
    }
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  refresh() {
    this.loadAdminStats(true);
  }

  private loadAdminStats(showLoading: boolean) {
    if (showLoading) { this.adminLoading.set(true); this.adminError.set(false); }

    this.adminSvc.getDashboard().subscribe({
      next: (s: AdminStats) => {
        this.adminStats.set(s);
        this.kpis = this.buildKpis(s);
        this.adminLoading.set(false);
      },
      error: () => {
        this.adminError.set(true);
        this.adminLoading.set(false);
      },
    });

    this.adminSvc.getDailyReport().subscribe({
      next: rows => this.chartData.set(rows),
      error: () => {},
    });

    this.adminSvc.getAuditTrail({ limit: 6 }).subscribe({
      next: res => {
        this.recentActivity = (res.data?.data ?? []).map((e, i) => ({
          id:        i + 1,
          icon:      this.auditIcon(e.event_type),
          iconBg:    this.auditIconBg(e.event_type),
          iconColor: this.auditIconColor(e.event_type),
          title:     this.auditTitle(e),
          meta:      this.auditMeta(e),
          time:      this.relativeTime(e.created_at),
        }));
      },
      error: () => {},
    });

    this.adminSvc.getServiceHealth().subscribe({
      next: health => {
        const s = health.services;
        this.services = [
          { name: 'PostgreSQL',              uptime: 100, up: s.postgresql },
          { name: 'Redis',                   uptime: 100, up: s.redis },
          { name: 'MongoDB',                 uptime: 100, up: s.mongodb },
          { name: 'Auth Service (Node.js)',  uptime: 100, up: s.postgresql && s.redis },
          { name: 'API Gateway',             uptime: 100, up: health.status === 'healthy' },
          { name: 'Scheduler (Node-cron)',   uptime: 100, up: true },
        ];
      },
      error: () => {
        this.services = [
          { name: 'Auth Service (Node.js)',    uptime: 0, up: false },
          { name: 'Trading Engine (.NET)',     uptime: 0, up: false },
          { name: 'Bond Marketplace (.NET)',   uptime: 0, up: false },
          { name: 'Settlement Service (.NET)', uptime: 0, up: false },
          { name: 'Notification Service',      uptime: 0, up: false },
          { name: 'Scheduler (Node-cron)',     uptime: 0, up: false },
        ];
      },
    });
  }

  private buildKpis(s: AdminStats): Kpi[] {
    const aumM     = s.totalAum / 1_000_000;
    const volDelta = s.volumeYesterday > 0
      ? (((s.tradeVolumeToday - s.volumeYesterday) / s.volumeYesterday) * 100).toFixed(1) + '%'
      : null;

    return [
      {
        label: 'Total AUM', icon: 'account_balance',
        iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)',
        value: `SAR ${aumM.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`,
        change: null, up: true,
      },
      {
        label: 'Active Bonds', icon: 'public',
        iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)',
        value: s.totalBonds.toLocaleString(),
        change: null, up: true,
      },
      {
        label: 'Open Orders', icon: 'swap_horiz',
        iconBg: 'rgba(124,77,255,0.1)', iconColor: 'var(--accent-purple)',
        value: s.openOrders.toLocaleString(),
        change: null, up: false,
      },
      {
        label: 'KYC Pending', icon: 'pending_actions',
        iconBg: 'rgba(255,165,2,0.1)', iconColor: 'var(--warning)',
        value: s.pendingKyc.toLocaleString(),
        change: null, up: false,
      },
      {
        label: "Today's Volume", icon: 'bar_chart',
        iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)',
        value: `SAR ${s.tradeVolumeToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        change: volDelta,
        up: s.tradeVolumeToday >= s.volumeYesterday,
      },
      {
        label: 'Trades Today', icon: 'swap_vert',
        iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)',
        value: s.tradesToday.toLocaleString(),
        change: null, up: true,
      },
    ];
  }

  // ── Audit helpers ─────────────────────────────────────────────────────────────

  private auditTitle(e: AuditEntry): string {
    const map: Record<string, string> = {
      USER_REGISTERED:      'New user registered',
      USER_LOGGED_IN:       'User signed in',
      OAUTH_LOGIN:          'Social sign-in',
      KYC_SUBMITTED:        'KYC application submitted',
      KYC_APPROVED:         'KYC approved',
      KYC_REJECTED:         'KYC rejected',
      TRADE_EXECUTED:       'Trade executed',
      SETTLEMENT_COMPLETED: 'Settlement completed',
      USER_SUSPENDED:       'User suspended',
      USER_ACTIVATED:       'User activated',
      WALLET_FUNDED:        'Wallet funded',
      WITHDRAWAL_REQUESTED: 'Withdrawal requested',
    };
    return map[e.event_type] ?? e.event_type.replace(/_/g, ' ')
      .toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  private auditMeta(e: AuditEntry): string {
    const parts: string[] = [];
    if (e.actor_id)    parts.push(`by ${e.actor_id.slice(0, 8)}…`);
    if (e.target_type) parts.push(e.target_type.replace(/_/g, ' ').toLowerCase());
    return parts.join(' · ');
  }

  private auditIcon(t: string): string {
    if (t.includes('LOGIN') || t.includes('REGISTER')) return 'person';
    if (t.includes('KYC'))        return 'verified_user';
    if (t.includes('TRADE'))      return 'swap_horiz';
    if (t.includes('WALLET') || t.includes('DEPOSIT')) return 'account_balance_wallet';
    if (t.includes('WITHDRAW'))   return 'remove_circle';
    if (t.includes('SETTLEMENT')) return 'task_alt';
    if (t.includes('ORDER'))      return 'receipt_long';
    if (t.includes('SUSPEND'))    return 'block';
    return 'history';
  }

  private auditIconBg(t: string): string {
    if (t.includes('LOGIN') || t.includes('REGISTER')) return 'rgba(0,230,118,0.12)';
    if (t.includes('KYC'))                              return 'rgba(0,212,255,0.12)';
    if (t.includes('TRADE') || t.includes('ORDER'))    return 'rgba(124,77,255,0.12)';
    if (t.includes('WITHDRAW') || t.includes('SUSPEND')) return 'rgba(255,71,87,0.12)';
    if (t.includes('SETTLEMENT'))                       return 'rgba(0,212,255,0.12)';
    return 'rgba(255,193,7,0.12)';
  }

  private auditIconColor(t: string): string {
    if (t.includes('LOGIN') || t.includes('REGISTER')) return '#00e676';
    if (t.includes('KYC'))                              return '#00d4ff';
    if (t.includes('TRADE') || t.includes('ORDER'))    return '#7c4dff';
    if (t.includes('WITHDRAW') || t.includes('SUSPEND')) return '#ff4757';
    if (t.includes('SETTLEMENT'))                       return '#00d4ff';
    return '#ffc107';
  }

  private relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // ── Investor helpers ──────────────────────────────────────────────────────────

  investorKpis() {
    const w = this.wallet();
    const p = this.portfolio();
    return [
      {
        label: 'Wallet Balance', icon: 'account_balance_wallet',
        iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)',
        value: w ? `${w.currency} ${w.availableBalance.toLocaleString()}` : '—',
        sub: w ? `${w.currency} ${w.frozenBalance.toLocaleString()} frozen` : 'No wallet yet',
      },
      {
        label: 'Portfolio Value', icon: 'trending_up',
        iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)',
        value: p ? `${p.currency} ${p.totalValue.toLocaleString()}` : '—',
        sub: p ? `${p.holdingsCount} bond${p.holdingsCount !== 1 ? 's' : ''}` : 'No holdings',
      },
      {
        label: 'Unrealized P&L', icon: 'show_chart',
        iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)',
        value: p ? `${p.currency} ${p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl.toLocaleString()}` : '—',
        sub: p && p.totalCost > 0
          ? `${((p.unrealizedPnl / p.totalCost) * 100).toFixed(2)}% return`
          : 'No cost basis',
      },
      {
        label: 'Coupon Income', icon: 'payments',
        iconBg: 'rgba(124,77,255,0.1)', iconColor: 'var(--accent-purple)',
        value: p ? `${p.currency} ${p.totalCouponReceived.toLocaleString()}` : '—',
        sub: 'Total received',
      },
    ];
  }

  txnIcon(type: string) {
    const map: Record<string, { icon: string; bg: string; color: string }> = {
      CREDIT:            { icon: 'add_circle',    bg: 'rgba(46,213,115,0.12)',  color: '#2ed573' },
      DEBIT:             { icon: 'remove_circle', bg: 'rgba(255,71,87,0.12)',   color: '#ff4757' },
      COUPON:            { icon: 'payments',       bg: 'rgba(124,77,255,0.12)', color: '#7c4dff' },
      SETTLEMENT_CREDIT: { icon: 'task_alt',       bg: 'rgba(0,212,255,0.12)',  color: '#00d4ff' },
      SETTLEMENT_DEBIT:  { icon: 'task_alt',       bg: 'rgba(255,165,2,0.12)', color: '#ffa502' },
      FREEZE:            { icon: 'lock',           bg: 'rgba(255,193,7,0.12)', color: '#ffc107' },
      UNFREEZE:          { icon: 'lock_open',      bg: 'rgba(0,230,118,0.12)', color: '#00e676' },
    };
    return map[type] ?? { icon: 'swap_horiz', bg: 'rgba(0,212,255,0.12)', color: '#00d4ff' };
  }

  kycBadgeClass(status: string) {
    return {
      'badge-warning': status === 'Draft' || status === 'Submitted',
      'badge-info':    status === 'UnderReview',
      'badge-success': status === 'Approved',
      'badge-danger':  status === 'Rejected',
    };
  }

  formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private loadInvestorData() {
    this.investorLoading.set(true);

    this.kycSvc.getMyStatus().subscribe({
      next:  s  => this.kyc.set(s),
      error: () => {},
    });

    this.walletSvc.getBalance().subscribe({
      next:  b  => this.wallet.set(b),
      error: () => this.wallet.set(null),
    });

    this.portfolioSvc.getSummary().subscribe({
      next:  r  => { this.portfolio.set(r.data); this.investorLoading.set(false); },
      error: () => { this.portfolio.set(null);   this.investorLoading.set(false); },
    });

    this.walletSvc.getTransactions(5, 0).subscribe({
      next:  r  => this.recentTxns.set(r.data),
      error: () => this.recentTxns.set([]),
    });
  }
}
