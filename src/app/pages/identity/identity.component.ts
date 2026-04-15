import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-identity',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="identity-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Identity & Auth</h2>
          <p>Manage user accounts, sessions, roles and authentication settings</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-node">Node.js</span>
          <button class="btn btn-secondary"><span class="material-icons-round">filter_list</span> Filters</button>
          <button class="btn btn-primary"><span class="material-icons-round">person_add</span> Invite User</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
        @for (k of kpis; track k.label) {
          <div class="stat-card" style="padding:16px">
            <div class="stat-icon" [style.background]="k.iconBg" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">
              <span class="material-icons-round" [style.color]="k.iconColor" style="font-size:18px">{{ k.icon }}</span>
            </div>
            <div class="stat-label">{{ k.label }}</div>
            <div class="stat-value" style="font-size:22px" [style.color]="k.color">{{ k.value }}</div>
          </div>
        }
      </div>

      <!-- Tab Bar -->
      <div class="tab-bar">
        @for (tab of tabs; track tab) {
          <div class="tab" [class.active]="activeTab() === tab" (click)="activeTab.set(tab)">{{ tab }}</div>
        }
      </div>

      <div class="identity-layout">
        <!-- Users Table -->
        <div class="users-col">
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <h4 style="font-size:14px;font-weight:700">Users ({{ filteredUsers().length }})</h4>
              <div class="search-bar" style="width:240px">
                <span class="material-icons-round search-icon">search</span>
                <input class="form-control" style="width:100%;padding-left:36px" placeholder="Search users..." name="us"/>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>2FA</th>
                  <th>Last Login</th>
                  <th>Sessions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (u of filteredUsers(); track u.id) {
                  <tr [class.selected-row]="selectedUser()?.id === u.id" (click)="selectedUser.set(u)">
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        <div class="user-avatar-sm" [style.background]="u.avatarBg">{{ u.initials }}</div>
                        <div>
                          <div style="font-weight:600;font-size:13px">{{ u.name }}</div>
                          <div style="font-size:11px;color:var(--text-secondary)">{{ u.email }}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="role-badge" [ngClass]="'role-' + u.role.toLowerCase().replace(' ','-')">{{ u.role }}</span></td>
                    <td>
                      <span class="badge" [ngClass]="u.status === 'Active' ? 'badge-success' : u.status === 'Suspended' ? 'badge-danger' : 'badge-warning'">
                        {{ u.status }}
                      </span>
                    </td>
                    <td>
                      <span class="material-icons-round" [style.color]="u.twoFa ? 'var(--success)' : 'var(--text-muted)'" style="font-size:18px">
                        {{ u.twoFa ? 'verified' : 'remove_circle_outline' }}
                      </span>
                    </td>
                    <td style="font-size:12px;color:var(--text-secondary)">{{ u.lastLogin }}</td>
                    <td style="font-size:13px;font-weight:600;color:var(--accent-cyan)">{{ u.sessions }}</td>
                    <td (click)="$event.stopPropagation()">
                      <div style="display:flex;gap:6px">
                        <button class="btn btn-secondary btn-sm">Edit</button>
                        @if (u.status === 'Active') {
                          <button class="btn btn-danger btn-sm">Suspend</button>
                        } @else {
                          <button class="btn btn-success btn-sm">Activate</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: Detail + Auth Settings -->
        <div class="detail-col">

          <!-- User Detail -->
          @if (selectedUser()) {
            <div class="card" style="padding:20px;margin-bottom:16px">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
                <div class="user-avatar-lg" [style.background]="selectedUser()!.avatarBg">{{ selectedUser()!.initials }}</div>
                <div>
                  <h4 style="font-size:15px;font-weight:700">{{ selectedUser()!.name }}</h4>
                  <div style="font-size:12px;color:var(--text-secondary)">{{ selectedUser()!.email }}</div>
                  <span class="role-badge" style="margin-top:6px;display:inline-block" [ngClass]="'role-' + selectedUser()!.role.toLowerCase().replace(' ','-')">{{ selectedUser()!.role }}</span>
                </div>
              </div>
              <div class="detail-grid">
                <div class="detail-field"><span>Status</span>
                  <span class="badge" [ngClass]="selectedUser()!.status === 'Active' ? 'badge-success' : 'badge-danger'">{{ selectedUser()!.status }}</span>
                </div>
                <div class="detail-field"><span>2FA</span><strong>{{ selectedUser()!.twoFa ? 'Enabled' : 'Disabled' }}</strong></div>
                <div class="detail-field"><span>Active Sessions</span><strong style="color:var(--accent-cyan)">{{ selectedUser()!.sessions }}</strong></div>
                <div class="detail-field"><span>Last Login</span><strong>{{ selectedUser()!.lastLogin }}</strong></div>
                <div class="detail-field"><span>Created</span><strong>{{ selectedUser()!.created }}</strong></div>
                <div class="detail-field"><span>KYC</span>
                  <span class="badge" [ngClass]="selectedUser()!.kyc === 'Approved' ? 'badge-success' : 'badge-warning'">{{ selectedUser()!.kyc }}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:16px">
                <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center">
                  <span class="material-icons-round" style="font-size:15px">key</span> Reset Password
                </button>
                <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center">
                  <span class="material-icons-round" style="font-size:15px">logout</span> Revoke Sessions
                </button>
              </div>
            </div>
          }

          <!-- Auth Settings -->
          <div class="card" style="padding:20px">
            <h4 style="margin-bottom:16px">Authentication Settings</h4>
            <div class="auth-settings">
              @for (s of authSettings; track s.label) {
                <div class="auth-setting-row">
                  <div class="auth-setting-info">
                    <strong>{{ s.label }}</strong>
                    <small>{{ s.desc }}</small>
                  </div>
                  <div class="toggle-switch" [class.on]="s.enabled" (click)="s.enabled = !s.enabled">
                    <div class="toggle-thumb"></div>
                  </div>
                </div>
              }
            </div>
            <div class="form-group" style="margin-top:16px">
              <label>Session Timeout</label>
              <select class="form-control form-select" name="st">
                <option>30 minutes</option>
                <option selected>1 hour</option>
                <option>4 hours</option>
                <option>8 hours</option>
              </select>
            </div>
            <div class="form-group">
              <label>Max Failed Attempts</label>
              <select class="form-control form-select" name="mfa">
                <option>3 attempts</option>
                <option selected>5 attempts</option>
                <option>10 attempts</option>
              </select>
            </div>
          </div>

          <!-- Active Sessions -->
          <div class="card" style="padding:20px;margin-top:16px">
            <h4 style="margin-bottom:14px">Recent Login Events</h4>
            <div class="login-events">
              @for (e of loginEvents; track e.time) {
                <div class="login-event">
                  <span class="material-icons-round" [style.color]="e.success ? 'var(--success)' : 'var(--danger)'" style="font-size:16px">
                    {{ e.success ? 'check_circle' : 'cancel' }}
                  </span>
                  <div class="event-info">
                    <strong>{{ e.user }}</strong>
                    <small>{{ e.ip }} · {{ e.location }}</small>
                  </div>
                  <span class="event-time">{{ e.time }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .identity-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
    .users-col { overflow: hidden; }
    .detail-col { display: flex; flex-direction: column; }
    .selected-row { background: rgba(0,212,255,0.05) !important; }

    .user-avatar-sm { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--bg-darkest); flex-shrink: 0; }
    .user-avatar-lg { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: var(--bg-darkest); flex-shrink: 0; }

    .role-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .role-super-admin { background: rgba(124,77,255,0.15); color: var(--accent-purple); }
    .role-admin { background: rgba(0,212,255,0.15); color: var(--accent-cyan); }
    .role-trader { background: rgba(23,195,178,0.15); color: var(--accent-teal); }
    .role-compliance { background: rgba(255,193,7,0.15); color: var(--warning); }
    .role-viewer { background: rgba(143,163,184,0.15); color: var(--text-secondary); }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .detail-field { display: flex; flex-direction: column; gap: 4px; span:first-child { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; } strong { font-size: 13px; } }

    .auth-settings { display: flex; flex-direction: column; gap: 2px; }
    .auth-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border-radius: var(--radius-sm); &:hover { background: var(--bg-card-hover); } }
    .auth-setting-info { flex: 1; strong { display: block; font-size: 13px; margin-bottom: 2px; } small { font-size: 11px; color: var(--text-secondary); } }

    .toggle-switch { width: 36px; height: 20px; border-radius: 10px; background: var(--border); cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0;
      &.on { background: var(--accent-cyan); }
      .toggle-thumb { width: 14px; height: 14px; border-radius: 50%; background: white; position: absolute; top: 3px; left: 3px; transition: left 0.2s; }
      &.on .toggle-thumb { left: 19px; }
    }

    .login-events { display: flex; flex-direction: column; gap: 2px; }
    .login-event { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: var(--radius-sm); &:hover { background: var(--bg-card-hover); } }
    .event-info { flex: 1; strong { display: block; font-size: 12px; } small { font-size: 11px; color: var(--text-secondary); } }
    .event-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
  `],
})
export class IdentityComponent {
  activeTab = signal('All Users');
  selectedUser = signal<any>(null);

  tabs = ['All Users', 'Admins', 'Traders', 'Compliance', 'Suspended'];

  kpis = [
    { label: 'Total Users', value: '248', icon: 'people', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)', color: 'var(--text-primary)' },
    { label: 'Active Sessions', value: '34', icon: 'devices', iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)', color: 'var(--accent-teal)' },
    { label: 'Failed Logins (24h)', value: '7', icon: 'warning', iconBg: 'rgba(255,71,87,0.1)', iconColor: 'var(--danger)', color: 'var(--danger)' },
    { label: '2FA Enabled', value: '89%', icon: 'verified', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)', color: 'var(--success)' },
  ];

  users = [
    { id: 1, name: 'Ahmed Hassan', email: 'ahmed.hassan@gccbond.com', role: 'Super Admin', status: 'Active', twoFa: true, lastLogin: '2 min ago', sessions: 2, created: 'Jan 10, 2024', kyc: 'Approved', initials: 'AH', avatarBg: 'linear-gradient(135deg,#00d4ff,#17c3b2)' },
    { id: 2, name: 'Sara Al-Rashid', email: 'sara.alrashid@gccbond.com', role: 'Compliance', status: 'Active', twoFa: true, lastLogin: '15 min ago', sessions: 1, created: 'Feb 3, 2024', kyc: 'Approved', initials: 'SR', avatarBg: 'linear-gradient(135deg,#7c4dff,#00d4ff)' },
    { id: 3, name: 'Mohammed Al-Ghamdi', email: 'm.alghamdi@gccbond.com', role: 'Trader', status: 'Active', twoFa: true, lastLogin: '1h ago', sessions: 1, created: 'Mar 1, 2024', kyc: 'Approved', initials: 'MA', avatarBg: 'linear-gradient(135deg,#17c3b2,#7c4dff)' },
    { id: 4, name: 'Fatima Zahra', email: 'fatima.zahra@gccbond.com', role: 'Trader', status: 'Active', twoFa: false, lastLogin: '3h ago', sessions: 1, created: 'Mar 15, 2024', kyc: 'Pending', initials: 'FZ', avatarBg: 'linear-gradient(135deg,#ffc107,#ff9800)' },
    { id: 5, name: 'Khalid Al-Otaibi', email: 'k.otaibi@gccbond.com', role: 'Admin', status: 'Active', twoFa: true, lastLogin: 'Yesterday', sessions: 0, created: 'Jan 22, 2024', kyc: 'Approved', initials: 'KO', avatarBg: 'linear-gradient(135deg,#00d4ff,#7c4dff)' },
    { id: 6, name: 'Noura Al-Subaie', email: 'noura@gccbond.com', role: 'Viewer', status: 'Suspended', twoFa: false, lastLogin: '5 days ago', sessions: 0, created: 'Apr 2, 2024', kyc: 'Rejected', initials: 'NS', avatarBg: 'linear-gradient(135deg,#8fa3b8,#4a5568)' },
  ];

  authSettings = [
    { label: 'Require 2FA for All Users', desc: 'Force two-factor authentication on login', enabled: true },
    { label: 'Email Verification', desc: 'Verify email address on registration', enabled: true },
    { label: 'IP Whitelisting', desc: 'Restrict access to approved IP ranges', enabled: false },
    { label: 'Account Lockout', desc: 'Lock account after failed login attempts', enabled: true },
    { label: 'Audit All Actions', desc: 'Log every user action to audit trail', enabled: true },
  ];

  loginEvents = [
    { user: 'Ahmed Hassan', ip: '185.42.18.20', location: 'Riyadh, SA', time: '2 min ago', success: true },
    { user: 'Sara Al-Rashid', ip: '94.171.22.110', location: 'Dubai, AE', time: '16 min ago', success: true },
    { user: 'Unknown', ip: '82.44.100.55', location: 'London, UK', time: '42 min ago', success: false },
    { user: 'Mohammed Al-Ghamdi', ip: '185.42.18.30', location: 'Jeddah, SA', time: '1h ago', success: true },
    { user: 'Unknown', ip: '103.21.244.0', location: 'Unknown', time: '2h ago', success: false },
  ];

  filteredUsers() {
    const tab = this.activeTab();
    if (tab === 'All Users') return this.users;
    if (tab === 'Admins') return this.users.filter(u => u.role === 'Admin' || u.role === 'Super Admin');
    if (tab === 'Traders') return this.users.filter(u => u.role === 'Trader');
    if (tab === 'Compliance') return this.users.filter(u => u.role === 'Compliance');
    if (tab === 'Suspended') return this.users.filter(u => u.status === 'Suspended');
    return this.users;
  }
}
