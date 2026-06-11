import { Component, inject } from '@angular/core';
import { ToastService, Toast } from '../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (t of toastSvc.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast-' + t.type">
          <span class="material-icons-round toast-icon">{{ icon(t) }}</span>
          <div class="toast-body">
            @if (t.title) { <div class="toast-title">{{ t.title }}</div> }
            <div class="toast-message">{{ t.message }}</div>
          </div>
          <button class="toast-close" (click)="toastSvc.dismiss(t.id)" aria-label="Dismiss notification">
            <span class="material-icons-round">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 76px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 380px;
      width: calc(100vw - 40px);
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: var(--radius-md, 10px);
      background: var(--bg-card, #0e1c30);
      border: 1px solid var(--border, #1a3050);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
      animation: toastIn 0.25s ease;
    }
    .toast-success { border-left: 3px solid var(--success, #2dd4a7); }
    .toast-error   { border-left: 3px solid var(--danger, #ff5470); }
    .toast-warning { border-left: 3px solid var(--warning, #ffb547); }
    .toast-info    { border-left: 3px solid var(--info, #00d4ff); }
    .toast-icon { font-size: 20px; margin-top: 1px; }
    .toast-success .toast-icon { color: var(--success, #2dd4a7); }
    .toast-error   .toast-icon { color: var(--danger, #ff5470); }
    .toast-warning .toast-icon { color: var(--warning, #ffb547); }
    .toast-info    .toast-icon { color: var(--info, #00d4ff); }
    .toast-body { flex: 1; min-width: 0; }
    .toast-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #e8f1fb); margin-bottom: 2px; }
    .toast-message { font-size: 12.5px; color: var(--text-secondary, #93a8c4); line-height: 1.45; word-wrap: break-word; }
    .toast-close {
      background: none; border: none; cursor: pointer; padding: 2px;
      color: var(--text-muted, #5c7396); border-radius: 6px; line-height: 0;
    }
    .toast-close:hover { color: var(--text-primary, #e8f1fb); background: rgba(255,255,255,0.06); }
    .toast-close .material-icons-round { font-size: 16px; }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(24px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @media (max-width: 480px) {
      .toast-stack { right: 10px; top: 66px; }
    }
  `],
})
export class ToastContainerComponent {
  readonly toastSvc = inject(ToastService);

  icon(t: Toast): string {
    switch (t.type) {
      case 'success': return 'check_circle';
      case 'error':   return 'error';
      case 'warning': return 'warning';
      default:        return 'info';
    }
  }
}
