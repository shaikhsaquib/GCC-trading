import { Component, input } from '@angular/core';

/**
 * Reusable KPI tile. Renders the app's existing .stat-card design so it looks
 * identical everywhere, but the markup lives in one place instead of being
 * copy-pasted into every stats grid (dashboard, admin, audit-trail, …).
 *
 * Usage: <app-stat-card [label]="'Total Users'" [value]="1240" [accent]="'var(--success)'" />
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="stat-card" style="padding:14px">
      <div class="stat-label">{{ label() }}</div>
      <div class="stat-value" style="font-size:20px" [style.color]="accent()">{{ value() }}</div>
    </div>
  `,
})
export class StatCardComponent {
  label  = input('');
  value  = input<string | number>('');
  accent = input<string | undefined>(undefined);
}
