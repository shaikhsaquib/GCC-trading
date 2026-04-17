import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { KycService } from '../../services/kyc.service';
import { AdminStats, AdminUser, KycQueueItem } from '../../core/models/api.models';

interface UserDisplay {
  id:          string;
  name:        string;
  email:       string;
  initials:    string;
  avatarColor: string;
  role:        string;
  kyc:         string;
  accountType: string;
  portfolio:   string;
  joined:      string;
  lastLogin:   string;
  status:      string;
}

const AVATAR_COLORS = ['#7c4dff', '#00d4ff', '#17c3b2', '#ff4757', '#ffc107', '#00e676'];

interface KycDisplay {
  id:          string;
  name:        string;
  initials:    string;
  avatarColor: string;
  type:        string;
  nationality: string;
  status:      string;
  risk:        string;
  submitted:   string;
  docs:        Array<{ label: string; verified: boolean }>;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly adminSvc = inject(AdminService);
  private readonly kycSvc   = inject(KycService);

  activeTab    = signal('User Management');
  userSearch   = '';
  statusFilter = '';
  loading      = signal(true);
  usersLoading = signal(true);
  error        = signal<string | null>(null);

  tabs = ['User Management', 'KYC Review', 'System Reports', 'Permissions'];

  adminStats = [
    { label: 'Total Users',    value: '—', color: 'var(--text-primary)' },
    { label: 'Active Today',   value: '—', color: 'var(--success)' },
    { label: 'New This Week',  value: '—', color: 'var(--accent-cyan)' },
    { label: 'KYC Pending',    value: '—', color: 'var(--warning)' },
    { label: 'Suspended',      value: '—', color: 'var(--danger)' },
    { label: 'Admins',         value: '—', color: 'var(--accent-purple)' },
  ];

  private _users    = signal<UserDisplay[]>([]);
  kycQueue          = signal<KycDisplay[]>([]);
  kycLoading        = signal(true);
  kycActionMsg      = signal<string | null>(null);

  reports = [
    { name: 'User Activity Report',      desc: 'Login sessions, trades and wallet activity per user',       icon: 'person',          iconBg: 'rgba(0,212,255,0.1)',  iconColor: 'var(--accent-cyan)' },
    { name: 'KYC Status Report',         desc: 'Verification rates, pending queue and approval timelines',  icon: 'verified_user',   iconBg: 'rgba(0,230,118,0.1)',  iconColor: 'var(--success)' },
    { name: 'Trading Volume Report',     desc: 'Daily, weekly and monthly trading volumes by bond type',    icon: 'bar_chart',       iconBg: 'rgba(124,77,255,0.1)', iconColor: 'var(--accent-purple)' },
    { name: 'Revenue & Fees Report',     desc: 'Commission income, VAT collected, fee breakdown',           icon: 'payments',        iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)' },
    { name: 'AML/Compliance Report',     desc: 'Alert statistics, SAR filings and risk distribution',       icon: 'security',        iconBg: 'rgba(255,71,87,0.1)',  iconColor: 'var(--danger)' },
    { name: 'Settlement Report',         desc: 'T+1 queue, failed settlements and counterparty stats',      icon: 'task_alt',        iconBg: 'rgba(255,193,7,0.1)',  iconColor: 'var(--warning)' },
    { name: 'Regulatory Report (SAMA)',  desc: 'SAMA-compliant monthly regulatory submission',              icon: 'account_balance', iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)' },
    { name: 'Audit Summary Report',      desc: 'Immutable action logs summary for compliance review',       icon: 'storage',         iconBg: 'rgba(124,77,255,0.08)', iconColor: 'var(--accent-purple)' },
  ];

  ngOnInit() {
    this.loadStats();
    this.loadUsers();
    this.loadKycQueue();
  }

  private loadStats() {
    this.adminSvc.getDashboard().subscribe({
      next: (s: AdminStats) => {
        this.loading.set(false);
        this.adminStats = [
          { label: 'Total Users',   value: s.totalUsers.toLocaleString(),  color: 'var(--text-primary)' },
          { label: 'Active Today',  value: s.activeUsers.toLocaleString(), color: 'var(--success)' },
          { label: 'New This Week', value: '—',                            color: 'var(--accent-cyan)' },
          { label: 'KYC Pending',   value: s.pendingKyc.toLocaleString(),  color: 'var(--warning)' },
          { label: 'Suspended',     value: '—',                            color: 'var(--danger)' },
          { label: 'Admins',        value: '—',                            color: 'var(--accent-purple)' },
        ];
      },
      error: () => this.loading.set(false),
    });
  }

  private loadKycQueue() {
    this.kycSvc.getQueue(undefined, 50, 0).subscribe({
      next: res => {
        this.kycLoading.set(false);
        this.kycQueue.set((res.data ?? []).map((k, i) => this.mapKycItem(k, i)));
      },
      error: () => this.kycLoading.set(false),
    });
  }

  private mapKycItem(k: KycQueueItem, idx: number): KycDisplay {
    const COLORS = ['#7c4dff', '#00d4ff', '#17c3b2', '#ff4757', '#ffc107', '#00e676'];
    const name   = `${k.first_name} ${k.last_name}`.trim();
    const initials = `${k.first_name?.[0] ?? ''}${k.last_name?.[0] ?? ''}`.toUpperCase();
    const statusMap: Record<string, string> = {
      Submitted: 'Pending', UnderReview: 'In Review', Approved: 'Approved', Rejected: 'Rejected', Draft: 'Draft',
    };
    const submittedAt = k.submitted_at
      ? this.relativeTime(k.submitted_at)
      : this.relativeTime(k.created_at);
    return {
      id:          k.id,
      name,
      initials,
      avatarColor: COLORS[idx % COLORS.length],
      type:        'Individual',
      nationality: (k as any).nationality ?? '—',
      status:      statusMap[k.status] ?? k.status,
      risk:        k.risk_level ?? '—',
      submitted:   submittedAt,
      docs: [
        { label: 'National ID', verified: false },
        { label: 'Selfie',      verified: false },
        { label: 'Bank Stmt',   verified: false },
      ],
    };
  }

  get kycApplications() { return this.kycQueue(); }

  approveKyc(id: string) {
    this.kycSvc.approve(id, 'LOW').subscribe({
      next: () => {
        this.kycQueue.update(q => q.filter(k => k.id !== id));
        this.kycActionMsg.set('KYC approved successfully');
        setTimeout(() => this.kycActionMsg.set(null), 4000);
      },
    });
  }

  rejectKyc(id: string) {
    this.kycSvc.reject(id, 'Rejected by admin').subscribe({
      next: () => {
        this.kycQueue.update(q => q.map(k => k.id === id ? { ...k, status: 'Rejected' } : k));
        this.kycActionMsg.set('KYC rejected');
        setTimeout(() => this.kycActionMsg.set(null), 4000);
      },
    });
  }

  private relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }

  private loadUsers() {
    this.adminSvc.listUsers({ limit: 100 }).subscribe({
      next: res => {
        this.usersLoading.set(false);
        this._users.set((res.data ?? []).map((u, i) => this.mapUser(u, i)));
      },
      error: () => this.usersLoading.set(false),
    });
  }

  private mapUser(u: AdminUser, idx: number): UserDisplay {
    const fullName = `${u.first_name} ${u.last_name}`.trim();
    const initials = `${u.first_name[0] ?? ''}${u.last_name[0] ?? ''}`.toUpperCase();
    return {
      id:          u.id,
      name:        fullName,
      email:       u.email ?? '—',
      initials,
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
      role:        this.mapRole(u.role),
      kyc:         this.mapKyc(u.status),
      accountType: 'Individual',
      portfolio:   '—',
      joined:      new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      lastLogin:   u.last_login_at ? this.relativeTime(u.last_login_at) : 'Never',
      status:      this.mapStatus(u.status),
    };
  }

  private mapRole(role: string): string {
    const map: Record<string, string> = {
      INVESTOR: 'Investor', KYC_OFFICER: 'KYC Officer',
      L2_ADMIN: 'Admin', ADMIN: 'Admin', COMPLIANCE: 'Compliance',
    };
    return map[role] ?? role;
  }

  private mapKyc(status: string): string {
    const map: Record<string, string> = {
      PENDING_KYC: 'Pending', ACTIVE: 'Approved',
      SUSPENDED: 'Approved', DEACTIVATED: 'Approved',
    };
    return map[status] ?? 'Pending';
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING_KYC: 'Pending KYC', ACTIVE: 'Active',
      SUSPENDED: 'Suspended', DEACTIVATED: 'Suspended',
    };
    return map[status] ?? status;
  }

  suspendUser(id: string) {
    this.adminSvc.suspendUser(id).subscribe({
      next: () => {
        this._users.update(list =>
          list.map(u => u.id === id ? { ...u, status: 'Suspended' } : u)
        );
      },
    });
  }

  activateUser(id: string) {
    this.adminSvc.activateUser(id).subscribe({
      next: () => {
        this._users.update(list =>
          list.map(u => u.id === id ? { ...u, status: 'Active', kyc: 'Approved' } : u)
        );
      },
    });
  }

  get users() {
    return this._users();
  }

  filteredUsers() {
    const search = this.userSearch.toLowerCase();
    const status = this.statusFilter;
    return this._users().filter(u =>
      (!search || u.name.toLowerCase().includes(search)) &&
      (!status || u.status === status)
    );
  }

  roleBadge(role: string)   { return { 'role-admin': role === 'Admin', 'role-trader': role === 'Trader', 'role-investor': role === 'Investor' }; }
  kycBadge(kyc: string)     { return { 'badge-success': kyc === 'Approved', 'badge-warning': kyc === 'Pending', 'badge-info': kyc === 'In Review', 'badge-danger': kyc === 'Rejected' }; }
  userStatusBadge(s: string){ return { 'status-active': s === 'Active', 'status-pending': s === 'Pending KYC', 'status-suspended': s === 'Suspended' }; }
}
