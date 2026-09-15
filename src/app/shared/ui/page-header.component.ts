import { Component, input } from '@angular/core';

/**
 * Reusable page header (title + optional subtitle + an actions slot). Renders
 * the app's existing .page-header layout so every page's header is consistent.
 *
 * Usage:
 *   <app-page-header title="Admin Module" subtitle="Manage users…">
 *     <button actions class="btn btn-secondary">Export</button>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div class="page-title">
        <h2>{{ title() }}</h2>
        @if (subtitle()) { <p>{{ subtitle() }}</p> }
      </div>
      <div class="page-actions"><ng-content select="[actions]"></ng-content></div>
    </div>
  `,
})
export class PageHeaderComponent {
  title    = input('');
  subtitle = input('');
}
