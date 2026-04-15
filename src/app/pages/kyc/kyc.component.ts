import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-kyc',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './kyc.component.html',
  styleUrl: './kyc.component.css',
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
