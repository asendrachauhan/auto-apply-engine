import { Injectable, signal } from '@angular/core';

/**
 * Shared UI state service.
 * Keeps sidebar open/close state for mobile and desktop collapsed state
 * so AppShell and Sidebar can coordinate smooth responsive layout adjustments.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  sidebarOpen = signal(false);

  private readonly STORAGE_KEY = 'aa_sidebar_collapsed';
  sidebarCollapsed = signal(typeof localStorage !== 'undefined' && localStorage.getItem(this.STORAGE_KEY) === 'true');

  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  closeSidebar()  { this.sidebarOpen.set(false); }
  openSidebar()   { this.sidebarOpen.set(true); }

  toggleSidebarCollapse() {
    this.sidebarCollapsed.update(v => {
      const next = !v;
      try { localStorage.setItem(this.STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }

  setSidebarCollapse(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
    try { localStorage.setItem(this.STORAGE_KEY, String(collapsed)); } catch {}
  }
}
