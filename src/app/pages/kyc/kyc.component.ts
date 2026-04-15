import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-kyc',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="kyc-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>KYC & Onboarding</h2>
          <p>Identity verification and user approval workflow</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-node">Node.js</span>
          <button class="btn btn-secondary"><span class="material-icons-round">filter_list</span> Filters</button>
          <button class="btn btn-primary"><span class="material-icons-round">download</span> Export</button>
        </div>
      </div>

      <!-- KYC Stats -->
      <div class="stats-grid" style="grid-template-columns: repeat(5,1fr); margin-bottom:24px">
        @for (s of kycStats; track s.label) {
          <div class="stat-card" style="padding:16px">
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" [style.color]="s.color">{{ s.value }}</div>
          </div>
        }
      </div>

      <div class="kyc-layout">
        <!-- Left: User Queue -->
        <div class="queue-panel card">
          <div class="panel-header">
            <h4>Review Queue</h4>
            <span class="badge badge-warning">{{ pending }} pending</span>
          </div>

          <div class="search-bar" style="margin-bottom:14px">
            <span class="material-icons-round search-icon">search</span>
            <input class="form-control" style="width:100%;padding-left:36px" placeholder="Search users..." [(ngModel)]="searchTerm" name="sq"/>
          </div>

          <div class="filter-chips">
            @for (f of filters; track f.label) {
              <span class="chip" [class.active]="activeFilter() === f.value" (click)="activeFilter.set(f.value)">{{ f.label }}</span>
            }
          </div>

          <div class="user-queue">
            @for (user of filteredUsers(); track user.id) {
              <div class="user-row" [class.selected]="selectedUser()?.id === user.id" (click)="selectedUser.set(user)">
                <div class="user-avatar-sm" [style.background]="user.avatarColor">{{ user.initials }}</div>
                <div class="user-info-sm">
                  <strong>{{ user.name }}</strong>
                  <span>{{ user.email }}</span>
                  <span class="text-muted" style="font-size:11px">Submitted {{ user.submitted }}</span>
                </div>
                <div>
                  <span class="badge" [ngClass]="statusBadge(user.status)">{{ user.status }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right: Detail Panel -->
        <div class="detail-panel">
          @if (selectedUser()) {
            <div class="card fade-in">
              <!-- User header -->
              <div class="user-detail-header">
                <div class="user-avatar-lg" [style.background]="selectedUser()!.avatarColor">{{ selectedUser()!.initials }}</div>
                <div>
                  <h3>{{ selectedUser()!.name }}</h3>
                  <p class="text-muted">{{ selectedUser()!.email }}</p>
                  <p style="font-size:12px; color:var(--accent-cyan)">{{ selectedUser()!.nationality }} · {{ selectedUser()!.type }}</p>
                </div>
                <span class="badge" [ngClass]="statusBadge(selectedUser()!.status)" style="margin-left:auto">{{ selectedUser()!.status }}</span>
              </div>

              <div class="divider"></div>

              <!-- Info grid -->
              <div class="info-grid">
                @for (info of userInfoItems(); track info.label) {
                  <div class="info-item">
                    <span class="info-label">{{ info.label }}</span>
                    <span class="info-value">{{ info.value }}</span>
                  </div>
                }
              </div>

              <div class="divider"></div>

              <!-- Documents -->
              <h4 style="margin-bottom:14px">Submitted Documents</h4>
              <div class="docs-grid">
                @for (doc of selectedUser()!.docs; track doc.type) {
                  <div class="doc-card" [class.verified]="doc.verified">
                    <div class="doc-preview">
                      <span class="material-icons-round" style="font-size:36px;color:var(--text-muted)">{{ doc.icon }}</span>
                    </div>
                    <div class="doc-info">
                      <strong>{{ doc.label }}</strong>
                      <small>{{ doc.size }} · Uploaded {{ doc.uploaded }}</small>
                    </div>
                    <div class="doc-status">
                      @if (doc.verified) {
                        <span class="badge badge-success"><span class="material-icons-round" style="font-size:12px">check</span> Verified</span>
                      } @else {
                        <span class="badge badge-warning">Pending</span>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="divider"></div>

              <!-- Risk Score -->
              <div class="risk-section">
                <div class="risk-header">
                  <h4>Risk Assessment</h4>
                  <span class="risk-score" [style.color]="riskColor(selectedUser()!.risk)">{{ selectedUser()!.risk }}</span>
                </div>
                <div class="progress-bar" style="margin-top:8px">
                  <div class="progress-fill" [style.width]="riskWidth(selectedUser()!.risk)"></div>
                </div>
                <div class="risk-factors">
                  @for (f of riskFactors; track f.name) {
                    <div class="risk-factor">
                      <span class="material-icons-round" [style.color]="f.ok ? 'var(--success)' : 'var(--danger)'" style="font-size:16px">{{ f.ok ? 'check_circle' : 'cancel' }}</span>
                      {{ f.name }}
                    </div>
                  }
                </div>
              </div>

              <div class="divider"></div>

              <!-- Actions -->
              @if (selectedUser()!.status === 'Pending') {
                <div class="action-row">
                  <button class="btn btn-danger" style="flex:1; justify-content:center">
                    <span class="material-icons-round">close</span> Reject
                  </button>
                  <button class="btn btn-secondary" style="flex:1; justify-content:center">
                    <span class="material-icons-round">more_horiz</span> Request Docs
                  </button>
                  <button class="btn btn-success" style="flex:1; justify-content:center">
                    <span class="material-icons-round">check</span> Approve
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state card">
              <span class="material-icons-round empty-icon">person_search</span>
              <h4>Select a user</h4>
              <p>Click a user from the queue to review their KYC documents</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .kyc-layout { display: grid; grid-template-columns: 380px 1fr; gap: 20px; }

    .queue-panel { padding: 20px; }

    .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
      h4 { font-size: 14px; font-weight: 700; } }

    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }

    .user-queue { display: flex; flex-direction: column; gap: 2px; max-height: calc(100vh - 400px); overflow-y: auto; }

    .user-row {
      display: flex; align-items: center; gap: 12px; padding: 10px;
      border-radius: var(--radius-sm); cursor: pointer; transition: background 0.15s;
      &:hover { background: var(--bg-card-hover); }
      &.selected { background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.2); }
    }

    .user-avatar-sm {
      width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }

    .user-info-sm { flex: 1; display: flex; flex-direction: column; gap: 2px;
      strong { font-size: 13px; } span { font-size: 12px; color: var(--text-secondary); } }

    .user-detail-header { display: flex; align-items: center; gap: 16px; }

    .user-avatar-lg {
      width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 18px; font-weight: 700; color: white; flex-shrink: 0;
    }

    .info-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }

    .info-item { display: flex; flex-direction: column; gap: 4px; }

    .info-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    .info-value { font-size: 13px; font-weight: 500; color: var(--text-primary); }

    .docs-grid { display: flex; flex-direction: column; gap: 10px; }

    .doc-card {
      display: flex; align-items: center; gap: 14px; padding: 14px;
      background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md);
      &.verified { border-color: rgba(46,213,115,0.3); background: rgba(46,213,115,0.04); }
    }

    .doc-preview { width: 48px; height: 48px; background: var(--bg-surface); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

    .doc-info { flex: 1; strong { font-size: 13px; display: block; margin-bottom: 2px; } small { font-size: 11px; color: var(--text-secondary); } }

    .risk-section { }

    .risk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }

    .risk-score { font-size: 22px; font-weight: 700; }

    .risk-factors { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }

    .risk-factor { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }

    .action-row { display: flex; gap: 12px; }
  `],
})
export class KycComponent {
  searchTerm = '';
  activeFilter = signal('all');
  selectedUser = signal<any>(null);
  pending = 12;

  filters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'Pending' },
    { label: 'In Review', value: 'In Review' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' },
  ];

  kycStats = [
    { label: 'Total Users', value: '3,842', color: 'var(--text-primary)' },
    { label: 'Pending Review', value: '48', color: 'var(--warning)' },
    { label: 'Approved Today', value: '124', color: 'var(--success)' },
    { label: 'Rejected', value: '7', color: 'var(--danger)' },
    { label: 'Avg Review Time', value: '4.2h', color: 'var(--accent-cyan)' },
  ];

  users = [
    { id: 1, name: 'Mohammed Al-Rashid', email: 'm.rashid@example.com', initials: 'MR', avatarColor: '#7c4dff', nationality: 'Saudi', type: 'Individual', status: 'Pending', submitted: '2h ago', risk: 'LOW', nationalId: '1092847361', dob: '15/03/1985', phone: '+966 55 123 4567', docs: [{ type: 'id', icon: 'badge', label: 'National ID', size: '2.4 MB', uploaded: '2h ago', verified: false }, { type: 'selfie', icon: 'face', label: 'Selfie', size: '1.1 MB', uploaded: '2h ago', verified: true }, { type: 'bank', icon: 'account_balance', label: 'Bank Statement', size: '3.2 MB', uploaded: '2h ago', verified: false }] },
    { id: 2, name: 'Fatima Al-Zahrani', email: 'f.zahrani@example.com', initials: 'FZ', avatarColor: '#00d4ff', nationality: 'Saudi', type: 'Individual', status: 'In Review', submitted: '5h ago', risk: 'LOW', nationalId: '1034892761', dob: '22/07/1990', phone: '+966 50 987 6543', docs: [{ type: 'id', icon: 'badge', label: 'National ID', size: '1.8 MB', uploaded: '5h ago', verified: true }, { type: 'selfie', icon: 'face', label: 'Selfie', size: '0.9 MB', uploaded: '5h ago', verified: true }, { type: 'bank', icon: 'account_balance', label: 'Bank Statement', size: '2.7 MB', uploaded: '5h ago', verified: false }] },
    { id: 3, name: 'Khalid Al-Mutairi', email: 'k.mutairi@example.com', initials: 'KM', avatarColor: '#17c3b2', nationality: 'Kuwaiti', type: 'Corporate', status: 'Approved', submitted: '1d ago', risk: 'MEDIUM', nationalId: '2847361029', dob: '08/11/1978', phone: '+965 9 876 5432', docs: [{ type: 'id', icon: 'badge', label: 'Passport', size: '3.1 MB', uploaded: '1d ago', verified: true }, { type: 'selfie', icon: 'face', label: 'Selfie', size: '1.2 MB', uploaded: '1d ago', verified: true }, { type: 'bank', icon: 'account_balance', label: 'Commercial Registration', size: '4.5 MB', uploaded: '1d ago', verified: true }] },
    { id: 4, name: 'Omar Al-Farouqi', email: 'o.farouqi@example.com', initials: 'OF', avatarColor: '#ff4757', nationality: 'Emirati', type: 'Institution', status: 'Rejected', submitted: '2d ago', risk: 'HIGH', nationalId: '784-XXXX-XXXXX', dob: '30/05/1972', phone: '+971 50 234 5678', docs: [{ type: 'id', icon: 'badge', label: 'Emirates ID', size: '2.0 MB', uploaded: '2d ago', verified: false }, { type: 'selfie', icon: 'face', label: 'Selfie', size: '1.4 MB', uploaded: '2d ago', verified: false }, { type: 'bank', icon: 'account_balance', label: 'Bank Statement', size: '2.1 MB', uploaded: '2d ago', verified: false }] },
  ];

  riskFactors = [
    { name: 'Document authenticity verified', ok: true },
    { name: 'Sanctions list check passed', ok: true },
    { name: 'PEP (Politically Exposed Person) check', ok: true },
    { name: 'Source of funds declared', ok: false },
  ];

  filteredUsers() {
    return this.users.filter(u =>
      (this.activeFilter() === 'all' || u.status === this.activeFilter()) &&
      (u.name.toLowerCase().includes(this.searchTerm.toLowerCase()) || u.email.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  userInfoItems() {
    const u = this.selectedUser();
    if (!u) return [];
    return [
      { label: 'National ID', value: u.nationalId },
      { label: 'Date of Birth', value: u.dob },
      { label: 'Nationality', value: u.nationality },
      { label: 'Account Type', value: u.type },
      { label: 'Phone', value: u.phone },
      { label: 'Submitted', value: u.submitted },
    ];
  }

  statusBadge(status: string) {
    return { 'badge-warning': status === 'Pending', 'badge-info': status === 'In Review', 'badge-success': status === 'Approved', 'badge-danger': status === 'Rejected' };
  }

  riskColor(risk: string) { return risk === 'LOW' ? 'var(--success)' : risk === 'MEDIUM' ? 'var(--warning)' : 'var(--danger)'; }
  riskWidth(risk: string) { return risk === 'LOW' ? '20%' : risk === 'MEDIUM' ? '55%' : '85%'; }
}
