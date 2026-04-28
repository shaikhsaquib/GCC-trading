import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { KycService } from '../../services/kyc.service';
import {
  KycSubmission, KycDocument, KycQueueItem, RiskLevel, DocumentType,
} from '../../core/models/api.models';

// ── Document metadata ─────────────────────────────────────────────────────────

interface DocMeta { label: string; icon: string; accept: string; required: boolean; hint: string; }

const DOC_META: Record<DocumentType, DocMeta> = {
  PASSPORT:         { label: 'Passport',          icon: 'book',     accept: 'image/*,application/pdf', required: true,  hint: 'Photo page clearly visible' },
  NATIONAL_ID:      { label: 'National ID',        icon: 'badge',    accept: 'image/*,application/pdf', required: false, hint: 'Front and back if possible' },
  DRIVING_LICENSE:  { label: 'Driving License',    icon: 'drive_eta',accept: 'image/*,application/pdf', required: false, hint: 'Optional — alternative ID' },
  PROOF_OF_ADDRESS: { label: 'Proof of Address',   icon: 'home',     accept: 'image/*,application/pdf', required: false, hint: 'Utility bill or bank statement < 3 months' },
  SELFIE:           { label: 'Selfie Photo',        icon: 'face',     accept: 'image/*',                 required: true,  hint: 'Clear photo of your face, no glasses' },
  LIVENESS_VIDEO:   { label: 'Liveness Video',      icon: 'videocam', accept: 'video/mp4',               required: false, hint: 'Short MP4 video, look straight at camera' },
};

const REQUIRED_DOCS: DocumentType[] = ['PASSPORT', 'SELFIE'];
const ALL_DOC_TYPES = Object.keys(DOC_META) as DocumentType[];

const RISK_LIMITS: Record<string, { limit: string; desc: string }> = {
  LOW:    { limit: '10,000 AED',  desc: 'Standard investor — orders up to 10,000 AED' },
  MEDIUM: { limit: '50,000 AED',  desc: 'Verified investor — orders up to 50,000 AED' },
  HIGH:   { limit: '200,000 AED', desc: 'Accredited investor — orders up to 200,000 AED' },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'video/mp4'];
const POLL_INTERVAL = 30_000; // 30 s

@Component({
  selector: 'app-kyc',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './kyc.component.html',
  styleUrl: './kyc.component.css',
})
export class KycComponent implements OnInit, OnDestroy {
  private readonly auth   = inject(AuthService);
  private readonly kycSvc = inject(KycService);

  // ── Role ──────────────────────────────────────────────────────────────────────
  readonly isAdmin = this.auth.isAdmin;

  // ── Admin state ───────────────────────────────────────────────────────────────
  searchTerm    = '';
  activeFilter  = signal('all');
  loading       = signal(false);
  actionLoading = signal(false);

  _queue       = signal<KycQueueItem[]>([]);
  totalQueue   = signal(0);
  selectedItem = signal<KycQueueItem | null>(null);

  kycStats = signal([
    { label: 'Total in Queue', value: '—', color: 'var(--text-primary)' },
    { label: 'Submitted',      value: '—', color: 'var(--warning)'      },
    { label: 'Under Review',   value: '—', color: 'var(--accent-cyan)'  },
    { label: 'Approved',       value: '—', color: 'var(--success)'      },
    { label: 'Rejected',       value: '—', color: 'var(--danger)'       },
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
  docsLoading     = signal(false);
  submission      = signal<KycSubmission | null>(null);

  // Keyed by DocumentType — populated from server on load, updated on upload
  uploadedDocs = signal<Partial<Record<DocumentType, KycDocument>>>({});
  uploadingDoc = signal<DocumentType | null>(null);
  uploadErrors = signal<Partial<Record<DocumentType, string>>>({});

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly allDocTypes   = ALL_DOC_TYPES;
  readonly requiredDocs  = REQUIRED_DOCS;
  readonly docMeta       = DOC_META;
  readonly riskLimits    = RISK_LIMITS;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngOnInit() {
    if (this.isAdmin()) {
      this.loadQueue();
    } else {
      this.loadMyStatus();
    }
  }

  ngOnDestroy() {
    this.clearPoll();
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
      { label: 'Total in Queue', value: String(total),                    color: 'var(--text-primary)' },
      { label: 'Submitted',      value: String(count('Submitted')),        color: 'var(--warning)'      },
      { label: 'Under Review',   value: String(count('UnderReview')),      color: 'var(--accent-cyan)'  },
      { label: 'Approved',       value: String(count('Approved')),         color: 'var(--success)'      },
      { label: 'Rejected',       value: String(count('Rejected')),         color: 'var(--danger)'       },
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
      Draft: 'Draft', Submitted: 'Pending',
      UnderReview: 'In Review', Approved: 'Approved', Rejected: 'Rejected',
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
      next: sub => {
        this.submission.set(sub);
        this.investorLoading.set(false);
        if (sub?.status === 'Draft') this.loadExistingDocs(sub.id);
        if (sub?.status === 'Submitted' || sub?.status === 'UnderReview') this.startPolling();
      },
      error: () => this.investorLoading.set(false),
    });
  }

  private loadExistingDocs(submissionId: string) {
    this.docsLoading.set(true);
    this.kycSvc.getDocuments(submissionId).subscribe({
      next: docs => {
        const map: Partial<Record<DocumentType, KycDocument>> = {};
        docs.forEach(d => { map[d.document_type] = d; });
        this.uploadedDocs.set(map);
        this.docsLoading.set(false);
      },
      error: () => this.docsLoading.set(false),
    });
  }

  startKyc() {
    this.investorLoading.set(true);
    this.kycSvc.startSubmission().subscribe({
      next: sub => { this.submission.set(sub); this.investorLoading.set(false); },
      error: () => this.investorLoading.set(false),
    });
  }

  onFileSelected(docType: DocumentType, event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    const sub   = this.submission();
    if (!file || !sub) return;

    // Clear previous error
    this.uploadErrors.update(e => ({ ...e, [docType]: undefined }));

    // Frontend validation
    if (file.size > MAX_FILE_SIZE) {
      this.uploadErrors.update(e => ({ ...e, [docType]: `File too large (max 10 MB, yours is ${this.formatBytes(file.size)})` }));
      input.value = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.uploadErrors.update(e => ({ ...e, [docType]: `Unsupported type: ${file.type}. Use JPG, PNG, PDF or MP4.` }));
      input.value = '';
      return;
    }

    this.uploadingDoc.set(docType);
    this.kycSvc.uploadDocument(sub.id, docType, file).subscribe({
      next: () => {
        // Optimistic update — real data matches what user selected
        const fakeDoc: KycDocument = {
          id: '',
          submission_id: sub.id,
          document_type: docType,
          mongo_doc_id: '',
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          status: 'Pending',
          created_at: new Date().toISOString(),
        };
        this.uploadedDocs.update(m => ({ ...m, [docType]: fakeDoc }));
        this.uploadingDoc.set(null);
        input.value = '';
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Upload failed — please try again';
        this.uploadErrors.update(e => ({ ...e, [docType]: msg }));
        this.uploadingDoc.set(null);
        input.value = '';
      },
    });
  }

  isDocUploaded(docType: DocumentType) {
    return !!this.uploadedDocs()[docType];
  }

  getUploadedDoc(docType: DocumentType) {
    return this.uploadedDocs()[docType];
  }

  isRequired(docType: DocumentType) {
    return REQUIRED_DOCS.includes(docType);
  }

  getError(docType: DocumentType): string | undefined {
    return this.uploadErrors()[docType];
  }

  uploadedCount() {
    return Object.keys(this.uploadedDocs()).length;
  }

  requiredMet() {
    return REQUIRED_DOCS.every(d => this.isDocUploaded(d));
  }

  canSubmit() {
    return this.requiredMet() && !this.uploadingDoc();
  }

  submitKyc() {
    const sub = this.submission();
    if (!sub || !this.canSubmit()) return;
    this.investorLoading.set(true);
    this.kycSvc.submit(sub.id).subscribe({
      next: () => {
        this.submission.update(s => s ? { ...s, status: 'Submitted' } : s);
        this.investorLoading.set(false);
        this.startPolling();
      },
      error: () => this.investorLoading.set(false),
    });
  }

  restartKyc() {
    this.investorLoading.set(true);
    this.clearPoll();
    this.kycSvc.startSubmission().subscribe({
      next: sub => {
        this.submission.set(sub);
        this.uploadedDocs.set({});
        this.uploadErrors.set({});
        this.investorLoading.set(false);
      },
      error: () => this.investorLoading.set(false),
    });
  }

  // ── Polling ───────────────────────────────────────────────────────────────────

  private startPolling() {
    this.clearPoll();
    this.pollTimer = setInterval(() => this.pollStatus(), POLL_INTERVAL);
  }

  private clearPoll() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  private pollStatus() {
    this.kycSvc.getMyStatus().subscribe({
      next: sub => {
        const prev = this.submission();
        this.submission.set(sub);
        // Stop polling when review is complete
        if (sub?.status === 'Approved' || sub?.status === 'Rejected') {
          this.clearPoll();
          // Reload page data if status changed
          if (prev?.status !== sub?.status) window.location.reload();
        }
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  formatBytes(bytes: number) {
    if (bytes < 1024)    return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  formatScore(score: number | null) {
    return score != null ? `${Math.round(score * 100)}%` : '—';
  }
}
