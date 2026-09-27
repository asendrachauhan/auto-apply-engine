import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '../icon/icon.component';
import { filter, Subscription } from 'rxjs';

interface Crumb {
  label: string;
  route?: string;
  queryParams?: Record<string, string>;
}

/** Route segment → i18n key */
const ROUTE_LABELS: Record<string, string> = {
  'dashboard':     'NAV.DASHBOARD',
  'resume':        'NAV.MY_RESUME',
  'linkedin':      'NAV.LINKEDIN',
  'alerts':        'NAV.JOB_ALERTS',
  'jobs':          'NAV.APPLICATIONS',
  'automation':    'NAV.AUTOMATION',
  'eu':            'NAV.EU_CAREERS',
  'analytics':     'BREADCRUMB.ANALYTICS',
  'preferences':   'NAV.PREFERENCES',
  'plans':         'NAV.PLANS',
  'settings':      'NAV.SETTINGS',
  'profile':       'NAV.PROFILE',
  'notifications': 'NAV.NOTIFICATIONS',
  'referral':      'NAV.REFERRAL',
  'admin':         'NAV.ADMIN',
  'users':         'BREADCRUMB.USERS',
  'onboarding':    'BREADCRUMB.ONBOARDING',
};

/**
 * Route-aware breadcrumb bar.
 * Subscribes to NavigationEnd so it updates on every route change.
 * Hidden on /dashboard (home) — no useful trail to show there.
 */
@Component({
  selector: 'aa-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, TranslateModule],
  template: `
    @if (crumbs().length > 1) {
      <nav class="breadcrumb-bar" aria-label="Breadcrumb">
        @for (crumb of crumbs(); track crumb.label; let last = $last; let first = $first) {
          @if (!first) {
            <aa-icon name="chevronRight" [size]="12" class="crumb-sep"/>
          }
          @if (!last && crumb.route) {
            <a class="crumb-link" [routerLink]="crumb.route" [queryParams]="crumb.queryParams">{{ crumb.label | translate }}</a>
          } @else {
            <span class="crumb-current" [attr.aria-current]="last ? 'page' : null">
              {{ crumb.label | translate }}
            </span>
          }
        }
      </nav>
    }
  `,
  styles: [`
    .breadcrumb-bar {
      display: flex; align-items: center; gap: 4px;
      padding: 8px 32px; min-height: 36px;
      background: transparent;
      border-bottom: 1px solid var(--glass-border);
      flex-wrap: wrap;
    }
    .crumb-link {
      font-size: 12px; font-weight: 500; color: var(--text-muted);
      text-decoration: none; padding: 2px 6px; border-radius: 4px;
      transition: color .15s, background .15s;
      white-space: nowrap;
    }
    .crumb-link:hover { color: var(--accent); background: var(--accent-hover); }
    .crumb-current {
      font-size: 12px; font-weight: 600; color: var(--text);
      padding: 2px 4px; white-space: nowrap;
    }
    .crumb-sep { color: var(--text-muted); flex-shrink: 0; }

    @media (max-width: 768px) {
      .breadcrumb-bar { padding: 6px 16px; }
    }
  `],
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private navSub?: Subscription;

  crumbs = signal<Crumb[]>([]);
  readonly LABELS = ROUTE_LABELS;

  ngOnInit(): void {
    this.buildCrumbs(this.router.url);
    this.navSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => this.buildCrumbs(e.urlAfterRedirects || e.url));
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private buildCrumbs(url: string): void {
    const [path, queryString] = url.split('?');
    const segments = path.split('/').filter(Boolean);
    const queryParams = new URLSearchParams(queryString || '');

    // Hide breadcrumb bar on dashboard (root page) — nothing to trail
    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
      this.crumbs.set([]);
      return;
    }

    const crumbs: Crumb[] = [
      { label: 'NAV.DASHBOARD', route: '/dashboard' },
    ];

    // If visiting a nested settings page (e.g. preferences, profile), insert "Settings" in the trail
    const isSettingsChild = (segments[0] === 'preferences' || segments[0] === 'profile');
    if (isSettingsChild) {
      crumbs.push({ label: 'NAV.SETTINGS', route: '/settings' });
    }

    let accumulated = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const prevSeg = i > 0 ? segments[i - 1] : '';
      accumulated += `/${seg}`;
      const labelKey = ROUTE_LABELS[seg];

      let targetRoute: string | undefined = i < segments.length - 1 ? accumulated : undefined;
      let targetQueryParams: Record<string, string> | undefined = undefined;

      // Map non-existent route /admin/users to /admin with queryParams { tab: 'users' }
      if (targetRoute === '/admin/users') {
        targetRoute = '/admin';
        targetQueryParams = { tab: 'users' };
      }

      let displayLabel = labelKey;
      if (!displayLabel) {
        const isHexId = /^[0-9a-fA-F]{24}$/.test(seg) || seg.length > 18;
        if (isHexId) {
          if (prevSeg === 'users') {
            displayLabel = 'User Details';
          } else if (prevSeg === 'alerts') {
            displayLabel = 'Alert Details';
          } else if (prevSeg === 'jobs' || prevSeg === 'applications') {
            displayLabel = 'Application Details';
          } else {
            displayLabel = 'Details';
          }
        } else {
          displayLabel = seg;
        }
      }

      crumbs.push({
        label: displayLabel,
        route: targetRoute,
        queryParams: targetQueryParams,
      });
    }

    // If on /admin root with a specific active tab parameter (e.g. ?tab=brand or ?tab=users)
    if (segments.length === 1 && segments[0] === 'admin') {
      const tab = queryParams.get('tab');
      if (tab && tab !== 'overview') {
        const tabKeyMap: Record<string, string> = {
          users: 'ADMIN.TAB_USERS',
          settings: 'ADMIN.TAB_SETTINGS',
          features: 'ADMIN.TAB_FEATURES',
          coupons: 'ADMIN.TAB_COUPONS',
          brand: 'Brand & Logos',
        };
        // Make the main admin crumb clickable back to overview
        crumbs[crumbs.length - 1].route = '/admin';
        crumbs[crumbs.length - 1].queryParams = undefined;
        crumbs.push({
          label: tabKeyMap[tab] || tab,
          route: undefined,
        });
      }
    }

    this.crumbs.set(crumbs);
  }
}
