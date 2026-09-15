import { Component, input } from '@angular/core';

/**
 * Reusable empty-state block (icon + message) for lists/tables that return no
 * rows. Replaces the ad-hoc "nothing here" markup repeated across pages.
 *
 * Usage: <app-empty-state icon="group_off" message="No users match your search" />
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="ui-empty">
      <span class="material-icons-round" aria-hidden="true">{{ icon() }}</span>
      <div>{{ message() }}</div>
    </div>
  `,
  styles: [`
    .ui-empty { text-align: center; padding: 36px 16px; color: var(--text-muted); font-size: 13px; }
    .ui-empty .material-icons-round { font-size: 30px; display: block; margin-bottom: 8px; opacity: .6; }
  `],
})
export class EmptyStateComponent {
  icon    = input('inbox');
  message = input('Nothing here yet');
}
