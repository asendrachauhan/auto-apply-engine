import { Component, inject } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { RouterOutlet }        from '@angular/router';
import { SidebarComponent }    from './shared/components/sidebar/sidebar.component';
import { AppHeaderComponent }  from './shared/components/app-header/app-header.component';
import { BreadcrumbComponent } from './shared/components/breadcrumb/breadcrumb.component';
import { UiService }           from './core/services/ui.service';

@Component({
  selector: 'aa-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, AppHeaderComponent, BreadcrumbComponent],
  template: `
    <!-- Overlay backdrop for mobile sidebar -->
    @if (ui.sidebarOpen()) {
      <div class="sidebar-overlay" (click)="ui.closeSidebar()"></div>
    }

    <div class="app-shell" [class.sidebar-collapsed]="ui.sidebarCollapsed()">
      <aa-sidebar/>
      <div class="shell-body">
        <aa-app-header/>
        <aa-breadcrumb/>
        <main class="main-content">
          <router-outlet/>
        </main>
      </div>
    </div>
  `,
  styles: [`
    /* ── Overlay backdrop ─────────────────────────────────────────── */
    .sidebar-overlay {
      position: fixed; inset: 0; z-index: 109;
      background: var(--shadow-overlay-heavy);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ── Shell layout ─────────────────────────────────────────────── */
    .app-shell    { display: flex; min-height: 100vh; }
    .shell-body   { flex: 1; display: flex; flex-direction: column; margin-left: 240px; transition: margin-left .3s cubic-bezier(0.4, 0, 0.2, 1); min-width: 0; }
    .app-shell.sidebar-collapsed .shell-body { margin-left: 68px; }
    .main-content { flex: 1; padding: 32px; min-width: 0; width: 100%; box-sizing: border-box; }

    /* ── Desktop responsive (collapsed sidebar) ──────────────────── */
    @media (max-width: 1024px) {
      .main-content { padding: 24px; }
    }

    /* ── Mobile ───────────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .shell-body    { margin-left: 0; }
      .main-content  { padding: 16px; }
    }
  `]
})
export class AppShellComponent {
  ui = inject(UiService);
}
