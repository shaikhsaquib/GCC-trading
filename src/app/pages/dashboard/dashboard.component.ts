import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../services/admin.service';
import { WalletService } from '../../services/wallet.service';
import { PortfolioService } from '../../services/portfolio.service';
import { KycService } from '../../services/kyc.service';
import {
  AdminStats, WalletBalance, PortfolioSummary, KycSubmission, WalletTransaction,
} from '../../core/models/api.models';

interface ModuleCard {
  title:     string;
  desc:      string;
  icon:      string;
  tech:      string;
  techClass: string;
  route:     string;
  color:     string;
  status:    'active' | 'idle' | 'warning';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly adminSvc     = inject(AdminService);
  private readonly walletSvc    = inject(WalletService);
  private readonly portfolioSvc = inject(PortfolioService);
  private readonly kycSvc       = inject(KycService);
  readonly auth                 = inject(AuthService);

  readonly isAdmin    = this.auth.isAdmin;
  readonly isActive   = this.auth.isActive;
  readonly isPending  = () => !this.auth.isAdmin() && !this.auth.isActive();

  // ── Admin state ──────────────────────────────────────────────────────────────

  kpis = [
    { label: 'Total AUM',        value: '—', icon: 'account_balance',  iconBg: 'rgba(0,212,255,0.1)',   iconColor: 'var(--accent-cyan)',   change: '—', up: true  },
    { label: 'Active Bonds',     value: '—', icon: 'public',           iconBg: 'rgba(23,195,178,0.1)',  iconColor: 'var(--accent-teal)',   change: '—', up: true  },
    { label: 'Open Orders',      value: '—', icon: 'swap_horiz',       iconBg: 'rgba(124,77,255,0.1)',  iconColor: 'var(--accent-purple)', change: '—', up: false },
    { label: 'KYC Pending',      value: '—', icon: 'pending_actions',  iconBg: 'rgba(255,165,2,0.1)',   iconColor: 'var(--warning)',        change: '—', up: false },
    { label: "Today's Volume",   value: '—', icon: 'bar_chart',        iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)',        change: '—', up: true  },
    { label: 'Settlements T+1',  value: '—', icon: 'task_alt',         iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)',   change: '—', up: true  },
  ];

  modules: ModuleCard[] = [
    { title: 'Identity & Auth',   desc: 'Register, login, 2FA, sessions',          icon: 'lock',                   tech: 'Node.js',   techClass: 'node',   route: '/identity',     color: '0,230,118',  status: 'active'  },
    { title: 'KYC & Onboarding',  desc: 'Upload ID, selfie verify, approve user',  icon: 'verified_user',          tech: 'Node.js',   techClass: 'node',   route: '/kyc',          color: '0,212,255',  status: 'idle'    },
    { title: 'Wallet & Payments', desc: 'Add money, withdraw, check balance',       icon: 'account_balance_wallet', tech: 'Node.js',   techClass: 'node',   route: '/wallet',       color: '0,230,118',  status: 'active'  },
    { title: 'Bond Marketplace',  desc: 'List bonds, search, filter, compare',      icon: 'public',                 tech: '.NET Core', techClass: 'dotnet', route: '/marketplace',  color: '124,77,255', status: 'active'  },
    { title: 'Trading Engine',    desc: 'Place buy/sell orders, match trades',      icon: 'swap_horiz',             tech: '.NET Core', techClass: 'dotnet', route: '/trading',      color: '124,77,255', status: 'active'  },
    { title: 'Settlement',        desc: 'Finalize trades after T+1 day',            icon: 'task_alt',               tech: '.NET Core', techClass: 'dotnet', route: '/settlement',   color: '124,77,255', status: 'idle'    },
    { title: 'Portfolio Mgmt',    desc: 'Track holdings, show P&L, coupons',       icon: 'trending_up',            tech: '.NET Core', techClass: 'dotnet', route: '/portfolio',    color: '124,77,255', status: 'active'  },
    { title: 'AML & Compliance',  desc: 'Watch for suspicious activity, report',   icon: 'security',               tech: '.NET Core', techClass: 'dotnet', route: '/aml',          color: '255,71,87',  status: 'warning' },
    { title: 'Notifications',     desc: 'Send push, email, SMS alerts',             icon: 'notifications',          tech: 'Node.js',   techClass: 'node',   route: '/notifications', color: '0,212,255', status: 'active'  },
    { title: 'Admin Module',      desc: 'Manage users, review KYC, reports',       icon: 'manage_accounts',        tech: 'Node.js',   techClass: 'node',   route: '/admin',        color: '0,230,118',  status: 'active'  },
    { title: 'Audit Trail',       desc: 'Log every action (immutable)',             icon: 'storage',                tech: 'Node.js',   techClass: 'node',   route: '/audit',        color: '255,193,7',  status: 'active'  },
    { title: 'Scheduler',         desc: 'Run cron jobs: coupons, maturity, cleanup', icon: 'schedule',             tech: 'Node-cron', techClass: 'cron',   route: '/scheduler',    color: '0,212,255',  status: 'active'  },
  ];

  recentActivity: Array<{ id: number; icon: string; iconBg: string; iconColor: string; title: string; meta: string; time: string }> = [];

  services: Array<{ name: string; uptime: number; up: boolean }> = [];

  // ── Investor state ───────────────────────────────────────────────────────────

  investorLoading = signal(true);
  wallet          = signal<WalletBalance | null>(null);
  portfolio       = signal<PortfolioSummary | null>(null);
  kyc             = signal<KycSubmission | null>(null);
  recentTxns      = signal<WalletTransaction[]>([]);

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
      CREDIT:             { icon: 'add_circle',   bg: 'rgba(46,213,115,0.12)',  color: '#2ed573' },
      DEBIT:              { icon: 'remove_circle', bg: 'rgba(255,71,87,0.12)',   color: '#ff4757' },
      COUPON:             { icon: 'payments',      bg: 'rgba(124,77,255,0.12)', color: '#7c4dff' },
      SETTLEMENT_CREDIT:  { icon: 'task_alt',      bg: 'rgba(0,212,255,0.12)',  color: '#00d4ff' },
      SETTLEMENT_DEBIT:   { icon: 'task_alt',      bg: 'rgba(255,165,2,0.12)', color: '#ffa502' },
      FREEZE:             { icon: 'lock',          bg: 'rgba(255,193,7,0.12)', color: '#ffc107' },
      UNFREEZE:           { icon: 'lock_open',     bg: 'rgba(0,230,118,0.12)', color: '#00e676' },
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

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit() {
    if (this.isAdmin()) {
      this.loadAdminStats();
    } else {
      this.loadInvestorData();
    }
  }

  private loadAdminStats() {
    this.adminSvc.getDashboard().subscribe({
      next: (s: AdminStats) => {
        this.kpis = [
          { label: 'Total AUM',      value: '—',                                          icon: 'account_balance',  iconBg: 'rgba(0,212,255,0.1)',   iconColor: 'var(--accent-cyan)',   change: '—', up: true  },
          { label: 'Active Bonds',   value: s.totalBonds.toLocaleString(),                icon: 'public',           iconBg: 'rgba(23,195,178,0.1)',  iconColor: 'var(--accent-teal)',   change: '—', up: true  },
          { label: 'Open Orders',    value: s.openOrders.toLocaleString(),                icon: 'swap_horiz',       iconBg: 'rgba(124,77,255,0.1)',  iconColor: 'var(--accent-purple)', change: '—', up: false },
          { label: 'KYC Pending',    value: s.pendingKyc.toLocaleString(),                icon: 'pending_actions',  iconBg: 'rgba(255,165,2,0.1)',   iconColor: 'var(--warning)',        change: '—', up: false },
          { label: "Today's Volume", value: `SAR ${s.tradeVolumeToday.toLocaleString()}`, icon: 'bar_chart',        iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)',        change: '—', up: true  },
          { label: 'Trades Today',   value: s.tradesToday.toLocaleString(),               icon: 'task_alt',         iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)',   change: '—', up: true  },
        ];
      },
      error: () => {},
    });

    this.adminSvc.getAuditTrail({ limit: 6 }).subscribe({
      next: res => {
        this.recentActivity = (res.data?.data ?? []).map((e, i) => ({
          id:        i + 1,
          icon:      this.auditIcon(e.event_type),
          iconBg:    this.auditIconBg(e.event_type),
          iconColor: this.auditIconColor(e.event_type),
          title:     e.event_type.replace(/_/g, ' '),
          meta:      e.target_id ? `Target: ${e.target_id}` : '',
          time:      this.relativeTime(e.created_at),
        }));
      },
      error: () => {},
    });

    this.adminSvc.getServiceHealth().subscribe({
      next: health => {
        const s = health.services;
        this.services = [
          { name: 'PostgreSQL',          uptime: 100, up: s.postgresql },
          { name: 'Redis',               uptime: 100, up: s.redis },
          { name: 'MongoDB',             uptime: 100, up: s.mongodb },
          { name: 'Auth Service (Node.js)', uptime: 100, up: s.postgresql && s.redis },
          { name: 'API Gateway',         uptime: 100, up: health.status === 'healthy' },
          { name: 'Scheduler (Node-cron)',uptime: 100, up: true },
        ];
      },
      error: () => {
        this.services = [
          { name: 'Auth Service (Node.js)',   uptime: 0, up: false },
          { name: 'Trading Engine (.NET)',    uptime: 0, up: false },
          { name: 'Bond Marketplace (.NET)',  uptime: 0, up: false },
          { name: 'Settlement Service (.NET)',uptime: 0, up: false },
          { name: 'Notification Service',    uptime: 0, up: false },
          { name: 'Scheduler (Node-cron)',   uptime: 0, up: false },
        ];
      },
    });
  }

  private auditIcon(eventType: string): string {
    if (eventType.includes('LOGIN'))      return 'lock';
    if (eventType.includes('KYC'))        return 'verified_user';
    if (eventType.includes('TRADE'))      return 'swap_horiz';
    if (eventType.includes('DEPOSIT'))    return 'account_balance_wallet';
    if (eventType.includes('WITHDRAW'))   return 'remove_circle';
    if (eventType.includes('SETTLEMENT')) return 'task_alt';
    if (eventType.includes('ORDER'))      return 'swap_horiz';
    return 'history';
  }

  private auditIconBg(eventType: string): string {
    if (eventType.includes('LOGIN'))    return 'rgba(0,230,118,0.12)';
    if (eventType.includes('KYC'))      return 'rgba(0,212,255,0.12)';
    if (eventType.includes('TRADE'))    return 'rgba(124,77,255,0.12)';
    if (eventType.includes('WITHDRAW')) return 'rgba(255,71,87,0.12)';
    return 'rgba(0,212,255,0.12)';
  }

  private auditIconColor(eventType: string): string {
    if (eventType.includes('LOGIN'))    return '#00e676';
    if (eventType.includes('KYC'))      return '#00d4ff';
    if (eventType.includes('TRADE'))    return '#7c4dff';
    if (eventType.includes('WITHDRAW')) return '#ff4757';
    return '#00d4ff';
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
