import { Component, input, output } from '@angular/core';

/**
 * Reusable modal dialog. Shows when [open] is true; emits (close) on the X
 * button or a backdrop click. Body goes in the default slot, footer actions in
 * an element marked `footer`.
 *
 * Usage:
 *   <app-modal [open]="showDialog()" title="Confirm" (close)="showDialog.set(false)">
 *     <p>Are you sure?</p>
 *     <div footer>
 *       <app-button variant="secondary" (click)="showDialog.set(false)">Cancel</app-button>
 *       <app-button variant="danger" (click)="confirm()">Delete</app-button>
 *     </div>
 *   </app-modal>
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
})
export class ModalComponent {
  open  = input(false);
  title = input('');
  close = output<void>();
}
