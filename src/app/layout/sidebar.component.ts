import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
  badgeClass?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">

      <!-- Brand -->
      <div class="brand">
        <div class="brand-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#brandGrad)"/>
            <path d="M8 20V12l8-4 8 4v8l-8 4-8-4z" fill="none" stroke="white" stroke-width="1.5"/>
            <path d="M8 12l8 4 8-4" stroke="white" stroke-width="1.5"/>
            <path d="M16 16v8" stroke="white" stroke-width="1.5"/>
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="32" y2="32">
                <stop stop-color="#00d4ff"/>
                <stop offset="1" stop-color="#17c3b2"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        @if (!collapsed()) {
          <div class="brand-text">
            <span class="brand-name">GCC Bond</span>
            <span class="brand-sub">Trading Platform</span>
          </div>
        }
        <button class="collapse-btn" (click)="collapsed.set(!collapsed())">
          <span class="material-icons-round">{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</span>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="nav">
        @for (group of navGroups; track group.title) {
          @if (!collapsed()) {
            <div class="nav-group-title">{{ group.title }}</div>
          }
          @for (item of group.items; track item.route) {
            <a
              class="nav-item"
              [routerLink]="item.route"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.route === '/' || item.route === '' }"
              [title]="collapsed() ? item.label : ''"
            >
              <span class="nav-icon material-icons-round">{{ item.icon }}</span>
              @if (!collapsed()) {
                <span class="nav-label">{{ item.label }}</span>
                @if (item.badge) {
                  <span class="nav-badge" [ngClass]="item.badgeClass || ''">{{ item.badge }}</span>
                }
              }
            </a>
          }
        }
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div class="user-info" [class.compact]="collapsed()">
          <div class="user-avatar">AH</div>
          @if (!collapsed()) {
            <div class="user-details">
              <span class="user-name">Ahmed Hassan</span>
              <span class="user-role">Super Admin</span>
            </div>
            <button class="btn btn-icon" title="Logout">
              <span class="material-icons-round" style="font-size:18px;color:var(--text-secondary)">logout</span>
            </button>
          }
        </div>
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .sidebar {
      width: var(--sidebar-width);
      height: 100%;
      background: var(--bg-dark);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      transition: width 0.25s ease;
      overflow: hidden;

      &.collapsed {
        width: 64px;
        .brand { padding: 16px 12px; justify-content: center; }
        .collapse-btn { margin-left: 0; }
      }
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      min-height: var(--header-height);
    }

    .brand-logo { flex-shrink: 0; }

    .brand-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .brand-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
    }

    .brand-sub {
      font-size: 10px;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .collapse-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      transition: color 0.2s;
      flex-shrink: 0;
      &:hover { color: var(--accent-cyan); }
      .material-icons-round { font-size: 18px; }
    }

    .nav {
      flex: 1;
      padding: 12px 8px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .nav-group-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 12px 12px 6px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
      margin-bottom: 2px;
      white-space: nowrap;
      position: relative;

      &:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }

      &.active {
        background: rgba(0, 212, 255, 0.1);
        color: var(--accent-cyan);
        .nav-icon { color: var(--accent-cyan); }

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: var(--accent-cyan);
          border-radius: 0 3px 3px 0;
        }
      }
    }

    .nav-icon {
      font-size: 20px;
      flex-shrink: 0;
      color: var(--text-muted);
    }

    .nav-label { flex: 1; }

    .nav-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      background: rgba(255, 71, 87, 0.2);
      color: var(--danger);
    }

    .sidebar-footer {
      border-top: 1px solid var(--border);
      padding: 12px 8px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: var(--bg-card-hover); }
      &.compact { justify-content: center; }
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-teal));
      color: var(--bg-darkest);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .user-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role {
      font-size: 11px;
      color: var(--accent-teal);
    }
  `],
})
export class SidebarComponent {
  collapsed = signal(false);

  navGroups: NavGroup[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: 'dashboard', route: '/' },
      ],
    },
    {
      title: 'User',
      items: [
        { label: 'Identity & Auth', icon: 'lock', route: '/identity' },
        { label: 'KYC & Onboarding', icon: 'verified_user', route: '/kyc' },
        { label: 'Wallet & Payments', icon: 'account_balance_wallet', route: '/wallet' },
      ],
    },
    {
      title: 'Trading',
      items: [
        { label: 'Bond Marketplace', icon: 'public', route: '/marketplace' },
        { label: 'Trading Engine', icon: 'swap_horiz', route: '/trading' },
        { label: 'Settlement', icon: 'task_alt', route: '/settlement' },
        { label: 'Portfolio Mgmt', icon: 'trending_up', route: '/portfolio' },
      ],
    },
    {
      title: 'Compliance',
      items: [
        { label: 'AML & Compliance', icon: 'security', route: '/aml', badge: '3', badgeClass: 'alert' },
        { label: 'Audit Trail', icon: 'storage', route: '/audit' },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Notifications', icon: 'notifications', route: '/notifications' },
        { label: 'Admin Module', icon: 'manage_accounts', route: '/admin' },
        { label: 'Scheduler', icon: 'schedule', route: '/scheduler' },
      ],
    },
  ];
}
