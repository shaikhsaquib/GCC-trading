import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="admin-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Admin Module</h2>
          <p>Manage users, review KYC, generate reports and control system settings</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-node">Node.js</span>
          <button class="btn btn-secondary"><span class="material-icons-round">file_download</span> Export Users</button>
          <button class="btn btn-primary"><span class="material-icons-round">person_add</span> Add User</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:24px">
        @for (s of adminStats; track s.label) {
          <div class="stat-card" style="padding:14px">
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" style="font-size:20px" [style.color]="s.color">{{ s.value }}</div>
          </div>
        }
      </div>

      <!-- Tabs -->
      <div class="tab-bar">
        @for (tab of tabs; track tab) {
          <div class="tab" [class.active]="activeTab() === tab" (click)="activeTab.set(tab)">{{ tab }}</div>
        }
      </div>

      <!-- USER MANAGEMENT tab -->
      @if (activeTab() === 'User Management') {
        <div class="fade-in">
          <div class="toolbar" style="margin-bottom:16px">
            <div class="search-bar" style="flex:1">
              <span class="material-icons-round search-icon">search</span>
              <input class="form-control" style="width:100%;padding-left:36px" placeholder="Search by name, email, ID..." [(ngModel)]="userSearch" name="us"/>
            </div>
            <select class="form-control form-select" style="width:150px" [(ngModel)]="statusFilter" name="sf">
              <option value="">All Status</option>
              <option>Active</option>
              <option>Pending KYC</option>
              <option>Suspended</option>
              <option>Blocked</option>
            </select>
            <select class="form-control form-select" style="width:140px" name="rf">
              <option>All Roles</option>
              <option>Investor</option>
              <option>Trader</option>
              <option>Admin</option>
            </select>
          </div>

          <div class="card" style="padding:0;overflow:hidden">
            <table class="data-table">
              <thead>
                <tr>
                  <th><input type="checkbox" style="accent-color:var(--accent-cyan)"/></th>
                  <th>User</th>
                  <th>Role</th>
                  <th>KYC</th>
                  <th>Account Type</th>
                  <th>Portfolio Value</th>
                  <th>Joined</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (u of filteredUsers(); track u.id) {
                  <tr>
                    <td (click)="$event.stopPropagation()">
                      <input type="checkbox" style="accent-color:var(--accent-cyan)"/>
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        <div class="user-avatar-sm" [style.background]="u.avatarColor">{{ u.initials }}</div>
                        <div>
                          <div style="font-weight:600;font-size:13px">{{ u.name }}</div>
                          <div style="font-size:11px;color:var(--text-secondary)">{{ u.email }}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="role-badge" [ngClass]="roleBadge(u.role)">{{ u.role }}</span></td>
                    <td><span class="badge" [ngClass]="kycBadge(u.kyc)">{{ u.kyc }}</span></td>
                    <td style="color:var(--text-secondary)">{{ u.accountType }}</td>
                    <td style="font-weight:600">SAR {{ u.portfolio }}</td>
                    <td style="color:var(--text-secondary)">{{ u.joined }}</td>
                    <td style="color:var(--text-secondary)">{{ u.lastLogin }}</td>
                    <td><span class="status-badge" [ngClass]="userStatusBadge(u.status)">{{ u.status }}</span></td>
                    <td>
                      <div style="display:flex;gap:6px">
                        <button class="btn btn-secondary btn-sm" title="Edit">
                          <span class="material-icons-round" style="font-size:14px">edit</span>
                        </button>
                        <button class="btn btn-secondary btn-sm" title="View">
                          <span class="material-icons-round" style="font-size:14px">visibility</span>
                        </button>
                        <button class="btn btn-danger btn-sm" title="Suspend">
                          <span class="material-icons-round" style="font-size:14px">block</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- KYC REVIEW tab -->
      @if (activeTab() === 'KYC Review') {
        <div class="kyc-review-grid fade-in">
          @for (app of kycApplications; track app.id) {
            <div class="kyc-card card">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
                <div class="user-avatar-sm" [style.background]="app.avatarColor">{{ app.initials }}</div>
                <div style="flex:1">
                  <strong>{{ app.name }}</strong>
                  <p style="font-size:11px;color:var(--text-secondary)">{{ app.type }} · {{ app.nationality }}</p>
                </div>
                <span class="badge" [ngClass]="kycBadge(app.status)">{{ app.status }}</span>
              </div>
              <div class="kyc-docs">
                @for (doc of app.docs; track doc) {
                  <div class="doc-chip" [class.verified]="doc.verified">
                    <span class="material-icons-round" style="font-size:14px">{{ doc.verified ? 'check_circle' : 'schedule' }}</span>
                    {{ doc.label }}
                  </div>
                }
              </div>
              <div class="risk-mini">
                <span style="font-size:11px;color:var(--text-muted)">Risk:</span>
                <span style="font-size:12px;font-weight:700" [style.color]="app.risk === 'LOW' ? 'var(--success)' : app.risk === 'MEDIUM' ? 'var(--warning)' : 'var(--danger)'">{{ app.risk }}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto">{{ app.submitted }}</span>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-danger btn-sm" style="flex:1;justify-content:center">Reject</button>
                <button class="btn btn-success btn-sm" style="flex:1;justify-content:center">Approve</button>
              </div>
            </div>
          }
        </div>
      }

      <!-- SYSTEM REPORTS tab -->
      @if (activeTab() === 'System Reports') {
        <div class="reports-grid fade-in">
          @for (report of reports; track report.name) {
            <div class="report-card card">
              <div class="report-icon" [style.background]="report.iconBg">
                <span class="material-icons-round" [style.color]="report.iconColor">{{ report.icon }}</span>
              </div>
              <h4>{{ report.name }}</h4>
              <p>{{ report.desc }}</p>
              <div style="display:flex;gap:8px;margin-top:auto;padding-top:14px">
                <button class="btn btn-secondary btn-sm"><span class="material-icons-round" style="font-size:14px">visibility</span> Preview</button>
                <button class="btn btn-primary btn-sm"><span class="material-icons-round" style="font-size:14px">file_download</span> Download</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-page { }

    .toolbar { display: flex; align-items: center; gap: 12px; }

    .user-avatar-sm { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0; }

    .role-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .role-admin    { background: rgba(124,77,255,0.15); color: var(--accent-purple); }
    .role-trader   { background: rgba(0,212,255,0.15); color: var(--accent-cyan); }
    .role-investor { background: rgba(23,195,178,0.15); color: var(--accent-teal); }

    .status-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .status-active    { background: rgba(46,213,115,0.12); color: var(--success); }
    .status-pending   { background: rgba(255,193,7,0.12); color: var(--warning); }
    .status-suspended { background: rgba(255,71,87,0.12); color: var(--danger); }

    .kyc-review-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }

    .kyc-card { padding: 18px; display: flex; flex-direction: column; }

    .kyc-docs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

    .doc-chip { display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 10px; border-radius: 20px; background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--border); &.verified { background: rgba(46,213,115,0.1); color: var(--success); border-color: rgba(46,213,115,0.3); } }

    .risk-mini { display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-input); border-radius: var(--radius-sm); }

    .reports-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }

    .report-card { padding: 20px; display: flex; flex-direction: column; gap: 8px; min-height: 200px; }

    .report-icon { width: 44px; height: 44px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; .material-icons-round { font-size: 22px; } }

    .report-card h4 { font-size: 14px; font-weight: 700; }
    .report-card p { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
  `],
})
export class AdminComponent {
  activeTab = signal('User Management');
  userSearch = '';
  statusFilter = '';

  tabs = ['User Management', 'KYC Review', 'System Reports', 'Permissions'];

  adminStats = [
    { label: 'Total Users', value: '3,842', color: 'var(--text-primary)' },
    { label: 'Active Today', value: '1,247', color: 'var(--success)' },
    { label: 'New This Week', value: '124', color: 'var(--accent-cyan)' },
    { label: 'KYC Pending', value: '48', color: 'var(--warning)' },
    { label: 'Suspended', value: '7', color: 'var(--danger)' },
    { label: 'Admins', value: '12', color: 'var(--accent-purple)' },
  ];

  users = [
    { id: 1, name: 'Mohammed Al-Rashid', email: 'm.rashid@example.com', initials: 'MR', avatarColor: '#7c4dff', role: 'Trader', kyc: 'Approved', accountType: 'Individual', portfolio: '1.2M', joined: 'Jan 2023', lastLogin: '2h ago', status: 'Active' },
    { id: 2, name: 'Fatima Al-Zahrani', email: 'f.zahrani@example.com', initials: 'FZ', avatarColor: '#00d4ff', role: 'Investor', kyc: 'Approved', accountType: 'Individual', portfolio: '450K', joined: 'Mar 2023', lastLogin: 'Yesterday', status: 'Active' },
    { id: 3, name: 'Khalid Al-Mutairi', email: 'k.mutairi@example.com', initials: 'KM', avatarColor: '#17c3b2', role: 'Investor', kyc: 'Approved', accountType: 'Corporate', portfolio: '8.4M', joined: 'Jun 2022', lastLogin: '3 days ago', status: 'Active' },
    { id: 4, name: 'Omar Al-Farouqi', email: 'o.farouqi@example.com', initials: 'OF', avatarColor: '#ff4757', role: 'Investor', kyc: 'Rejected', accountType: 'Institution', portfolio: '0', joined: 'Apr 2024', lastLogin: '5 days ago', status: 'Suspended' },
    { id: 5, name: 'Nora Al-Shehri', email: 'n.shehri@example.com', initials: 'NS', avatarColor: '#ffc107', role: 'Investor', kyc: 'Pending', accountType: 'Individual', portfolio: '120K', joined: 'Apr 2024', lastLogin: 'Today', status: 'Pending KYC' },
    { id: 6, name: 'Ahmed Al-Ghamdi', email: 'a.ghamdi@example.com', initials: 'AG', avatarColor: '#00e676', role: 'Admin', kyc: 'Approved', accountType: 'Staff', portfolio: '—', joined: 'May 2021', lastLogin: '1h ago', status: 'Active' },
  ];

  kycApplications = [
    { id: 1, name: 'Mohammed Al-Rashid', initials: 'MR', avatarColor: '#7c4dff', type: 'Individual', nationality: 'Saudi', status: 'Pending', risk: 'LOW', submitted: '2h ago', docs: [{ label: 'National ID', verified: false }, { label: 'Selfie', verified: true }, { label: 'Bank Stmt', verified: false }] },
    { id: 2, name: 'Fatima Al-Zahrani', initials: 'FZ', avatarColor: '#00d4ff', type: 'Individual', nationality: 'Saudi', status: 'In Review', risk: 'LOW', submitted: '5h ago', docs: [{ label: 'National ID', verified: true }, { label: 'Selfie', verified: true }, { label: 'Bank Stmt', verified: false }] },
    { id: 3, name: 'Hind Al-Qahtani', initials: 'HQ', avatarColor: '#17c3b2', type: 'Corporate', nationality: 'Saudi', status: 'Pending', risk: 'MEDIUM', submitted: '1d ago', docs: [{ label: 'CR', verified: false }, { label: 'MOA', verified: false }, { label: 'UBO Docs', verified: false }] },
  ];

  reports = [
    { name: 'User Activity Report', desc: 'Login sessions, trades and wallet activity per user', icon: 'person', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)' },
    { name: 'KYC Status Report', desc: 'Verification rates, pending queue and approval timelines', icon: 'verified_user', iconBg: 'rgba(0,230,118,0.1)', iconColor: 'var(--success)' },
    { name: 'Trading Volume Report', desc: 'Daily, weekly and monthly trading volumes by bond type', icon: 'bar_chart', iconBg: 'rgba(124,77,255,0.1)', iconColor: 'var(--accent-purple)' },
    { name: 'Revenue & Fees Report', desc: 'Commission income, VAT collected, fee breakdown', icon: 'payments', iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)' },
    { name: 'AML/Compliance Report', desc: 'Alert statistics, SAR filings and risk distribution', icon: 'security', iconBg: 'rgba(255,71,87,0.1)', iconColor: 'var(--danger)' },
    { name: 'Settlement Report', desc: 'T+1 queue, failed settlements and counterparty stats', icon: 'task_alt', iconBg: 'rgba(255,193,7,0.1)', iconColor: 'var(--warning)' },
    { name: 'Regulatory Report (SAMA)', desc: 'SAMA-compliant monthly regulatory submission', icon: 'account_balance', iconBg: 'rgba(0,212,255,0.08)', iconColor: 'var(--accent-cyan)' },
    { name: 'Audit Summary Report', desc: 'Immutable action logs summary for compliance review', icon: 'storage', iconBg: 'rgba(124,77,255,0.08)', iconColor: 'var(--accent-purple)' },
  ];

  filteredUsers() {
    return this.users.filter(u =>
      (!this.userSearch || u.name.toLowerCase().includes(this.userSearch.toLowerCase()) || u.email.toLowerCase().includes(this.userSearch.toLowerCase())) &&
      (!this.statusFilter || u.status === this.statusFilter)
    );
  }

  roleBadge(role: string) { return { 'role-admin': role === 'Admin', 'role-trader': role === 'Trader', 'role-investor': role === 'Investor' }; }
  kycBadge(kyc: string) { return { 'badge-success': kyc === 'Approved', 'badge-warning': kyc === 'Pending', 'badge-info': kyc === 'In Review', 'badge-danger': kyc === 'Rejected' }; }
  userStatusBadge(s: string) { return { 'status-active': s === 'Active', 'status-pending': s === 'Pending KYC', 'status-suspended': s === 'Suspended' }; }
}
