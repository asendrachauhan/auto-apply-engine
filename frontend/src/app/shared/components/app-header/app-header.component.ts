import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { UiService } from '../../../core/services/ui.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { LanguageDropdownComponent } from '../language-dropdown/language-dropdown.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Persistent top header for the authenticated app (desktop + mobile). Owns
 * the controls that used to live buried in the sidebar footer — language,
 * theme, and the user menu with logout — so they're reachable from every
 * page without opening the sidebar, and consistent with the auth pages'
 * header above the login form.
 */
@Component({
  selector: 'aa-app-header',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, LanguageDropdownComponent, IconComponent, TranslateModule],
  template: `
    <header class="app-topbar">
      <button class="hamburger mobile-only" (click)="ui.toggleSidebar()" aria-label="Toggle menu">
        <aa-icon name="dashboard" [size]="20"/>
      </button>

      <span class="topbar-spacer"></span>

      <div class="topbar-controls">
        <aa-language-dropdown/>
        <aa-theme-toggle/>

        <div class="user-menu">
          <button class="user-trigger" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()">
            <span class="user-avatar">{{ initials() }}</span>
            <span class="user-name desktop-only">{{ user()?.name }}</span>
            <aa-icon name="chevronDown" [size]="12" class="chevron" [class.flipped]="menuOpen()"/>
          </button>
          @if (menuOpen()) {
            <div class="user-menu-panel">
              <div class="user-menu-header">
                <div class="user-name-full">{{ user()?.name }}</div>
                <div class="user-email">{{ user()?.email }}</div>
              </div>
              <button class="menu-item" (click)="auth.logout()">
                <aa-icon name="logout" [size]="15"/>
                {{ 'SIDEBAR.LOGOUT' | translate }}
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-topbar {
      position: sticky; top: 0; z-index: 105;
      height: 64px; display: flex; align-items: center;
      padding: 0 24px; gap: 14px;
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
      border-bottom: 1px solid var(--glass-border);
    }
    .topbar-spacer { flex: 1; }
    .topbar-controls { display: flex; align-items: center; gap: 10px; }

    .hamburger { background: none; border: none; cursor: pointer; color: var(--text); display: flex; padding: 6px; border-radius: 8px; }
    .hamburger:hover { background: rgba(255,255,255,.06); }
    .mobile-only { display: none; }

    .user-menu { position: relative; }
    .user-trigger {
      display: flex; align-items: center; gap: 8px;
      height: 40px; padding: 4px 10px 4px 4px; border-radius: 20px;
      background: var(--glass-bg-strong); border: 1px solid var(--glass-border);
      box-shadow: var(--neo-sm); cursor: pointer;
    }
    .user-trigger:hover { box-shadow: var(--neo-raised); }
    .user-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg,var(--accent),#a855f7); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; flex-shrink: 0; }
    .user-name { font-size: 12px; font-weight: 700; color: var(--text); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chevron { color: var(--text-muted); transition: transform .2s; }
    .chevron.flipped { transform: rotate(180deg); }

    .user-menu-panel {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 300;
      width: 220px;
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: 12px; box-shadow: var(--neo-raised), 0 12px 32px rgba(0,0,0,.35);
      padding: 6px; animation: menuIn .15s ease;
    }
    @keyframes menuIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .user-menu-header { padding: 10px 12px 8px; border-bottom: 1px solid var(--glass-border); margin-bottom: 4px; }
    .user-name-full { font-size: 13px; font-weight: 700; color: var(--text); }
    .user-email { font-size: 11px; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .menu-item {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 9px 12px; border-radius: 8px; border: none; background: none;
      cursor: pointer; text-align: left; color: var(--text); font-size: 13px;
      transition: all .15s;
    }
    .menu-item:hover { color: var(--danger); background: rgba(239,68,68,.08); }

    @media (max-width: 768px) {
      .mobile-only { display: flex; }
      .desktop-only { display: none; }
      .app-topbar { padding: 0 14px; }
    }
  `]
})
export class AppHeaderComponent {
  auth = inject(AuthService);
  ui   = inject(UiService);
  menuOpen = signal(false);

  user = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const n = this.auth.currentUser()?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  });

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!(ev.target as HTMLElement).closest('.user-menu')) this.menuOpen.set(false);
  }
}
