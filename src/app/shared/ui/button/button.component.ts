import { Component, input } from '@angular/core';

/**
 * Reusable button. Renders the app's global .btn classes so it looks identical
 * to existing buttons, but adds typed variants, sizes, an optional leading icon
 * and a built-in loading spinner (which also disables the button).
 *
 * Usage:
 *   <app-button variant="secondary" icon="file_download" (click)="export()">Export</app-button>
 *   <app-button variant="danger" [loading]="saving()">Delete</app-button>
 */
@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './button.component.html',
  styleUrl: './button.component.css',
})
export class ButtonComponent {
  variant  = input<'primary' | 'secondary' | 'danger' | 'success'>('primary');
  size     = input<'sm' | 'md' | 'lg'>('md');
  type     = input<'button' | 'submit'>('button');
  icon     = input<string | undefined>(undefined);
  disabled = input(false);
  loading  = input(false);
}
