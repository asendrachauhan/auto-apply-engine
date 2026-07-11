import { Component, signal, computed, inject, effect, HostListener } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService }        from '../../../core/services/auth.service';
import { UiService }          from '../../../core/services/ui.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { IconComponent }      from '../icon/icon.component';

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'zh', label: '中', name: '中文' },
  { code: 'hi', label: 'हि', name: 'हिंदी' },
  { code: 'ar', label: 'ع',  name: 'العربية' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'ru', label: 'РУ', name: 'Русский' },
  { code: 'ja', label: '日', name: '日本語' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
];

@Component({
  selector: 'aa-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLinkActive, ThemeToggleComponent, IconComponent, TranslateModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed() && !isMobile()" [class.mobile-open]="ui.sidebarOpen()">

      <!-- Logo row -->
      <div class="sidebar-logo">
        <div class="logo-icon"><aa-icon name="zap" [size]="22"/></div>
        <div class="logo-text" *ngIf="!collapsed() || isMobile()">
          <div class="logo-name">{{ 'SIDEBAR.APP_NAME' | translate }}</div>
          <div class="logo-sub">{{ 'SIDEBAR.SUBTITLE' | translate }}</div>
        </div>
        <button class="collapse-btn desktop-only" (click)="collapsed.set(!collapsed())"
          [title]="collapsed() ? 'Expand' : 'Collapse'">
          <aa-icon [name]="collapsed() ? 'chevronRight' : 'chevronLeft'" [size]="14"/>
        </button>
        <button class="collapse-btn mobile-close" (click)="ui.closeSidebar()">
          <aa-icon name="close" [size]="16"/>
        </button>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        @for (item of navItems; track item.route) {
          <a class="nav-item" [routerLink]="item.route" routerLinkActive="active"
            [title]="item.labelKey | translate"
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

      <!-- Footer: theme + language + user + logout -->
      <div class="sidebar-footer">
        <div class="footer-controls">
          <aa-theme-toggle />

          <!-- Language picker -->
          <div class="lang-picker" *ngIf="!collapsed() || isMobile()">
            <span class="lang-label">{{ 'COMMON.LANGUAGE' | translate }}</span>
            <div class="lang-chips">
              @for (lang of languages; track lang.code) {
                <button class="lang-chip"
                  [class.active]="currentLang() === lang.code"
                  (click)="setLang(lang.code)"
                  [title]="lang.name">
                  {{ lang.label }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="user-info" *ngIf="!collapsed() || isMobile()">
          <div class="user-avatar">{{ initials() }}</div>
          <div class="user-details">
            <div class="user-name">{{ user()?.name }}</div>
            <div class="user-plan">{{ planLabel() }}</div>
          </div>
        </div>
        <button class="logout-btn" (click)="auth.logout()">
          <aa-icon name="logout" [size]="14"/>
          <span *ngIf="!collapsed() || isMobile()">{{ 'SIDEBAR.LOGOUT' | translate }}</span>
        </button>
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
    .sidebar.collapsed { width: 68px; }

    /* ── Logo ──────────────────────────────────────────────────────── */
    .sidebar-logo { display:flex; align-items:center; gap:10px; padding:10px 12px; margin-bottom:16px; }
    .logo-icon    { flex-shrink:0; color: var(--accent); }
    .logo-name    { font-family:var(--font-display); font-weight:700; font-size:15px; color:var(--text); }
    .logo-sub     { font-size:10px; color:var(--text-muted); }
    .collapse-btn { background:none; border:none; cursor:pointer; color:var(--text-muted); flex-shrink:0; padding: 4px; border-radius: 6px; transition: background .2s; }
    .collapse-btn:hover { background: rgba(255,255,255,.06); }
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
    .nav-item:hover  { color:var(--accent); background: rgba(108,99,255,.08); }
    .nav-item.active { color:var(--accent); background: rgba(108,99,255,.12); box-shadow:var(--neo-inset); }
    .nav-icon { width:22px; flex-shrink:0; display:flex; justify-content:center; }
    .nav-label{ flex:1; }
    .new-badge {
      font-size:9px; font-weight:800; padding:2px 5px; border-radius:4px;
      background:linear-gradient(135deg,var(--accent),#a855f7); color:#fff;
      letter-spacing:.3px;
    }

    /* ── Automation status ─────────────────────────────────────────── */
    .auto-status {
      background: rgba(255,255,255,.03);
      border: 1px solid var(--glass-border);
      border-radius:10px; padding:12px; margin-bottom:8px;
    }
    .auto-label  { font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:.8px; text-transform:uppercase; margin-bottom:6px; }
    .auto-row    { display:flex; align-items:center; gap:7px; }
    .auto-text   { font-size:11px; font-weight:600; color:var(--text); }
    .status-dot  { width:8px; height:8px; border-radius:50%; background:var(--text-muted); flex-shrink:0; transition:.3s; }
    .status-dot.active { background:var(--success); box-shadow:0 0 8px rgba(67,233,123,.6); animation:pulse 2s infinite; }
    @keyframes pulse { 0%,100%{box-shadow:0 0 8px rgba(67,233,123,.5);}50%{box-shadow:0 0 18px rgba(67,233,123,.9);} }

    /* ── Footer ────────────────────────────────────────────────────── */
    .sidebar-footer { border-top:1px solid rgba(163,177,198,.2); padding-top:12px; display:flex; flex-direction:column; gap:10px; }
    .footer-controls { display: flex; flex-direction: column; gap: 8px; }

    /* Language picker */
    .lang-label { font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:.6px; text-transform:uppercase; }
    .lang-chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
    .lang-chip {
      font-size:10px; font-weight:700; padding:3px 7px; border-radius:6px;
      background: rgba(255,255,255,.05); border:1px solid var(--glass-border);
      color: var(--text-muted); cursor:pointer; transition: all .15s;
    }
    .lang-chip:hover  { border-color: var(--accent); color: var(--accent); }
    .lang-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }

    .user-info    { display:flex; align-items:center; gap:10px; }
    .user-avatar  { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,var(--accent),#a855f7); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0; }
    .user-name    { font-size:12px; font-weight:700; color:var(--text); }
    .user-plan    { font-size:10px; color:var(--accent); font-weight:600; }
    .logout-btn   { background:none; border:none; cursor:pointer; font-size:12px; color:var(--text-muted); text-align:left; padding:6px 8px; border-radius:8px; display:flex; align-items:center; gap:8px; transition: all .2s; width: 100%; }
    .logout-btn:hover { color:var(--danger); background: rgba(239,68,68,.08); }

    /* ── Mobile ────────────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
        top: 0; width: 280px;
        box-shadow: none;
      }
      .sidebar.mobile-open {
        transform: translateX(0);
        box-shadow: 8px 0 40px rgba(0,0,0,.4);
      }
      .desktop-only { display: none; }
      .mobile-close  { display: flex; }
    }
  `]
})
export class SidebarComponent {
  collapsed = signal(false);
  languages = LANGUAGES;
  currentLang = signal('en');

  auth = inject(AuthService);
  ui   = inject(UiService);
  private translate = inject(TranslateService);

  constructor() {
    // Restore persisted language
    const saved = localStorage.getItem('aa_lang') || 'en';
    this.translate.setDefaultLang('en');
    this.translate.use(saved);
    this.currentLang.set(saved);
  }

  isMobile = signal(window.innerWidth <= 768);

  @HostListener('window:resize')
  onResize() { this.isMobile.set(window.innerWidth <= 768); }

  user     = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const n = this.auth.currentUser()?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  });
  planLabel = computed(() => {
    const plan = this.user()?.plan || 'free';
    return plan === 'free' ? 'Free Plan' : plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan';
  });

  setLang(code: string) {
    this.translate.use(code);
    this.currentLang.set(code);
    localStorage.setItem('aa_lang', code);
    // Set dir for RTL languages (Arabic)
    document.documentElement.setAttribute('dir', code === 'ar' ? 'rtl' : 'ltr');
  }

  navItems = [
    { icon:'dashboard',   labelKey:'NAV.DASHBOARD',    route:'/dashboard' },
    { icon:'resume',      labelKey:'NAV.MY_RESUME',    route:'/resume' },
    { icon:'target',      labelKey:'NAV.JOB_ALERTS',   route:'/alerts', isNew: true },
    { icon:'briefcase',   labelKey:'NAV.APPLICATIONS', route:'/jobs' },
    { icon:'zap',         labelKey:'NAV.AUTOMATION',   route:'/automation' },
    { icon:'mapPin',      labelKey:'NAV.EU_CAREERS',   route:'/eu' },
    { icon:'plans',       labelKey:'NAV.PLANS',        route:'/plans' },
    { icon:'settings',    labelKey:'NAV.SETTINGS',     route:'/settings' },
  ];
}
