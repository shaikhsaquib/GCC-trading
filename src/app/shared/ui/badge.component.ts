import { Component, input, computed } from '@angular/core';
import { NgClass } from '@angular/common';

/**
 * Reusable status pill. A page passes a semantic `tone`; the component maps it
 * to the app's existing .badge-* classes. Replaces the per-page badge-class
 * maps (kycBadge / userStatusBadge / caseBadge / severityClass …) scattered
 * across admin, aml, settlement, wallet, scheduler, etc.
 *
 * Usage: <app-badge tone="success">Approved</app-badge>
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [NgClass],
  template: `<span class="badge" [ngClass]="cssClass()"><ng-content></ng-content></span>`,
})
export class BadgeComponent {
  tone = input<'success' | 'warning' | 'danger' | 'info' | 'neutral'>('neutral');

  protected cssClass = computed(() => ({
    'badge-success': this.tone() === 'success',
    'badge-warning': this.tone() === 'warning',
    'badge-danger':  this.tone() === 'danger',
    'badge-info':    this.tone() === 'info',
  }));
}
