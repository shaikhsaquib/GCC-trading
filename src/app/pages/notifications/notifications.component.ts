import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  activeTab = signal('all');
  selectedType = signal('trade');

  tabs = [
    { key: 'all', label: 'All', count: 5 },
    { key: 'unread', label: 'Unread', count: 5 },
    { key: 'trade', label: 'Trade Alerts', count: null },
    { key: 'system', label: 'System', count: null },
    { key: 'kyc', label: 'KYC', count: null },
  ];

  notifTypes = [
    { key: 'trade', label: 'Trade Alert', icon: 'swap_horiz', color: 'var(--accent-purple)' },
    { key: 'payment', label: 'Payment', icon: 'payments', color: 'var(--accent-teal)' },
    { key: 'kyc', label: 'KYC Update', icon: 'verified_user', color: 'var(--accent-cyan)' },
    { key: 'aml', label: 'AML Alert', icon: 'security', color: 'var(--danger)' },
  ];

  channels = [
    { key: 'push', label: 'Push Notification', icon: 'notifications', enabled: true },
    { key: 'email', label: 'Email', icon: 'email', enabled: true },
    { key: 'sms', label: 'SMS', icon: 'sms', enabled: false },
  ];

  notifications = [
    { id: 1, title: 'Buy Order Executed', body: 'Your order to buy 5,000 units of Saudi Govt. Bond 2029 at SAR 101.45 has been successfully executed.', category: 'Trade', channels: ['push', 'email'], icon: 'trending_up', iconBg: 'rgba(124,77,255,0.12)', iconColor: 'var(--accent-purple)', time: '2 min ago', read: false },
    { id: 2, title: 'AML Alert — High Risk', body: 'A high-risk transaction pattern has been detected on account #8821. Immediate review required.', category: 'AML', channels: ['push', 'email', 'sms'], icon: 'security', iconBg: 'rgba(255,71,87,0.12)', iconColor: 'var(--danger)', time: '15 min ago', read: false },
    { id: 3, title: 'KYC Approved', body: 'Your identity verification (KYC) has been successfully approved. You now have full trading access.', category: 'KYC', channels: ['push', 'email'], icon: 'verified_user', iconBg: 'rgba(0,230,118,0.12)', iconColor: 'var(--success)', time: '1h ago', read: false },
    { id: 4, title: 'Deposit Confirmed', body: 'SAR 500,000 has been deposited to your account via SADAD. Funds are now available for trading.', category: 'Payment', channels: ['push', 'sms'], icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)', time: '2h ago', read: false },
    { id: 5, title: 'Coupon Payment Distributed', body: 'SAR 10,625 coupon payment for Saudi Govt. Bond 2029 has been credited to your wallet.', category: 'Payment', channels: ['push', 'email'], icon: 'payments', iconBg: 'rgba(23,195,178,0.12)', iconColor: 'var(--accent-teal)', time: '3h ago', read: false },
    { id: 6, title: 'Settlement Completed', body: 'Trade #TRD-20240414-021 has been successfully settled. Securities and cash have been transferred.', category: 'Trade', channels: ['push'], icon: 'task_alt', iconBg: 'rgba(46,213,115,0.12)', iconColor: 'var(--success)', time: 'Yesterday', read: true },
    { id: 7, title: 'System Maintenance', body: 'The trading platform will undergo scheduled maintenance on Apr 20, 2024, 02:00-04:00 AST.', category: 'System', channels: ['email'], icon: 'build', iconBg: 'rgba(255,193,7,0.12)', iconColor: 'var(--warning)', time: '2 days ago', read: true },
  ];

  preferences = [
    { label: 'Trade Executions', desc: 'Order filled, cancelled or expired', push: true, email: true, sms: true },
    { label: 'Price Alerts', desc: 'Bond price moves beyond threshold', push: true, email: false, sms: false },
    { label: 'Coupon Payments', desc: 'Coupon received or maturity', push: true, email: true, sms: false },
    { label: 'Settlement Updates', desc: 'T+1 settlement status changes', push: true, email: true, sms: false },
    { label: 'KYC Status', desc: 'Verification approved/rejected', push: true, email: true, sms: true },
    { label: 'AML Alerts', desc: 'Compliance and risk alerts', push: true, email: true, sms: true },
    { label: 'System Announcements', desc: 'Maintenance and feature updates', push: false, email: true, sms: false },
  ];

  filteredNotifs() {
    const tab = this.activeTab();
    if (tab === 'all') return this.notifications;
    if (tab === 'unread') return this.notifications.filter(n => !n.read);
    if (tab === 'trade') return this.notifications.filter(n => n.category === 'Trade');
    if (tab === 'system') return this.notifications.filter(n => n.category === 'System');
    if (tab === 'kyc') return this.notifications.filter(n => n.category === 'KYC');
    return this.notifications;
  }

  markAllRead() { this.notifications.forEach(n => n.read = true); }

  getPref(pref: Record<string, any>, ch: string): boolean { return !!pref[ch]; }
  togglePref(pref: Record<string, any>, ch: string): void { pref[ch] = !pref[ch]; }

  channelIcon(ch: string) {
    return { push: 'notifications', email: 'email', sms: 'sms' }[ch] || 'notifications';
  }
}
