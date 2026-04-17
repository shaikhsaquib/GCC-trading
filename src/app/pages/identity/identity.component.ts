import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { AdminUser } from '../../core/models/api.models';

interface UserDisplay {
  id:        string;
  name:      string;
  email:     string;
  initials:  string;
  avatarBg:  string;
  role:      string;
  status:    string;
  twoFa:     boolean;
  lastLogin: string;
  sessions:  number;
  created:   string;
  kyc:       string;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#00d4ff,#17c3b2)',
  'linear-gradient(135deg,#7c4dff,#00d4ff)',
  'linear-gradient(135deg,#17c3b2,#7c4dff)',
  'linear-gradient(135deg,#ffc107,#ff9800)',
  'linear-gradient(135deg,#00d4ff,#7c4dff)',
  'linear-gradient(135deg,#8fa3b8,#4a5568)',
];

@Component({
  selector: 'app-identity',
  standalone: true,
  imports: [NgClass],
  templateUrl: './identity.component.html',
  styleUrl: './identity.component.css',
})
export class IdentityComponent implements OnInit {
  private readonly adminSvc = inject(AdminService);

  activeTab    = signal('All Users');
  selectedUser = signal<UserDisplay | null>(null);
  loading      = signal(true);

  tabs = ['All Users', 'Admins', 'Investors', 'Compliance', 'Suspended'];

  kpis = [
    { label: 'Total Users',       value: '—', icon: 'people',   iconBg: 'rgba(0,212,255,0.1)',   iconColor: 'var(--accent-cyan)', color: 'var(--text-primary)' },
    { label: 'Active Sessions',   value: '—', icon: 'devices',  iconBg: 'rgba(23,195,178,0.1)',  iconColor: 'var(--accent-teal)', color: 'var(--accent-teal)' },
    { label: 'Failed Logins (24h)',value: '—', icon: 'warning',  iconBg: 'rgba(255,71,87,0.1)',   iconColor: 'var(--danger)',      color: 'var(--danger)' },
    { label: '2FA Enabled',       value: '—', icon: 'verified', iconBg: 'rgba(46,213,115,0.1)',  iconColor: 'var(--success)',     color: 'var(--success)' },
  ];

  authSettings = [
    { label: 'Require 2FA for All Users', desc: 'Force two-factor authentication on login', enabled: true },
    { label: 'Email Verification',        desc: 'Verify email address on registration',      enabled: true },
    { label: 'IP Whitelisting',           desc: 'Restrict access to approved IP ranges',     enabled: false },
    { label: 'Account Lockout',           desc: 'Lock account after failed login attempts',  enabled: true },
    { label: 'Audit All Actions',         desc: 'Log every user action to audit trail',      enabled: true },
  ];

  loginEvents = signal<Array<{ user: string; ip: string; location: string; time: string; success: boolean }>>([]);

  private _users = signal<UserDisplay[]>([]);

  ngOnInit() {
    this.adminSvc.getDashboard().subscribe({
      next: s => {
        this.kpis[0].value = s.totalUsers.toLocaleString();
        this.kpis[1].value = s.activeUsers.toLocaleString();
      },
    });
    this.adminSvc.listUsers({ limit: 200 }).subscribe({
      next: res => {
        this.loading.set(false);
        this._users.set((res.data ?? []).map((u, i) => this.mapUser(u, i)));
      },
      error: () => this.loading.set(false),
    });
    this.adminSvc.getAuditTrail({ eventType: 'USER_LOGGED_IN', limit: 20 }).subscribe({
      next: res => {
        this.loginEvents.set((res.data?.data ?? []).map(e => ({
          user:     e.actor_id ?? '—',
          ip:       '—',
          location: '—',
          time:     this.relativeTime(e.created_at),
          success:  true,
        })));
      },
      error: () => {},
    });
  }

  private mapUser(u: AdminUser, idx: number): UserDisplay {
    const fullName = `${u.first_name} ${u.last_name}`.trim();
    const initials = `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase();
    return {
      id:        u.id,
      name:      fullName,
      email:     u.email ?? '—',
      initials,
      avatarBg:  AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
      role:      this.mapRole(u.role),
      status:    this.mapStatus(u.status),
      twoFa:     false,
      lastLogin: u.last_login_at ? this.relativeTime(u.last_login_at) : 'Never',
      sessions:  0,
      created:   new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      kyc:       u.status === 'ACTIVE' ? 'Approved' : 'Pending',
    };
  }

  private mapRole(role: string): string {
    const map: Record<string, string> = {
      INVESTOR: 'Investor', KYC_OFFICER: 'KYC Officer',
      L2_ADMIN: 'Admin',   ADMIN: 'Admin', COMPLIANCE: 'Compliance',
    };
    return map[role] ?? role;
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING_KYC: 'Pending KYC', ACTIVE: 'Active',
      SUSPENDED: 'Suspended',     DEACTIVATED: 'Suspended',
    };
    return map[status] ?? status;
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

  filteredUsers() {
    const tab = this.activeTab();
    const list = this._users();
    if (tab === 'All Users')  return list;
    if (tab === 'Admins')     return list.filter(u => u.role === 'Admin' || u.role === 'KYC Officer');
    if (tab === 'Investors')  return list.filter(u => u.role === 'Investor');
    if (tab === 'Compliance') return list.filter(u => u.role === 'Compliance');
    if (tab === 'Suspended')  return list.filter(u => u.status === 'Suspended');
    return list;
  }
}
