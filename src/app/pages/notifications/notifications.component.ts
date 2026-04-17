import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../services/notifications.service';
import { Notification } from '../../core/models/api.models';

interface NotifDisplay {
  id:        string;
  title:     string;
  body:      string;
  category:  string;
  channels:  string[];
  icon:      string;
  iconBg:    string;
  iconColor: string;
  time:      string;
  read:      boolean;
}

// Maps eventType → display metadata
const EVENT_META: Record<string, { title: string; icon: string; bg: string; color: string; category: string }> = {
  ORDER_EXECUTED:        { title: 'Order Executed',          icon: 'swap_horiz',            bg: 'rgba(124,77,255,0.12)', color: 'var(--accent-purple)', category: 'Trade' },
  ORDER_CANCELLED:       { title: 'Order Cancelled',         icon: 'cancel',                bg: 'rgba(255,71,87,0.12)',  color: 'var(--danger)',        category: 'Trade' },
  COUPON_DISTRIBUTED:    { title: 'Coupon Payment',          icon: 'payments',              bg: 'rgba(23,195,178,0.12)', color: 'var(--accent-teal)',   category: 'Payment' },
  DEPOSIT_COMPLETED:     { title: 'Deposit Confirmed',       icon: 'account_balance_wallet', bg: 'rgba(0,212,255,0.12)', color: 'var(--accent-cyan)',   category: 'Payment' },
  WITHDRAWAL_COMPLETED:  { title: 'Withdrawal Processed',    icon: 'remove_circle',         bg: 'rgba(255,71,87,0.12)', color: 'var(--danger)',        category: 'Payment' },
  KYC_APPROVED:          { title: 'KYC Approved',            icon: 'verified_user',         bg: 'rgba(0,230,118,0.12)', color: 'var(--success)',       category: 'KYC' },
  KYC_REJECTED:          { title: 'KYC Rejected',            icon: 'gpp_bad',               bg: 'rgba(255,71,87,0.12)', color: 'var(--danger)',        category: 'KYC' },
  AML_ALERT:             { title: 'AML Alert',               icon: 'security',              bg: 'rgba(255,71,87,0.12)', color: 'var(--danger)',        category: 'AML' },
  SETTLEMENT_COMPLETED:  { title: 'Settlement Completed',    icon: 'task_alt',              bg: 'rgba(46,213,115,0.12)', color: 'var(--success)',      category: 'Trade' },
  MATURITY_PAYMENT:      { title: 'Maturity Payment',        icon: 'account_balance',       bg: 'rgba(0,212,255,0.12)', color: 'var(--accent-cyan)',   category: 'Payment' },
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent implements OnInit {
  private readonly notifSvc = inject(NotificationsService);
  readonly auth             = inject(AuthService);
  readonly isAdmin          = this.auth.isAdmin;

  activeTab    = signal('all');
  selectedType = signal('trade');
  loading      = signal(true);
  error        = signal<string | null>(null);

  tabs = [
    { key: 'all',    label: 'All',          count: 0 },
    { key: 'unread', label: 'Unread',       count: 0 },
    { key: 'trade',  label: 'Trade Alerts', count: null },
    { key: 'system', label: 'System',       count: null },
    { key: 'kyc',    label: 'KYC',          count: null },
  ];

  // Admin-only: AML Alert type used in the compose panel
  notifTypes = [
    { key: 'trade',   label: 'Trade Alert',  icon: 'swap_horiz',    color: 'var(--accent-purple)' },
    { key: 'payment', label: 'Payment',      icon: 'payments',      color: 'var(--accent-teal)' },
    { key: 'kyc',     label: 'KYC Update',   icon: 'verified_user', color: 'var(--accent-cyan)' },
    { key: 'aml',     label: 'AML Alert',    icon: 'security',      color: 'var(--danger)' },
  ];

  channels = [
    { key: 'push',  label: 'Push Notification', icon: 'notifications', enabled: true },
    { key: 'email', label: 'Email',              icon: 'email',         enabled: true },
    { key: 'sms',   label: 'SMS',                icon: 'sms',           enabled: false },
  ];

  private readonly allPreferences = [
    { label: 'Trade Executions',    desc: 'Order filled, cancelled or expired',  push: true,  email: true,  sms: true,  adminOnly: false },
    { label: 'Price Alerts',        desc: 'Bond price moves beyond threshold',   push: true,  email: false, sms: false, adminOnly: false },
    { label: 'Coupon Payments',     desc: 'Coupon received or maturity',         push: true,  email: true,  sms: false, adminOnly: false },
    { label: 'Settlement Updates',  desc: 'T+1 settlement status changes',       push: true,  email: true,  sms: false, adminOnly: false },
    { label: 'KYC Status',          desc: 'Verification approved/rejected',      push: true,  email: true,  sms: true,  adminOnly: false },
    { label: 'AML Alerts',          desc: 'Compliance and risk alerts',          push: true,  email: true,  sms: true,  adminOnly: true  },
    { label: 'System Announcements',desc: 'Maintenance and feature updates',     push: false, email: true,  sms: false, adminOnly: false },
  ];

  get preferences() {
    return this.isAdmin()
      ? this.allPreferences
      : this.allPreferences.filter(p => !p.adminOnly);
  }

  private _allNotifs = signal<NotifDisplay[]>([]);

  get notifications() {
    return this._allNotifs();
  }

  ngOnInit() {
    this.loadNotifications();
  }

  private loadNotifications() {
    this.notifSvc.getAll(50).subscribe({
      next: raw => {
        this.loading.set(false);
        const mapped = raw.map(n => this.mapNotif(n));
        this._allNotifs.set(mapped);
        this.updateTabCounts(mapped);
      },
      error: () => this.loading.set(false),
    });
  }

  private mapNotif(n: Notification): NotifDisplay {
    const meta = EVENT_META[n.eventType] ?? {
      title: n.eventType.replace(/_/g, ' '),
      icon: 'notifications', bg: 'rgba(0,212,255,0.12)', color: 'var(--accent-cyan)', category: 'System',
    };
    return {
      id:        n.id,
      title:     n.vars['title'] ?? meta.title,
      body:      n.vars['body'] ?? n.vars['description'] ?? '',
      category:  meta.category,
      channels:  n.channels,
      icon:      meta.icon,
      iconBg:    meta.bg,
      iconColor: meta.color,
      time:      this.relativeTime(n.createdAt),
      read:      n.read,
    };
  }

  private relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }

  private updateTabCounts(notifs: NotifDisplay[]) {
    const total  = notifs.length;
    const unread = notifs.filter(n => !n.read).length;
    this.tabs = this.tabs.map(t => {
      if (t.key === 'all')    return { ...t, count: total };
      if (t.key === 'unread') return { ...t, count: unread };
      return t;
    });
  }

  filteredNotifs() {
    const tab = this.activeTab();
    const all = this._allNotifs();
    if (tab === 'all')    return all;
    if (tab === 'unread') return all.filter(n => !n.read);
    if (tab === 'trade')  return all.filter(n => n.category === 'Trade');
    if (tab === 'system') return all.filter(n => n.category === 'System');
    if (tab === 'kyc')    return all.filter(n => n.category === 'KYC');
    return all;
  }

  markRead(id: string) {
    const notif = this._allNotifs().find(n => n.id === id);
    if (!notif || notif.read) return;
    this.notifSvc.markRead(id).subscribe({
      next: () => {
        this._allNotifs.update(list =>
          list.map(n => n.id === id ? { ...n, read: true } : n)
        );
        this.updateTabCounts(this._allNotifs());
      },
    });
  }

  markAllRead() {
    this.notifSvc.markAllRead().subscribe({
      next: () => {
        this._allNotifs.update(list => list.map(n => ({ ...n, read: true })));
        this.updateTabCounts(this._allNotifs());
      },
    });
  }

  getPref(pref: Record<string, any>, ch: string): boolean { return !!pref[ch]; }
  togglePref(pref: Record<string, any>, ch: string): void { pref[ch] = !pref[ch]; }

  channelIcon(ch: string) {
    return ({ push: 'notifications', email: 'email', sms: 'sms' } as Record<string, string>)[ch] || 'notifications';
  }
}
