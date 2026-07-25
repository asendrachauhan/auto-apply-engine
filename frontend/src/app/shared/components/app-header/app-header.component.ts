import { Component, HostListener, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { UiService } from '../../../core/services/ui.service';
import { ApiService } from '../../../core/services/api.service';
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
  imports: [CommonModule, RouterModule, ThemeToggleComponent, LanguageDropdownComponent, IconComponent, TranslateModule],
  template: `
    <header class="app-topbar">
      <button class="hamburger mobile-only" (click)="ui.toggleSidebar()" aria-label="Toggle menu">
        <aa-icon name="dashboard" [size]="20"/>
      </button>

      <span class="topbar-spacer"></span>

      <div class="topbar-controls">
        <aa-language-dropdown/>
        <aa-theme-toggle/>

        <div class="notif-menu">
          <button class="icon-trigger" (click)="toggleNotifs()" [attr.aria-expanded]="notifOpen()" [title]="'NAV.NOTIFICATIONS' | translate">
            <aa-icon name="bell" [size]="18"/>
            @if (unreadCount() > 0) {
              <span class="notif-badge">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
            }
          </button>
          @if (notifOpen()) {
            <div class="notif-panel">
              <div class="notif-panel-header">
                <span>{{ 'NAV.NOTIFICATIONS' | translate }}</span>
                @if (unreadCount() > 0) {
                  <button class="notif-mark-all" (click)="markAllRead()">{{ 'COMMON.MARK_ALL_READ' | translate }}</button>
                }
              </div>
              @if (recentNotifs().length === 0) {
                <div class="notif-empty">{{ 'COMMON.NO_NOTIFICATIONS' | translate }}</div>
              } @else {
                @for (n of recentNotifs(); track n._id) {
                  <button class="notif-item" [class.unread]="!n.read" (click)="openNotif(n)">
                    <span class="notif-dot" [class.show]="!n.read"></span>
                    <span class="notif-body">
                      <span class="notif-title">{{ n.title }}</span>
                      <span class="notif-msg">{{ n.message }}</span>
                    </span>
                  </button>
                }
              }
              <a class="notif-viewall" routerLink="/notifications" (click)="notifOpen.set(false)">{{ 'COMMON.VIEW_ALL' | translate }}</a>
            </div>
          }
        </div>

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

    .notif-menu { position: relative; }
    .icon-trigger {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--glass-bg-strong); border: 1px solid var(--glass-border);
      box-shadow: var(--neo-sm); cursor: pointer; color: var(--text-muted);
    }
    .icon-trigger:hover { box-shadow: var(--neo-raised); color: var(--text); }
    .notif-badge {
      position: absolute; top: -3px; right: -3px; min-width: 16px; height: 16px; padding: 0 3px;
      border-radius: 999px; background: var(--danger, #ef4444); color: #fff;
      font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center;
    }
    .notif-panel {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 300;
      width: 320px; max-width: calc(100vw - 24px); max-height: 420px; overflow-y: auto;
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: 12px; box-shadow: var(--neo-raised), 0 12px 32px rgba(0,0,0,.35);
      padding: 6px; animation: menuIn .15s ease;
    }
    .notif-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; font-size: 12px; font-weight: 700; color: var(--text); }
    .notif-mark-all { background: none; border: none; cursor: pointer; color: var(--accent); font-size: 11px; font-weight: 600; }
    .notif-empty { padding: 24px 12px; text-align: center; font-size: 12px; color: var(--text-muted); }
    .notif-item {
      display: flex; align-items: flex-start; gap: 8px; width: 100%;
      padding: 9px 10px; border-radius: 8px; border: none; background: none;
      cursor: pointer; text-align: left; transition: background .15s;
    }
    .notif-item:hover { background: rgba(255,255,255,.06); }
    .notif-item.unread { background: rgba(108,99,255,.06); }
    .notif-dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
    .notif-dot.show { background: var(--accent); }
    .notif-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .notif-title { font-size: 12px; font-weight: 700; color: var(--text); }
    .notif-msg { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .notif-viewall { display: block; text-align: center; padding: 9px; margin-top: 4px; border-top: 1px solid var(--glass-border); font-size: 11px; font-weight: 700; color: var(--accent); text-decoration: none; }

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
      width: 220px; max-width: calc(100vw - 24px);
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
export class AppHeaderComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  ui   = inject(UiService);
  api  = inject(ApiService);
  router = inject(Router);
  menuOpen = signal(false);

  notifOpen     = signal(false);
  unreadCount   = signal(0);
  recentNotifs  = signal<any[]>([]);
  private pollHandle?: ReturnType<typeof setInterval>;

  user = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const n = this.auth.currentUser()?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  });

  ngOnInit(): void {
    this.refreshUnreadCount();
    // Light polling — the app has no websocket/SSE channel for this yet,
    // so the badge catches up within a minute of a new notification.
    this.pollHandle = setInterval(() => this.refreshUnreadCount(), 60000);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  refreshUnreadCount(): void {
    this.api.getUnreadNotificationCount().subscribe({
      next: (r: any) => this.unreadCount.set(r.data?.count || 0),
      error: () => {},
    });
  }

  toggleNotifs(): void {
    this.notifOpen.set(!this.notifOpen());
    if (this.notifOpen()) {
      this.api.getNotifications({ limit: 5 }).subscribe({
        next: (r: any) => this.recentNotifs.set(r.data || []),
        error: () => {},
      });
    }
  }

  openNotif(n: any): void {
    this.notifOpen.set(false);
    if (!n.read) {
      this.api.markNotificationRead(n._id).subscribe({
        next: () => this.unreadCount.set(Math.max(0, this.unreadCount() - 1)),
      });
    }
    if (n.link) this.router.navigateByUrl(n.link);
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.recentNotifs.set(this.recentNotifs().map(n => ({ ...n, read: true })));
      },
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!(ev.target as HTMLElement).closest('.user-menu')) this.menuOpen.set(false);
    if (!(ev.target as HTMLElement).closest('.notif-menu')) this.notifOpen.set(false);
  }
}
