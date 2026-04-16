import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AdminStats } from '../../core/models/api.models';

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
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly adminSvc = inject(AdminService);

  kpis = [
    { label: 'Total AUM',        value: '—',   icon: 'account_balance',  iconBg: 'rgba(0,212,255,0.1)',   iconColor: 'var(--accent-cyan)',   change: '—',   up: true },
    { label: 'Active Bonds',     value: '—',   icon: 'public',           iconBg: 'rgba(23,195,178,0.1)',  iconColor: 'var(--accent-teal)',   change: '—',   up: true },
    { label: 'Open Orders',      value: '—',   icon: 'swap_horiz',       iconBg: 'rgba(124,77,255,0.1)',  iconColor: 'var(--accent-purple)', change: '—',   up: false },
    { label: 'KYC Pending',      value: '—',   icon: 'pending_actions',  iconBg: 'rgba(255,165,2,0.1)',   iconColor: 'var(--warning)',        change: '—',   up: false },
    { label: "Today's Volume",   value: '—',   icon: 'bar_chart',        iconBg: 'rgba(46,213,115,0.1)',  iconColor: 'var(--success)',        change: '—',   up: true },
    { label: 'Settlements T+1',  value: '—',   icon: 'task_alt',         iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)',   change: '—',   up: true },
  ];

  modules: ModuleCard[] = [
    { title: 'Identity & Auth',   desc: 'Register, login, 2FA, sessions',         icon: 'lock',                  tech: 'Node.js',   techClass: 'node',   route: '/auth/login',  color: '0,230,118',  status: 'active' },
    { title: 'KYC & Onboarding',  desc: 'Upload ID, selfie verify, approve user',  icon: 'verified_user',         tech: 'Node.js',   techClass: 'node',   route: '/kyc',         color: '0,212,255',  status: 'idle' },
    { title: 'Wallet & Payments', desc: 'Add money, withdraw, check balance',      icon: 'account_balance_wallet',tech: 'Node.js',   techClass: 'node',   route: '/wallet',      color: '0,230,118',  status: 'active' },
    { title: 'Bond Marketplace',  desc: 'List bonds, search, filter, compare',     icon: 'public',                tech: '.NET Core', techClass: 'dotnet', route: '/marketplace', color: '124,77,255', status: 'active' },
    { title: 'Trading Engine',    desc: 'Place buy/sell orders, match trades',     icon: 'swap_horiz',            tech: '.NET Core', techClass: 'dotnet', route: '/trading',     color: '124,77,255', status: 'active' },
    { title: 'Settlement',        desc: 'Finalize trades after T+1 day',           icon: 'task_alt',              tech: '.NET Core', techClass: 'dotnet', route: '/settlement',  color: '124,77,255', status: 'idle' },
    { title: 'Portfolio Mgmt',    desc: 'Track holdings, show P&L, coupons',      icon: 'trending_up',           tech: '.NET Core', techClass: 'dotnet', route: '/portfolio',   color: '124,77,255', status: 'active' },
    { title: 'AML & Compliance',  desc: 'Watch for suspicious activity, report',  icon: 'security',              tech: '.NET Core', techClass: 'dotnet', route: '/aml',         color: '255,71,87',  status: 'warning' },
    { title: 'Notifications',     desc: 'Send push, email, SMS alerts',            icon: 'notifications',         tech: 'Node.js',   techClass: 'node',   route: '/notifications',color: '0,212,255', status: 'active' },
    { title: 'Admin Module',      desc: 'Manage users, review KYC, reports',      icon: 'manage_accounts',       tech: 'Node.js',   techClass: 'node',   route: '/admin',       color: '0,230,118',  status: 'active' },
    { title: 'Audit Trail',       desc: 'Log every action (immutable)',            icon: 'storage',               tech: 'Node.js',   techClass: 'node',   route: '/audit',       color: '255,193,7',  status: 'active' },
    { title: 'Scheduler',         desc: 'Run cron jobs: coupons, maturity, cleanup',icon: 'schedule',            tech: 'Node-cron', techClass: 'cron',   route: '/scheduler',   color: '0,212,255',  status: 'active' },
  ];

  recentActivity = [
    { id: 1, icon: 'swap_horiz',            iconBg: 'rgba(124,77,255,0.12)', iconColor: '#7c4dff', title: 'Buy Order Executed — ISIN SA123456789',            meta: 'SAR 500,000 · 5,000 units @ 100.25', time: '2m ago' },
    { id: 2, icon: 'verified_user',         iconBg: 'rgba(0,230,118,0.12)', iconColor: '#00e676', title: 'KYC Approved — Khalid Al-Mutairi',                 meta: 'Document verified · Account activated', time: '8m ago' },
    { id: 3, icon: 'security',              iconBg: 'rgba(255,71,87,0.12)',  iconColor: '#ff4757', title: 'AML Alert — Unusual transaction pattern',          meta: 'User ID #TRD-8821 · Risk score: HIGH', time: '15m ago' },
    { id: 4, icon: 'account_balance_wallet',iconBg: 'rgba(0,212,255,0.12)', iconColor: '#00d4ff', title: 'Deposit Completed — Fatima Al-Zahrani',            meta: 'SAR 250,000 credited to wallet', time: '22m ago' },
    { id: 5, icon: 'task_alt',              iconBg: 'rgba(46,213,115,0.12)', iconColor: '#2ed573', title: 'Settlement Finalized — Trade #TRD-1042',           meta: 'T+1 settlement · Counterparty confirmed', time: '31m ago' },
    { id: 6, icon: 'schedule',              iconBg: 'rgba(255,193,7,0.12)', iconColor: '#ffc107', title: 'Coupon Payment Processed — 12 bonds',              meta: 'SAR 1.2M distributed to 340 holders', time: '1h ago' },
  ];

  services = [
    { name: 'Auth Service (Node.js)',      uptime: 99.9, up: true },
    { name: 'Trading Engine (.NET)',        uptime: 99.7, up: true },
    { name: 'Bond Marketplace (.NET)',      uptime: 99.5, up: true },
    { name: 'Settlement Service (.NET)',    uptime: 98.8, up: true },
    { name: 'Notification Service',        uptime: 99.2, up: true },
    { name: 'Scheduler (Node-cron)',        uptime: 97.4, up: true },
  ];

  ngOnInit() {
    this.adminSvc.getDashboard().subscribe({
      next: (s: AdminStats) => {
        this.kpis = [
          { label: 'Total AUM',       value: '—',                                icon: 'account_balance',  iconBg: 'rgba(0,212,255,0.1)',   iconColor: 'var(--accent-cyan)',   change: '—', up: true },
          { label: 'Active Bonds',    value: s.totalBonds.toLocaleString(),      icon: 'public',           iconBg: 'rgba(23,195,178,0.1)',  iconColor: 'var(--accent-teal)',   change: '—', up: true },
          { label: 'Open Orders',     value: s.openOrders.toLocaleString(),      icon: 'swap_horiz',       iconBg: 'rgba(124,77,255,0.1)',  iconColor: 'var(--accent-purple)', change: '—', up: false },
          { label: 'KYC Pending',     value: s.pendingKyc.toLocaleString(),      icon: 'pending_actions',  iconBg: 'rgba(255,165,2,0.1)',   iconColor: 'var(--warning)',        change: '—', up: false },
          { label: "Today's Volume",  value: `SAR ${s.tradeVolumeToday.toLocaleString()}`, icon: 'bar_chart', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)',     change: '—', up: true },
          { label: 'Trades Today',    value: s.tradesToday.toLocaleString(),     icon: 'task_alt',         iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)',   change: '—', up: true },
        ];
      },
      error: () => { /* keep placeholder values */ },
    });
  }
}
