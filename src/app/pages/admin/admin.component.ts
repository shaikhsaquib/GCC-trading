import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
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
