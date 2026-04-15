import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-identity',
  standalone: true,
  imports: [NgClass],
  templateUrl: './identity.component.html',
  styleUrl: './identity.component.css',
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
