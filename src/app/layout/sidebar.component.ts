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
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
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
