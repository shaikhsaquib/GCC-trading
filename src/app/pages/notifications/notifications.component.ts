import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="notif-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Notifications</h2>
          <p>Manage alerts, send push/email/SMS notifications</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-node">Node.js</span>
          <button class="btn btn-secondary" (click)="markAllRead()">
            <span class="material-icons-round">done_all</span> Mark All Read
          </button>
          <button class="btn btn-primary">
            <span class="material-icons-round">send</span> Send Notification
          </button>
        </div>
      </div>

      <div class="notif-layout">
        <!-- Left: Notification Feed -->
        <div class="feed-col">
          <!-- Tab bar -->
          <div class="tab-bar">
            @for (tab of tabs; track tab.label) {
              <div class="tab" [class.active]="activeTab() === tab.key" (click)="activeTab.set(tab.key)">
                {{ tab.label }}
                @if (tab.count) { <span class="tab-count">{{ tab.count }}</span> }
              </div>
            }
          </div>

          <!-- Notification list -->
          <div class="notif-list">
            @for (n of filteredNotifs(); track n.id) {
              <div class="notif-item" [class.unread]="!n.read" (click)="n.read = true">
                <div class="notif-icon-wrapper" [style.background]="n.iconBg">
                  <span class="material-icons-round" [style.color]="n.iconColor">{{ n.icon }}</span>
                </div>
                <div class="notif-content">
                  <div class="notif-header-row">
                    <strong>{{ n.title }}</strong>
                    <span class="notif-time">{{ n.time }}</span>
                  </div>
                  <p class="notif-body">{{ n.body }}</p>
                  <div class="notif-tags">
                    <span class="chip" style="font-size:10px;padding:2px 8px">{{ n.category }}</span>
                    @for (ch of n.channels; track ch) {
                      <span class="channel-tag">
                        <span class="material-icons-round" style="font-size:12px">{{ channelIcon(ch) }}</span>
                        {{ ch }}
                      </span>
                    }
                  </div>
                </div>
                @if (!n.read) { <div class="unread-dot"></div> }
              </div>
            }
          </div>
        </div>

        <!-- Right: Settings + Compose -->
        <div class="settings-col">

          <!-- Compose Panel -->
          <div class="card compose-card">
            <h4 style="margin-bottom:16px">Send Notification</h4>
            <div class="form-group">
              <label>Target Audience</label>
              <select class="form-control form-select" name="target">
                <option>All Users</option>
                <option>KYC Approved Users</option>
                <option>Active Traders</option>
                <option>Specific User</option>
              </select>
            </div>
            <div class="form-group">
              <label>Notification Type</label>
              <div class="notif-type-grid">
                @for (t of notifTypes; track t.key) {
                  <div class="notif-type-card" [class.selected]="selectedType() === t.key" (click)="selectedType.set(t.key)">
                    <span class="material-icons-round" style="font-size:20px" [style.color]="t.color">{{ t.icon }}</span>
                    <span>{{ t.label }}</span>
                  </div>
                }
              </div>
            </div>
            <div class="form-group">
              <label>Title</label>
              <input class="form-control" type="text" placeholder="Notification title" name="nt"/>
            </div>
            <div class="form-group">
              <label>Message</label>
              <textarea class="form-control" rows="3" placeholder="Notification body..." name="nm" style="resize:none"></textarea>
            </div>
            <div class="form-group">
              <label>Delivery Channels</label>
              <div class="channel-toggles">
                @for (ch of channels; track ch.key) {
                  <label class="channel-toggle" [class.enabled]="ch.enabled">
                    <input type="checkbox" [(ngModel)]="ch.enabled" [name]="ch.key" style="display:none"/>
                    <span class="material-icons-round" style="font-size:18px">{{ ch.icon }}</span>
                    <span>{{ ch.label }}</span>
                    <span class="toggle-indicator">{{ ch.enabled ? 'ON' : 'OFF' }}</span>
                  </label>
                }
              </div>
            </div>
            <button class="btn btn-primary" style="width:100%;justify-content:center">
              <span class="material-icons-round">send</span> Send Now
            </button>
          </div>

          <!-- Preferences -->
          <div class="card pref-card">
            <h4 style="margin-bottom:16px">Notification Preferences</h4>
            <div class="pref-list">
              @for (pref of preferences; track pref.label) {
                <div class="pref-item">
                  <div class="pref-info">
                    <strong>{{ pref.label }}</strong>
                    <small>{{ pref.desc }}</small>
                  </div>
                  <div class="pref-channels">
                    @for (ch of ['push','email','sms']; track ch) {
                      <div class="pref-ch" [class.on]="getPref(pref, ch)" (click)="togglePref(pref, ch)">
                        <span class="material-icons-round" style="font-size:14px">{{ channelIcon(ch) }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notif-layout { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }

    .feed-col { display: flex; flex-direction: column; }

    .tab-count { background: var(--danger); color: white; border-radius: 10px; font-size: 10px; font-weight: 700; padding: 1px 6px; margin-left: 6px; }

    .notif-list { display: flex; flex-direction: column; gap: 2px; }

    .notif-item {
      display: flex; align-items: flex-start; gap: 14px; padding: 14px;
      border-radius: var(--radius-md); transition: background 0.15s; cursor: pointer; position: relative;
      &:hover { background: var(--bg-card); }
      &.unread { background: rgba(0,212,255,0.04); border-left: 3px solid var(--accent-cyan); padding-left: 11px; }
    }

    .notif-icon-wrapper { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; .material-icons-round { font-size: 20px; } }

    .notif-content { flex: 1; }

    .notif-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px; strong { font-size: 13px; } }

    .notif-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

    .notif-body { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px; }

    .notif-tags { display: flex; align-items: center; gap: 6px; }

    .channel-tag { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--text-muted); }

    .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-cyan); flex-shrink: 0; margin-top: 4px; }

    .settings-col { display: flex; flex-direction: column; gap: 16px; }

    .compose-card { padding: 20px; }

    .notif-type-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }

    .notif-type-card { display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-input); cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s; &.selected { border-color: var(--accent-cyan); background: rgba(0,212,255,0.06); } &:hover:not(.selected) { border-color: var(--border-light); } }

    .channel-toggles { display: flex; flex-direction: column; gap: 8px; }

    .channel-toggle { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; color: var(--text-secondary); transition: all 0.15s; &.enabled { border-color: var(--accent-teal); color: var(--text-primary); background: rgba(23,195,178,0.06); } .material-icons-round { color: var(--text-muted); } &.enabled .material-icons-round { color: var(--accent-teal); } }

    .toggle-indicator { margin-left: auto; font-size: 10px; font-weight: 700; }
    .channel-toggle.enabled .toggle-indicator { color: var(--accent-teal); }

    .pref-card { padding: 20px; }

    .pref-list { display: flex; flex-direction: column; gap: 2px; }

    .pref-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: var(--radius-sm); &:hover { background: var(--bg-card-hover); } }

    .pref-info { flex: 1; strong { display: block; font-size: 13px; margin-bottom: 2px; } small { font-size: 11px; color: var(--text-secondary); } }

    .pref-channels { display: flex; gap: 4px; }

    .pref-ch { width: 28px; height: 28px; border-radius: 6px; background: var(--bg-surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; color: var(--text-muted); &.on { background: rgba(0,212,255,0.1); border-color: var(--accent-cyan); color: var(--accent-cyan); } }
  `],
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
