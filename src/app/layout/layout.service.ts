import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  mobileSidebarOpen = signal(false);

  toggle() { this.mobileSidebarOpen.update(v => !v); }
  close()  { this.mobileSidebarOpen.set(false); }
}
