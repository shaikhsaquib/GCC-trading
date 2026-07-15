import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { AdminUser } from '../../core/models/api.models';
import { ToastService } from '../../core/services/toast.service';
import { exportToCsv } from '../../core/utils/csv-export';
import { timeAgo } from '../../core/utils/time';
import { avatarGradient } from '../../core/utils/avatar';

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


@Component({
  selector: 'app-identity',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './identity.component.html',
  styleUrl: './identity.component.css',
})
export class IdentityComponent implements OnInit {
  private readonly adminSvc = inject(AdminService);
  private readonly toast    = inject(ToastService);

  activeTab    = signal('All Users');
  selectedUser = signal<UserDisplay | null>(null);
  loading      = signal(true);
  searchTerm   = '';

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
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load users — please try again');
      },
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
      avatarBg:  avatarGradient(idx),
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

  private relativeTime = timeAgo;

  filteredUsers() {
    const tab  = this.activeTab();
    const term = this.searchTerm.trim().toLowerCase();
    let list   = this._users();
    if (tab === 'Admins')          list = list.filter(u => u.role === 'Admin' || u.role === 'KYC Officer');
    else if (tab === 'Investors')  list = list.filter(u => u.role === 'Investor');
    else if (tab === 'Compliance') list = list.filter(u => u.role === 'Compliance');
    else if (tab === 'Suspended')  list = list.filter(u => u.status === 'Suspended');
    if (term) {
      list = list.filter(u =>
        u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
    }
    return list;
  }

  suspendUser(u: UserDisplay) {
    if (!confirm(`Suspend ${u.name}?`)) return;
    this.adminSvc.suspendUser(u.id).subscribe({
      next: () => {
        this._users.update(list => list.map(x => x.id === u.id ? { ...x, status: 'Suspended' } : x));
        if (this.selectedUser()?.id === u.id) {
          this.selectedUser.update(x => x ? { ...x, status: 'Suspended' } : x);
        }
        this.toast.success(`${u.name} suspended`);
      },
      error: () => this.toast.error(`Could not suspend ${u.name} — please try again`),
    });
  }

  activateUser(u: UserDisplay) {
    if (!confirm(`Activate ${u.name}?`)) return;
    this.adminSvc.activateUser(u.id).subscribe({
      next: () => {
        this._users.update(list => list.map(x => x.id === u.id ? { ...x, status: 'Active' } : x));
        if (this.selectedUser()?.id === u.id) {
          this.selectedUser.update(x => x ? { ...x, status: 'Active' } : x);
        }
        this.toast.success(`${u.name} activated`);
      },
      error: () => this.toast.error(`Could not activate ${u.name} — please try again`),
    });
  }

  exportUsers() {
    const rows = this.filteredUsers();
    if (!rows.length) { this.toast.info('No users to export'); return; }
    exportToCsv('identity-users', [
      { label: 'Name',       key: 'name'      },
      { label: 'Email',      key: 'email'     },
      { label: 'Role',       key: 'role'      },
      { label: 'Status',     key: 'status'    },
      { label: 'KYC',        key: 'kyc'       },
      { label: 'Last Login', key: 'lastLogin' },
      { label: 'Created',    key: 'created'   },
    ], rows as unknown as Record<string, unknown>[]);
    this.toast.success(`Exported ${rows.length} rows`);
  }
}
