import { Component, signal, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { LayoutService } from './layout.service';
import { AuthService } from '../core/services/auth.service';

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
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  collapsed   = signal(false);
  readonly layout = inject(LayoutService);
  readonly auth   = inject(AuthService);

  readonly userInitials = computed(() => {
    const u = this.auth.user();
    if (!u) return '?';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  });

  readonly userName = computed(() => {
    const u = this.auth.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  readonly userRole = computed(() => this.auth.user()?.role ?? '');

  onNavClick() { this.layout.close(); }

  logout() { this.auth.logout(); }

  private readonly adminNavGroups: NavGroup[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: 'dashboard', route: '/' },
      ],
    },
    {
      title: 'User',
      items: [
        { label: 'Identity & Auth',   icon: 'lock',                   route: '/identity' },
        { label: 'KYC & Onboarding',  icon: 'verified_user',          route: '/kyc' },
        { label: 'Wallet & Payments', icon: 'account_balance_wallet', route: '/wallet' },
      ],
    },
    {
      title: 'Trading',
      items: [
        { label: 'Bond Marketplace', icon: 'public',      route: '/marketplace' },
        { label: 'Trading Engine',   icon: 'swap_horiz',  route: '/trading' },
        { label: 'Settlement',       icon: 'task_alt',    route: '/settlement' },
        { label: 'Portfolio Mgmt',   icon: 'trending_up', route: '/portfolio' },
      ],
    },
    {
      title: 'Compliance',
      items: [
        { label: 'AML & Compliance', icon: 'security', route: '/aml',   badge: '3', badgeClass: 'alert' },
        { label: 'Audit Trail',      icon: 'storage',  route: '/audit' },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Notifications', icon: 'notifications',   route: '/notifications' },
        { label: 'Admin Module',  icon: 'manage_accounts', route: '/admin' },
        { label: 'Scheduler',     icon: 'schedule',        route: '/scheduler' },
      ],
    },
  ];

  private readonly pendingNavGroups: NavGroup[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard',        icon: 'dashboard',    route: '/' },
      ],
    },
    {
      title: 'My Account',
      items: [
        { label: 'KYC & Onboarding', icon: 'verified_user', route: '/kyc' },
        { label: 'Notifications',    icon: 'notifications',  route: '/notifications' },
      ],
    },
  ];

  private readonly investorNavGroups: NavGroup[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: 'dashboard', route: '/' },
      ],
    },
    {
      title: 'My Account',
      items: [
        { label: 'KYC & Onboarding',  icon: 'verified_user',          route: '/kyc' },
        { label: 'Wallet & Payments', icon: 'account_balance_wallet', route: '/wallet' },
        { label: 'Notifications',     icon: 'notifications',          route: '/notifications' },
      ],
    },
    {
      title: 'Trading',
      items: [
        { label: 'Bond Marketplace', icon: 'public',      route: '/marketplace' },
        { label: 'Trading Engine',   icon: 'swap_horiz',  route: '/trading' },
        { label: 'My Portfolio',     icon: 'trending_up', route: '/portfolio' },
      ],
    },
  ];

  get navGroups(): NavGroup[] {
    if (this.auth.isAdmin())  return this.adminNavGroups;
    if (this.auth.isActive()) return this.investorNavGroups;
    return this.pendingNavGroups;
  }
}
