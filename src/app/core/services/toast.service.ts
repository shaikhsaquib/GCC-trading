import { Injectable, signal } from '@angular/core';

export interface Toast {
  id:      number;
  type:    'success' | 'error' | 'info' | 'warning';
  title?:  string;
  message: string;
}

/**
 * Global toast notifications. Inject and call toast.success(...) / toast.error(...)
 * from any component or service; ToastContainerComponent (in the main layout)
 * renders the stack.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string, title?: string): void { this.push('success', message, title); }
  info(message: string, title?: string):    void { this.push('info', message, title); }
  warning(message: string, title?: string): void { this.push('warning', message, title); }
  error(message: string, title?: string):   void { this.push('error', message, title, 6500); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(type: Toast['type'], message: string, title?: string, duration = 4000): void {
    const toast: Toast = { id: ++this.nextId, type, message, title };
    // Cap the stack at 5 so a burst of failures doesn't fill the screen
    this.toasts.update(list => [...list, toast].slice(-5));
    setTimeout(() => this.dismiss(toast.id), duration);
  }
}
