import { Component, input } from '@angular/core';

/**
 * Reusable card / panel. Renders the app's global .card surface with an optional
 * header (title + an actions slot). Body content goes in the default slot.
 *
 * Usage:
 *   <app-card title="Recent Trades">
 *     <button actions class="btn btn-secondary btn-sm">Refresh</button>
 *     <!-- body -->
 *   </app-card>
 */
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.css',
})
export class CardComponent {
  title = input('');
}
