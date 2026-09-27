import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { RouterModule, RouterLinkActive, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService }        from '../../../core/services/auth.service';
import { FeatureFlagsService } from '../../../core/services/feature-flags.service';
import { UiService }          from '../../../core/services/ui.service';
import { IconComponent }      from '../icon/icon.component';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

@Component({
  selector: 'aa-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLinkActive, IconComponent, BrandLogoComponent, TranslateModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed() && !isMobile()" [class.mobile-open]="ui.sidebarOpen()">

      <!-- Logo row -->
      <div class="sidebar-logo">
        <a routerLink="/dashboard" class="logo-link" style="display: flex; align-items: center; text-decoration: none; overflow: hidden;">
          @if (!collapsed() || isMobile()) {
            <aa-brand-logo variant="horizontal" [transparent]="true" [height]="32"/>
          } @else {
            <div class="logo-icon-wrap" (click)="ui.toggleSidebarCollapse()" [title]="'SIDEBAR.EXPAND' | translate">
              <aa-brand-logo variant="mark" [height]="22"/>
            </div>
          }
        </a>
        <!-- Desktop collapse / expand toggle button inside sidebar -->
        <button class="collapse-btn desktop-only" (click)="ui.toggleSidebarCollapse()"
          [title]="collapsed() ? ('SIDEBAR.EXPAND' | translate) : ('SIDEBAR.COLLAPSE' | translate)"
          [attr.aria-label]="collapsed() ? ('SIDEBAR.EXPAND' | translate) : ('SIDEBAR.COLLAPSE' | translate)"
          [attr.aria-expanded]="!collapsed()">
          <aa-icon [name]="collapsed() ? 'chevronRight' : 'chevronLeft'" [size]="14"/>
        </button>
        <!-- Mobile close only -->
        <button class="collapse-btn mobile-close" (click)="ui.closeSidebar()"
          [attr.aria-label]="'SIDEBAR.CLOSE_MENU' | translate">
          <aa-icon name="close" [size]="16"/>
        </button>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav" [attr.aria-label]="'SIDEBAR.MAIN_NAV' | translate">
        @for (item of navItems(); track item.route) {
          <a class="nav-item" [routerLink]="item.route"
            [class.active]="isItemActive(item.route)"
            [title]="item.labelKey | translate"
            [attr.aria-label]="item.labelKey | translate"
            (click)="ui.closeSidebar()">
            <aa-icon class="nav-icon" [name]="item.icon" [size]="18"/>
            <span class="nav-label" *ngIf="!collapsed() || isMobile()">{{ item.labelKey | translate }}</span>
            @if (item.isNew) {
              <span class="new-badge" *ngIf="!collapsed() || isMobile()">{{ 'COMMON.NEW' | translate }}</span>
            }
          </a>
        }
      </nav>

      <!-- Automation status -->
      <div class="auto-status" *ngIf="!collapsed() || isMobile()">
        <div class="auto-label">{{ 'SIDEBAR.AUTOMATION_STATUS' | translate }}</div>
        <div class="auto-row">
          <span class="status-dot" [class.active]="user()?.automationActive"></span>
          <span class="auto-text">{{ (user()?.automationActive ? 'SIDEBAR.ACTIVE' : 'SIDEBAR.INACTIVE') | translate }}</span>
        </div>
      </div>

      <!-- Footer: user info (theme/language/logout now live in the top app header) -->
      <div class="sidebar-footer">
        <div class="user-info" *ngIf="!collapsed() || isMobile()">
          <div class="user-avatar">{{ initials() }}</div>
          <div class="user-details">
            <div class="user-name">{{ user()?.name }}</div>
            <div class="user-plan">{{ planLabel() }}</div>
          </div>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    /* ── Base sidebar ──────────────────────────────────────────────── */
    .sidebar {
      width: 240px; height: 100vh;
      background: var(--bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-right: 1px solid var(--glass-border);
      box-shadow: 4px 0 32px rgba(0,0,0,.18);
      position: fixed; top: 0; left: 0; z-index: 110;
      display: flex; flex-direction: column;
      padding: 20px 14px; gap: 4px;
      transition: width .3s ease, transform .3s ease;
      overflow: hidden; overflow-y: auto;
    }
    .sidebar.collapsed { width: 68px; padding: 18px 8px; }
    .sidebar.collapsed .sidebar-logo { flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 4px 0; margin-bottom: 12px; }
    .sidebar.collapsed .logo-icon-wrap { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--surface-subtle); border: 1px solid var(--glass-border); cursor: pointer; transition: all .2s; }
    .sidebar.collapsed .logo-icon-wrap:hover { background: var(--accent-hover); border-color: var(--accent); }
    .sidebar.collapsed .collapse-btn.desktop-only { margin-left: 0; display: flex; align-items: center; justify-content: center; width: 32px; height: 26px; border-radius: 6px; background: var(--surface-subtle); border: 1px solid var(--glass-border); }
    .sidebar.collapsed .collapse-btn.desktop-only:hover { background: var(--surface-hover); color: var(--accent); }

    /* ── Logo ──────────────────────────────────────────────────────── */
    .sidebar-logo { display:flex; align-items:center; gap:10px; padding:10px 12px; margin-bottom:16px; }
    .logo-icon    { flex-shrink:0; color: var(--accent); }
    .logo-name    { font-family:var(--font-display); font-weight:700; font-size:15px; color:var(--text); }
    .logo-sub     { font-size:10px; color:var(--text-muted); }
    .collapse-btn { background:none; border:none; cursor:pointer; color:var(--text-muted); flex-shrink:0; padding: 4px; border-radius: 6px; transition: background .2s; }
    .collapse-btn:hover { background: var(--surface-hover); color: var(--accent); }
    .desktop-only { margin-left:auto; }
    .mobile-close { display: none; margin-left: auto; }

    /* ── Nav ───────────────────────────────────────────────────────── */
    .sidebar-nav { display:flex; flex-direction:column; gap:3px; flex:1; }

    .nav-item {
      display:flex; align-items:center; gap:10px; padding:10px 12px;
      border-radius:10px; cursor:pointer; color:var(--text-muted);
      font-size:13px; font-weight:500; text-decoration:none;
      transition:all .2s ease; white-space:nowrap; position:relative;
    }
    .nav-item:hover  { color:var(--accent); background: var(--accent-hover); }
    .nav-item.active { color:var(--accent); background: var(--accent-soft); box-shadow:var(--neo-inset); }
    .nav-icon { width:22px; flex-shrink:0; display:flex; justify-content:center; }
    .nav-label{ flex:1; }
    .new-badge {
      font-size:9px; font-weight:800; padding:2px 5px; border-radius:4px;
      background:linear-gradient(135deg,var(--accent),var(--accent-secondary)); color:#fff;
      letter-spacing:.3px;
    }

    /* ── Automation status ─────────────────────────────────────────── */
    .auto-status {
      background: var(--surface-subtle);
      border: 1px solid var(--glass-border);
      border-radius:10px; padding:12px; margin-bottom:8px;
    }
    .auto-label  { font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:.8px; text-transform:uppercase; margin-bottom:6px; }
    .auto-row    { display:flex; align-items:center; gap:7px; }
    .auto-text   { font-size:11px; font-weight:600; color:var(--text); }
    .status-dot  { width:8px; height:8px; border-radius:50%; background:var(--text-muted); flex-shrink:0; transition:.3s; }
    .status-dot.active { background:var(--success); box-shadow:0 0 8px var(--success-glow); animation:pulse 2s infinite; }
    @keyframes pulse { 0%,100%{box-shadow:0 0 8px var(--success-glow);}50%{box-shadow:0 0 18px var(--success-glow-strong);} }

    /* ── Footer ────────────────────────────────────────────────────── */
    .sidebar-footer { border-top:1px solid var(--divider); padding-top:12px; display:flex; flex-direction:column; gap:10px; }

    .user-info    { display:flex; align-items:center; gap:10px; }
    .user-avatar  { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent-secondary)); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0; }
    .user-name    { font-size:12px; font-weight:700; color:var(--text); }
    .user-plan    { font-size:10px; color:var(--accent); font-weight:600; }

    /* ── Mobile ────────────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
        top: 0; width: 280px;
        box-shadow: none;
      }
      .sidebar.mobile-open {
        transform: translateX(0);
        box-shadow: 8px 0 40px var(--shadow-overlay-strong);
      }
      .desktop-only { display: none; }
      .mobile-close  { display: flex; }
    }
  `]
})
export class SidebarComponent {
  auth = inject(AuthService);
  featureFlags = inject(FeatureFlagsService);
  ui   = inject(UiService);
  router = inject(Router);

  collapsed = this.ui.sidebarCollapsed;

  isMobile = signal(window.innerWidth <= 768);

  @HostListener('window:resize')
  onResize() { this.isMobile.set(window.innerWidth <= 768); }

  user     = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const n = this.auth.currentUser()?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  });

  planLabel = computed(() => {
    if (!this.featureFlags.paymentsEnabled()) return 'Free Mode (All Unlocked)';
    const plan = this.user()?.plan || 'free';
    return plan === 'free' ? 'Free Plan' : plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan';
  });

  isItemActive(route: string): boolean {
    const url = this.router.url.split('?')[0]; // strip query params
    if (route === '/settings') {
      return url === '/settings' || url.startsWith('/settings/') || url.startsWith('/profile') || url.startsWith('/preferences');
    }
    if (route === '/referral')      return url === '/referral' || url.startsWith('/referral/');
    if (route === '/notifications') return url === '/notifications' || url.startsWith('/notifications/');
    if (route === '/plans')         return url === '/plans' || url.startsWith('/plans/');
    if (route === '/admin')         return url.startsWith('/admin');
    if (route === '/jobs')          return url.startsWith('/jobs');
    if (route === '/alerts')        return url.startsWith('/alerts');
    if (route === '/eu')            return url.startsWith('/eu');
    if (route === '/automation')    return url.startsWith('/automation');
    if (route === '/resume')        return url.startsWith('/resume');
    if (route === '/linkedin')      return url.startsWith('/linkedin');
    return url === route;
  }

  navItems = computed(() => {
    const base = [
      { icon:'dashboard',   labelKey:'NAV.DASHBOARD',    route:'/dashboard' },
      { icon:'resume',      labelKey:'NAV.MY_RESUME',    route:'/resume' },
      { icon:'linkedin',    labelKey:'NAV.LINKEDIN',     route:'/linkedin', isNew: true },
      { icon:'target',      labelKey:'NAV.JOB_ALERTS',   route:'/alerts', isNew: true },
      { icon:'briefcase',   labelKey:'NAV.APPLICATIONS', route:'/jobs' },
      { icon:'zap',         labelKey:'NAV.AUTOMATION',   route:'/automation' },
      { icon:'mapPin',      labelKey:'NAV.EU_CAREERS',   route:'/eu' },
      { icon:'bell',        labelKey:'NAV.NOTIFICATIONS',route:'/notifications' },
      ...(this.featureFlags.referralsEnabled() ? [{ icon:'gift', labelKey:'NAV.REFERRAL', route:'/referral' }] : []),
      ...(this.featureFlags.paymentsEnabled() ? [{ icon:'plans', labelKey:'NAV.PLANS', route:'/plans' }] : []),
      { icon:'settings',    labelKey:'NAV.SETTINGS',     route:'/settings' },
    ];
    if (this.user()?.role === 'admin') {
      base.push({ icon:'shield', labelKey:'NAV.ADMIN', route:'/admin' });
    }
    return base;
  });
}
