import { Component, OnInit, signal, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { KycService } from '../../services/kyc.service';
import {
  KycSubmission, KycQueueItem, RiskLevel, DocumentType,
} from '../../core/models/api.models';

// ── Document metadata ─────────────────────────────────────────────────────────

const DOC_META: Record<DocumentType, { label: string; icon: string; accept: string }> = {
  PASSPORT:         { label: 'Passport',        icon: 'book',        accept: 'image/*,application/pdf' },
  NATIONAL_ID:      { label: 'National ID',      icon: 'badge',       accept: 'image/*,application/pdf' },
  DRIVING_LICENSE:  { label: 'Driving License',  icon: 'drive_eta',   accept: 'image/*,application/pdf' },
  PROOF_OF_ADDRESS: { label: 'Proof of Address', icon: 'home',        accept: 'image/*,application/pdf' },
  SELFIE:           { label: 'Selfie Photo',     icon: 'face',        accept: 'image/*' },
  LIVENESS_VIDEO:   { label: 'Liveness Video',   icon: 'videocam',    accept: 'video/mp4' },
};

const ALL_DOC_TYPES = Object.keys(DOC_META) as DocumentType[];

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-kyc',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './kyc.component.html',
  styleUrl: './kyc.component.css',
})
export class KycComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly kycSvc = inject(KycService);

  // ── Role ─────────────────────────────────────────────────────────────────────
  readonly isAdmin = this.auth.isAdmin;

  // ── Admin state ───────────────────────────────────────────────────────────────
  searchTerm   = '';
  activeFilter = signal('all');
  loading      = signal(false);
  actionLoading = signal(false);

  _queue     = signal<KycQueueItem[]>([]);
  totalQueue = signal(0);
  selectedItem = signal<KycQueueItem | null>(null);

  kycStats = signal([
    { label: 'Total in Queue', value: '—', color: 'var(--text-primary)' },
    { label: 'Submitted',      value: '—', color: 'var(--warning)' },
    { label: 'Under Review',   value: '—', color: 'var(--accent-cyan)' },
    { label: 'Approved',       value: '—', color: 'var(--success)' },
    { label: 'Rejected',       value: '—', color: 'var(--danger)' },
  ]);

  filters = [
    { label: 'All',          value: 'all'         },
    { label: 'Submitted',    value: 'Submitted'   },
    { label: 'Under Review', value: 'UnderReview' },
    { label: 'Approved',     value: 'Approved'    },
    { label: 'Rejected',     value: 'Rejected'    },
  ];

  showApproveForm = signal(false);
  showRejectForm  = signal(false);
  approveForm: { riskLevel: RiskLevel; notes: string } = { riskLevel: 'LOW', notes: '' };
  rejectForm = { reason: '' };

  // ── Investor state ────────────────────────────────────────────────────────────
  investorLoading = signal(false);
  submission      = signal<KycSubmission | null>(null);
  uploadedDocs    = signal<{ documentType: DocumentType; fileName: string; fileSize: number }[]>([]);
  uploadingDoc    = signal<DocumentType | null>(null);

  readonly allDocTypes = ALL_DOC_TYPES;
  readonly docMeta     = DOC_META;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit() {
    if (this.isAdmin()) {
      this.loadQueue();
    } else {
      this.loadMyStatus();
    }
  }

  // ── Admin methods ─────────────────────────────────────────────────────────────

  loadQueue() {
    this.loading.set(true);
    const filter = this.activeFilter();
    this.kycSvc.getQueue(filter === 'all' ? undefined : filter).subscribe({
      next: result => {
        this._queue.set(result.data);
        this.totalQueue.set(result.total);
        this.computeStats(result.data, result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  computeStats(items: KycQueueItem[], total: number) {
    const count = (s: string) => items.filter(i => i.status === s).length;
    this.kycStats.set([
      { label: 'Total in Queue', value: String(total),           color: 'var(--text-primary)' },
      { label: 'Submitted',      value: String(count('Submitted')),   color: 'var(--warning)'      },
      { label: 'Under Review',   value: String(count('UnderReview')), color: 'var(--accent-cyan)'  },
      { label: 'Approved',       value: String(count('Approved')),    color: 'var(--success)'      },
      { label: 'Rejected',       value: String(count('Rejected')),    color: 'var(--danger)'       },
    ]);
  }

  applyFilter(value: string) {
    this.activeFilter.set(value);
    this.selectedItem.set(null);
    this.loadQueue();
  }

  filteredItems() {
    const term = this.searchTerm.toLowerCase();
    if (!term) return this._queue();
    return this._queue().filter(u =>
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term),
    );
  }

  selectItem(item: KycQueueItem) {
    this.selectedItem.set(item);
    this.showApproveForm.set(false);
    this.showRejectForm.set(false);
    this.approveForm = { riskLevel: 'LOW', notes: '' };
    this.rejectForm  = { reason: '' };
  }

  confirmApprove() {
    const item = this.selectedItem();
    if (!item) return;
    this.actionLoading.set(true);
    this.kycSvc.approve(item.id, this.approveForm.riskLevel, this.approveForm.notes || undefined)
      .subscribe({
        next: () => {
          this._queue.update(q =>
            q.map(i => i.id === item.id
              ? { ...i, status: 'Approved' as const, risk_level: this.approveForm.riskLevel }
              : i),
          );
          this.selectedItem.update(i =>
            i ? { ...i, status: 'Approved' as const, risk_level: this.approveForm.riskLevel } : i,
          );
          this.showApproveForm.set(false);
          this.actionLoading.set(false);
        },
        error: () => this.actionLoading.set(false),
      });
  }

  confirmReject() {
    const item = this.selectedItem();
    if (!item || !this.rejectForm.reason.trim()) return;
    this.actionLoading.set(true);
    this.kycSvc.reject(item.id, this.rejectForm.reason).subscribe({
      next: () => {
        this._queue.update(q =>
          q.map(i => i.id === item.id ? { ...i, status: 'Rejected' as const } : i),
        );
        this.selectedItem.update(i => i ? { ...i, status: 'Rejected' as const } : i);
        this.showRejectForm.set(false);
        this.actionLoading.set(false);
      },
      error: () => this.actionLoading.set(false),
    });
  }

  // ── Admin display helpers ─────────────────────────────────────────────────────

  initials(item: KycQueueItem) {
    return `${item.first_name[0] ?? ''}${item.last_name[0] ?? ''}`.toUpperCase();
  }

  avatarColor(item: KycQueueItem) {
    const palette = ['#7c4dff', '#00d4ff', '#17c3b2', '#ff4757', '#ffa502', '#2ed573'];
    const code = (item.id.charCodeAt(0) ?? 0) + (item.id.charCodeAt(1) ?? 0);
    return palette[code % palette.length];
  }

  statusBadge(status: string) {
    return {
      'badge-warning': status === 'Submitted',
      'badge-info':    status === 'UnderReview',
      'badge-success': status === 'Approved',
      'badge-danger':  status === 'Rejected',
    };
  }

  statusLabel(status: string) {
    const labels: Record<string, string> = {
      Draft:       'Draft',
      Submitted:   'Pending',
      UnderReview: 'In Review',
      Approved:    'Approved',
      Rejected:    'Rejected',
    };
    return labels[status] ?? status;
  }

  riskColor(risk: string | null) {
    return risk === 'LOW' ? 'var(--success)' : risk === 'MEDIUM' ? 'var(--warning)' : 'var(--danger)';
  }

  riskWidth(risk: string | null) {
    return risk === 'LOW' ? '25%' : risk === 'MEDIUM' ? '55%' : '85%';
  }

  formatDate(date: string | null) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-AE', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  relativeTime(date: string | null) {
    if (!date) return '—';
    const diff  = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1)  return `${Math.floor(diff / 60000)}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  // ── Investor methods ──────────────────────────────────────────────────────────

  loadMyStatus() {
    this.investorLoading.set(true);
    this.kycSvc.getMyStatus().subscribe({
      next:  sub => { this.submission.set(sub); this.investorLoading.set(false); },
      error: ()  => this.investorLoading.set(false),
    });
  }

  startKyc() {
    this.investorLoading.set(true);
    this.kycSvc.startSubmission().subscribe({
      next:  sub => { this.submission.set(sub); this.investorLoading.set(false); },
      error: ()  => this.investorLoading.set(false),
    });
  }

  onFileSelected(docType: DocumentType, event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    const sub   = this.submission();
    if (!file || !sub) return;

    this.uploadingDoc.set(docType);
    this.kycSvc.uploadDocument(sub.id, docType, file).subscribe({
      next: () => {
        this.uploadedDocs.update(docs => [
          ...docs.filter(d => d.documentType !== docType),
          { documentType: docType, fileName: file.name, fileSize: file.size },
        ]);
        this.uploadingDoc.set(null);
        input.value = '';
      },
      error: () => this.uploadingDoc.set(null),
    });
  }

  isDocUploaded(docType: DocumentType) {
    return this.uploadedDocs().some(d => d.documentType === docType);
  }

  canSubmit() {
    return this.uploadedDocs().length >= 2;
  }

  submitKyc() {
    const sub = this.submission();
    if (!sub || !this.canSubmit()) return;
    this.investorLoading.set(true);
    this.kycSvc.submit(sub.id).subscribe({
      next: () => {
        this.submission.update(s => s ? { ...s, status: 'Submitted' } : s);
        this.investorLoading.set(false);
      },
      error: () => this.investorLoading.set(false),
    });
  }

  restartKyc() {
    this.investorLoading.set(true);
    this.kycSvc.startSubmission().subscribe({
      next: sub => {
        this.submission.set(sub);
        this.uploadedDocs.set([]);
        this.investorLoading.set(false);
      },
      error: () => this.investorLoading.set(false),
    });
  }

  getUploadedDoc(docType: DocumentType) {
    return this.uploadedDocs().find(d => d.documentType === docType);
  }

  formatBytes(bytes: number) {
    if (bytes < 1024)    return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  formatScore(score: number | null) {
    return score != null ? `${Math.round(score * 100)}%` : '—';
  }
}
