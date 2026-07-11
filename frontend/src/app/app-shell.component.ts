import { Component, inject } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { RouterOutlet }      from '@angular/router';
import { SidebarComponent }  from './shared/components/sidebar/sidebar.component';
import { IconComponent }     from './shared/components/icon/icon.component';
import { UiService }         from './core/services/ui.service';

@Component({
  selector: 'aa-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, IconComponent],
  template: `
    <!-- Mobile top-bar (hidden on desktop) -->
    <header class="mobile-topbar">
      <button class="hamburger" (click)="ui.toggleSidebar()" aria-label="Toggle menu">
        <aa-icon name="dashboard" [size]="20"/>
      </button>
      <span class="mobile-logo">AutoApply AI</span>
      <div class="mobile-topbar-spacer"></div>
    </header>

    <!-- Overlay backdrop for mobile sidebar -->
    @if (ui.sidebarOpen()) {
      <div class="sidebar-overlay" (click)="ui.closeSidebar()"></div>
    }

    <div class="app-shell">
      <aa-sidebar/>
      <main class="main-content">
        <router-outlet/>
      </main>
    </div>
  `,
  styles: [`
    /* ── Mobile top-bar ───────────────────────────────────────────── */
    .mobile-topbar {
      display: none;
      position: fixed; top: 0; left: 0; right: 0; z-index: 110;
      height: 56px;
      background: var(--bg);
      border-bottom: 1px solid var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      align-items: center; padding: 0 16px; gap: 14px;
      box-shadow: 0 2px 16px rgba(0,0,0,.18);
    }
    .hamburger {
      background: none; border: none; cursor: pointer;
      color: var(--text); display: flex; align-items: center;
      padding: 6px; border-radius: 8px;
      transition: background .2s;
    }
    .hamburger:hover { background: rgba(255,255,255,.06); }
    .mobile-logo {
      font-family: var(--font-display); font-weight: 700;
      font-size: 15px; color: var(--text); flex: 1;
    }
    .mobile-topbar-spacer { width: 32px; }

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
    .main-content {
      margin-left: 240px; flex: 1; padding: 32px;
      min-height: 100vh; transition: margin-left .3s ease;
    }

    /* ── Desktop responsive (collapsed sidebar) ──────────────────── */
    @media (max-width: 1024px) {
      .main-content { padding: 24px; }
    }

    /* ── Mobile ───────────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .mobile-topbar { display: flex; }
      .app-shell     { flex-direction: column; }
      .main-content  {
        margin-left: 0;
        padding: 16px;
        padding-top: calc(56px + 16px); /* clear the fixed topbar */
        min-height: 100vh;
      }
    }
  `]
})
export class AppShellComponent {
  ui = inject(UiService);
}
