import { Injectable, signal } from '@angular/core';

/**
 * Shared UI state service.
 * Keeps sidebar open/close state for mobile so AppShell and Sidebar
 * can communicate without direct ViewChild coupling.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  sidebarOpen = signal(false);

  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  closeSidebar()  { this.sidebarOpen.set(false); }
  openSidebar()   { this.sidebarOpen.set(true); }
}
