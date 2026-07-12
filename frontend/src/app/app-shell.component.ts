import { Component, inject } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { RouterOutlet }      from '@angular/router';
import { SidebarComponent }  from './shared/components/sidebar/sidebar.component';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';
import { UiService }         from './core/services/ui.service';

@Component({
  selector: 'aa-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, AppHeaderComponent],
  template: `
    <!-- Overlay backdrop for mobile sidebar -->
    @if (ui.sidebarOpen()) {
      <div class="sidebar-overlay" (click)="ui.closeSidebar()"></div>
    }

    <div class="app-shell">
      <aa-sidebar/>
      <div class="shell-body">
        <aa-app-header/>
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
      background: rgba(0,0,0,.5);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ── Shell layout ─────────────────────────────────────────────── */
    .app-shell    { display: flex; min-height: 100vh; }
    .shell-body   { flex: 1; display: flex; flex-direction: column; margin-left: 240px; transition: margin-left .3s ease; min-width: 0; }
    .main-content { flex: 1; padding: 32px; }

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
