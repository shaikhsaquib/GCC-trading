import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ModuleCard {
  title: string;
  desc: string;
  icon: string;
  tech: string;
  techClass: string;
  route: string;
  color: string;
  status: 'active' | 'idle' | 'warning';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="dashboard fade-in">

      <!-- Page Header -->
      <div class="page-header">
        <div class="page-title">
          <h2>Platform Overview</h2>
          <p>GCC Bond Trading System — All modules at a glance</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-success">
            <span class="status-dot active"></span> All Systems Operational
          </span>
          <button class="btn btn-primary">
            <span class="material-icons-round">add</span> New Trade
          </button>
        </div>
      </div>

      <!-- KPI Stats -->
      <div class="stats-grid">
        @for (stat of kpis; track stat.label) {
          <div class="stat-card">
            <div class="stat-icon" [style.background]="stat.iconBg">
              <span class="material-icons-round" [style.color]="stat.iconColor">{{ stat.icon }}</span>
            </div>
            <div class="stat-label">{{ stat.label }}</div>
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-change" [class.up]="stat.up" [class.down]="!stat.up">
              {{ stat.up ? '▲' : '▼' }} {{ stat.change }} vs last week
            </div>
          </div>
        }
      </div>

      <!-- Module Grid -->
      <div class="section-header">
        <h3>Modules</h3>
        <p class="text-muted">Each module = one job. Click to navigate.</p>
      </div>

      <div class="modules-grid">
        @for (mod of modules; track mod.title) {
          <a class="module-card" [routerLink]="mod.route" [style.--accent]="mod.color">
            <div class="module-header">
              <div class="module-icon" [style.background]="'rgba(' + mod.color + ',0.12)'">
                <span class="material-icons-round" [style.color]="'rgb(' + mod.color + ')'">{{ mod.icon }}</span>
              </div>
              <div class="module-status">
                <span class="status-dot" [class.active]="mod.status==='active'" [class.pending]="mod.status==='idle'" [class.error]="mod.status==='warning'"></span>
              </div>
            </div>
            <h4 class="module-title">{{ mod.title }}</h4>
            <p class="module-desc">{{ mod.desc }}</p>
            <div class="module-footer">
              <span class="badge" [class]="'badge-' + mod.techClass">{{ mod.tech }}</span>
              <span class="material-icons-round arrow-icon">arrow_forward</span>
            </div>
          </a>
        }
      </div>

      <!-- Bottom Row -->
      <div class="bottom-row">

        <!-- Recent Activity -->
        <div class="card activity-card">
          <div class="card-header">
            <h4>Recent Activity</h4>
            <button class="btn btn-secondary btn-sm">View All</button>
          </div>
          <div class="activity-list">
            @for (act of recentActivity; track act.id) {
              <div class="activity-item">
                <div class="activity-icon" [style.background]="act.iconBg">
                  <span class="material-icons-round" [style.color]="act.iconColor" style="font-size:16px">{{ act.icon }}</span>
                </div>
                <div class="activity-content">
                  <p class="activity-title">{{ act.title }}</p>
                  <p class="activity-meta">{{ act.meta }}</p>
                </div>
                <span class="activity-time">{{ act.time }}</span>
              </div>
            }
          </div>
        </div>

        <!-- System Health -->
        <div class="card health-card">
          <div class="card-header">
            <h4>System Health</h4>
            <span class="badge badge-success">Healthy</span>
          </div>
          <div class="health-list">
            @for (svc of services; track svc.name) {
              <div class="health-item">
                <div class="health-name">
                  <span class="status-dot" [class.active]="svc.up" [class.error]="!svc.up"></span>
                  {{ svc.name }}
                </div>
                <div class="health-bar">
                  <div class="progress-bar" style="flex:1">
                    <div class="progress-fill" [style.width]="svc.uptime + '%'"></div>
                  </div>
                  <span class="health-val">{{ svc.uptime }}%</span>
                </div>
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1400px; }

    .section-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 16px;
      h3 { font-size: 16px; font-weight: 700; }
    }

    .modules-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }

    .module-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      gap: 10px;

      &:hover {
        border-color: rgba(var(--accent), 0.5);
        background: var(--bg-card-hover);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);

        .arrow-icon { opacity: 1; transform: translateX(4px); }
      }
    }

    .module-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .module-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      .material-icons-round { font-size: 22px; }
    }

    .module-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .module-desc {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
      flex: 1;
    }

    .module-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
    }

    .arrow-icon {
      font-size: 16px;
      color: var(--text-muted);
      opacity: 0;
      transition: all 0.2s;
    }

    .bottom-row {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 20px;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      h4 { font-size: 14px; font-weight: 700; }
    }

    .activity-list { display: flex; flex-direction: column; gap: 2px; }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      border-radius: var(--radius-sm);
      transition: background 0.15s;
      &:hover { background: var(--bg-card-hover); }
    }

    .activity-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .activity-content { flex: 1; }
    .activity-title { font-size: 13px; color: var(--text-primary); font-weight: 500; }
    .activity-meta  { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .activity-time  { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

    .health-list { display: flex; flex-direction: column; gap: 14px; }

    .health-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .health-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .health-bar {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .health-val {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      width: 40px;
      text-align: right;
    }
  `],
})
export class DashboardComponent {
  kpis = [
    { label: 'Total AUM', value: 'SAR 4.2B', icon: 'account_balance', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)', change: '12.3%', up: true },
    { label: 'Active Bonds', value: '1,847', icon: 'public', iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)', change: '5.8%', up: true },
    { label: 'Open Orders', value: '234', icon: 'swap_horiz', iconBg: 'rgba(124,77,255,0.1)', iconColor: 'var(--accent-purple)', change: '2.1%', up: false },
    { label: 'KYC Pending', value: '48', icon: 'pending_actions', iconBg: 'rgba(255,165,2,0.1)', iconColor: 'var(--warning)', change: '8.4%', up: false },
    { label: "Today's Volume", value: 'SAR 280M', icon: 'bar_chart', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)', change: '18.5%', up: true },
    { label: 'Settlements T+1', value: '92', icon: 'task_alt', iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)', change: '3.0%', up: true },
  ];

  modules: ModuleCard[] = [
    { title: 'Identity & Auth', desc: 'Register, login, 2FA, sessions', icon: 'lock', tech: 'Node.js', techClass: 'node', route: '/auth/login', color: '0,230,118', status: 'active' },
    { title: 'KYC & Onboarding', desc: 'Upload ID, selfie verify, approve user', icon: 'verified_user', tech: 'Node.js', techClass: 'node', route: '/kyc', color: '0,212,255', status: 'idle' },
    { title: 'Wallet & Payments', desc: 'Add money, withdraw, check balance', icon: 'account_balance_wallet', tech: 'Node.js', techClass: 'node', route: '/wallet', color: '0,230,118', status: 'active' },
    { title: 'Bond Marketplace', desc: 'List bonds, search, filter, compare', icon: 'public', tech: '.NET Core', techClass: 'dotnet', route: '/marketplace', color: '124,77,255', status: 'active' },
    { title: 'Trading Engine', desc: 'Place buy/sell orders, match trades', icon: 'swap_horiz', tech: '.NET Core', techClass: 'dotnet', route: '/trading', color: '124,77,255', status: 'active' },
    { title: 'Settlement', desc: 'Finalize trades after T+1 day', icon: 'task_alt', tech: '.NET Core', techClass: 'dotnet', route: '/settlement', color: '124,77,255', status: 'idle' },
    { title: 'Portfolio Mgmt', desc: 'Track holdings, show P&L, coupons', icon: 'trending_up', tech: '.NET Core', techClass: 'dotnet', route: '/portfolio', color: '124,77,255', status: 'active' },
    { title: 'AML & Compliance', desc: 'Watch for suspicious activity, report', icon: 'security', tech: '.NET Core', techClass: 'dotnet', route: '/aml', color: '255,71,87', status: 'warning' },
    { title: 'Notifications', desc: 'Send push, email, SMS alerts', icon: 'notifications', tech: 'Node.js', techClass: 'node', route: '/notifications', color: '0,212,255', status: 'active' },
    { title: 'Admin Module', desc: 'Manage users, review KYC, reports', icon: 'manage_accounts', tech: 'Node.js', techClass: 'node', route: '/admin', color: '0,230,118', status: 'active' },
    { title: 'Audit Trail', desc: 'Log every action (immutable)', icon: 'storage', tech: 'Node.js', techClass: 'node', route: '/audit', color: '255,193,7', status: 'active' },
    { title: 'Scheduler', desc: 'Run cron jobs: coupons, maturity, cleanup', icon: 'schedule', tech: 'Node-cron', techClass: 'cron', route: '/scheduler', color: '0,212,255', status: 'active' },
  ];

  recentActivity = [
    { id: 1, icon: 'swap_horiz', iconBg: 'rgba(124,77,255,0.12)', iconColor: '#7c4dff', title: 'Buy Order Executed — ISIN SA123456789', meta: 'SAR 500,000 · 5,000 units @ 100.25', time: '2m ago' },
    { id: 2, icon: 'verified_user', iconBg: 'rgba(0,230,118,0.12)', iconColor: '#00e676', title: 'KYC Approved — Khalid Al-Mutairi', meta: 'Document verified · Account activated', time: '8m ago' },
    { id: 3, icon: 'security', iconBg: 'rgba(255,71,87,0.12)', iconColor: '#ff4757', title: 'AML Alert — Unusual transaction pattern', meta: 'User ID #TRD-8821 · Risk score: HIGH', time: '15m ago' },
    { id: 4, icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.12)', iconColor: '#00d4ff', title: 'Deposit Completed — Fatima Al-Zahrani', meta: 'SAR 250,000 credited to wallet', time: '22m ago' },
    { id: 5, icon: 'task_alt', iconBg: 'rgba(46,213,115,0.12)', iconColor: '#2ed573', title: 'Settlement Finalized — Trade #TRD-1042', meta: 'T+1 settlement · Counterparty confirmed', time: '31m ago' },
    { id: 6, icon: 'schedule', iconBg: 'rgba(255,193,7,0.12)', iconColor: '#ffc107', title: 'Coupon Payment Processed — 12 bonds', meta: 'SAR 1.2M distributed to 340 holders', time: '1h ago' },
  ];

  services = [
    { name: 'Auth Service (Node.js)', uptime: 99.9, up: true },
    { name: 'Trading Engine (.NET)', uptime: 99.7, up: true },
    { name: 'Bond Marketplace (.NET)', uptime: 99.5, up: true },
    { name: 'Settlement Service (.NET)', uptime: 98.8, up: true },
    { name: 'Notification Service', uptime: 99.2, up: true },
    { name: 'Scheduler (Node-cron)', uptime: 97.4, up: true },
  ];
}
