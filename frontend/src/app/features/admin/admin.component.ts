/**
 * Admin Panel — platform stats, searchable user list, and live-editable
 * plan/system settings (SystemSetting DB-override layer on top of the
 * env-var defaults — see backend/src/config/systemSettings.service.js).
 * Gated by adminGuard on the route + requireAdmin on every API call.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ 'ADMIN.TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'ADMIN.SUBTITLE' | translate }}</p>
      </div>

      <div class="tabs neo-sm">
        @for (t of tabs; track t.id) {
          <button class="tab-btn" [class.active]="activeTab() === t.id" (click)="activeTab.set(t.id as any)">
            <aa-icon [name]="t.icon" [size]="14"/> {{ t.label | translate }}
          </button>
        }
      </div>

      <!-- ── Overview ─────────────────────────────────────────────── -->
      @if (activeTab() === 'overview') {
        @if (statsLoading()) {
          <div class="stat-grid">
            @for (i of [1,2,3,4,5,6]; track i) { <div class="stat-skeleton neo"></div> }
          </div>
        } @else if (stats()) {
          <div class="stat-grid">
            <div class="stat-card neo"><div class="stat-val">{{ stats().totalUsers }}</div><div class="stat-lbl">{{ 'ADMIN.TOTAL_USERS' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().newUsers7d }}</div><div class="stat-lbl">{{ 'ADMIN.NEW_7D' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().verifiedUsers }}</div><div class="stat-lbl">{{ 'ADMIN.VERIFIED' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().totalApplications }}</div><div class="stat-lbl">{{ 'ADMIN.APPLICATIONS' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().totalAlerts }}</div><div class="stat-lbl">{{ 'ADMIN.ALERTS_SENT' | translate }}</div></div>
            <div class="stat-card neo highlight"><div class="stat-val">{{ stats().currency }} {{ stats().estimatedMrr | number }}</div><div class="stat-lbl">{{ 'ADMIN.EST_MRR' | translate }}</div></div>
          </div>

          <h2 class="section-title">{{ 'ADMIN.PLAN_BREAKDOWN' | translate }}</h2>
          <div class="plan-breakdown">
            @for (p of planEntries(); track p[0]) {
              <div class="plan-row neo-sm">
                <span class="plan-name">{{ p[0] }}</span>
                <div class="plan-bar-track"><div class="plan-bar" [style.width.%]="planPct(p[1])"></div></div>
                <span class="plan-count">{{ p[1] }}</span>
              </div>
            }
          </div>
        }
      }

      <!-- ── Users ────────────────────────────────────────────────── -->
      @if (activeTab() === 'users') {
        <div class="search-row">
          <input class="search-input" [(ngModel)]="searchTerm" (keyup.enter)="searchUsers()" [placeholder]="'ADMIN.SEARCH_PLACEHOLDER' | translate">
          <aa-button variant="secondary" size="sm" icon="search" (clicked)="searchUsers()">{{ 'COMMON.SEARCH' | translate }}</aa-button>
        </div>

        @if (usersLoading()) {
          <div class="skeleton-list">@for (i of [1,2,3,4,5]; track i) { <div class="row-skeleton neo"></div> }</div>
        } @else {
          <div class="user-table neo">
            <div class="user-table-head">
              <span>{{ 'ADMIN.COL_USER' | translate }}</span>
              <span>{{ 'ADMIN.COL_PLAN' | translate }}</span>
              <span>{{ 'ADMIN.COL_APPS' | translate }}</span>
              <span>{{ 'ADMIN.COL_JOINED' | translate }}</span>
              <span></span>
            </div>
            @for (u of users(); track u._id) {
              <div class="user-row" (click)="openUser(u._id)">
                <span class="user-cell">
                  <span class="user-name">{{ u.name }}</span>
                  <span class="user-email">{{ u.email }}</span>
                </span>
                <span class="plan-chip" [class]="u.plan">{{ u.plan }}</span>
                <span>{{ u.totalApplications || 0 }}</span>
                <span class="user-date">{{ u.createdAt | date:'mediumDate' }}</span>
                <span><aa-icon name="chevronRight" [size]="14"/></span>
              </div>
            }
          </div>
          @if (usersTotal() > users().length) {
            <div class="load-more"><aa-button variant="secondary" (clicked)="loadMoreUsers()">{{ 'COMMON.LOAD_MORE' | translate }}</aa-button></div>
          }
        }
      }

      <!-- ── Settings ─────────────────────────────────────────────── -->
      @if (activeTab() === 'settings') {
        <p class="settings-hint">{{ 'ADMIN.SETTINGS_HINT' | translate }}</p>
        @for (plan of planIds; track plan) {
          <div class="settings-card neo">
            <div class="settings-card-head">{{ plan | uppercase }}</div>
            <div class="settings-field">
              <label>{{ 'ADMIN.PRICE_LABEL' | translate }}</label>
              <input type="number" class="settings-input" [(ngModel)]="editValues[plan + '.price']" [placeholder]="planDefaults()[plan]?.price">
            </div>
            <aa-button size="sm" [loading]="savingKey() === plan + '.price'" (clicked)="saveSetting(plan, 'price')">{{ 'COMMON.SAVE' | translate }}</aa-button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .tabs { display:flex; gap:4px; padding:5px; margin-bottom:24px; width:fit-content; }
    .tab-btn { display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:var(--radius-pill); border:none; background:none; cursor:pointer; font-size:12px; font-weight:700; color:var(--text-muted); transition:all .2s; }
    .tab-btn.active { background: var(--bg); box-shadow: var(--neo-raised-sm); color: var(--accent); }

    .stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px; }
    @media (max-width:768px){ .stat-grid{ grid-template-columns:repeat(2,1fr);} }
    @media (max-width:640px) {
      .tabs { overflow-x: auto; max-width: 100%; }
      .search-row { flex-direction: column; }
      .user-table-head { display: none; }
      .user-table-head, .user-row { grid-template-columns: 1fr 24px; }
      .user-row .plan-chip, .user-row > span:nth-child(3), .user-row .user-date { display: none; }
      .settings-card { padding: 14px; }
    }
    .stat-skeleton { height:88px; border-radius:var(--radius); }
    .stat-card { padding:18px; }
    .stat-card.highlight { box-shadow: var(--neo-raised), 0 0 0 1px rgba(108,99,255,.2) inset; }
    .stat-val { font-family:var(--font-display); font-size:22px; font-weight:800; color:var(--text); }
    .stat-lbl { font-size:11px; color:var(--text-muted); font-weight:600; margin-top:4px; }

    .section-title { font-family:var(--font-display); font-size:14px; font-weight:700; color:var(--text); margin-bottom:12px; }
    .plan-breakdown { display:flex; flex-direction:column; gap:8px; }
    .plan-row { display:flex; align-items:center; gap:12px; padding:10px 14px; }
    .plan-name { width:80px; font-size:12px; font-weight:700; text-transform:capitalize; color:var(--text); }
    .plan-bar-track { flex:1; height:6px; border-radius:999px; background:var(--bg); box-shadow:var(--neo-inset); overflow:hidden; }
    .plan-bar { height:100%; background:var(--accent); border-radius:999px; }
    .plan-count { width:32px; text-align:right; font-size:12px; font-weight:700; color:var(--text-muted); }

    .search-row { display:flex; gap:10px; margin-bottom:20px; }
    .search-input { flex:1; padding:11px 14px; border:none; border-radius:10px; background:var(--bg); box-shadow:var(--neo-inset); font-size:13px; color:var(--text); font-family:var(--font-body); }

    .skeleton-list { display:flex; flex-direction:column; gap:8px; }
    .row-skeleton { height:56px; border-radius:var(--radius); }

    .user-table { overflow:hidden; }
    .user-table-head, .user-row { display:grid; grid-template-columns:2fr 1fr 0.7fr 1fr 24px; align-items:center; padding:12px 16px; gap:8px; }
    .user-table-head { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted); border-bottom:1px solid var(--glass-border); }
    .user-row { cursor:pointer; border-bottom:1px solid var(--glass-border); transition:background .15s; }
    .user-row:last-child { border-bottom:none; }
    .user-row:hover { background:rgba(255,255,255,.04); }
    .user-cell { display:flex; flex-direction:column; min-width:0; }
    .user-name { font-size:12px; font-weight:700; color:var(--text); }
    .user-email { font-size:11px; color:var(--text-muted); }
    .user-date { font-size:11px; color:var(--text-muted); }
    .plan-chip { width:fit-content; padding:3px 10px; border-radius:999px; font-size:10px; font-weight:800; text-transform:uppercase; background:var(--accent-dim); color:var(--accent); }

    .load-more { display:flex; justify-content:center; margin-top:16px; }

    .settings-hint { font-size:12px; color:var(--text-muted); margin-bottom:18px; }
    .settings-card { padding:18px; margin-bottom:14px; }
    .settings-card-head { font-family:var(--font-display); font-size:13px; font-weight:800; color:var(--accent); margin-bottom:12px; }
    .settings-field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
    .settings-field label { font-size:11px; font-weight:700; color:var(--text-muted); }
    .settings-input { padding:9px 12px; border:none; border-radius:8px; background:var(--bg); box-shadow:var(--neo-inset); font-size:13px; color:var(--text); font-family:var(--font-body); }
  `]
})
export class AdminComponent implements OnInit {
  activeTab = signal<'overview' | 'users' | 'settings'>('overview');
  tabs = [
    { id: 'overview', icon: 'analytics', label: 'ADMIN.TAB_OVERVIEW' },
    { id: 'users',    icon: 'users',     label: 'ADMIN.TAB_USERS' },
    { id: 'settings', icon: 'settings',  label: 'ADMIN.TAB_SETTINGS' },
  ];

  // Overview
  statsLoading = signal(true);
  stats = signal<any>(null);

  // Users
  usersLoading = signal(true);
  users = signal<any[]>([]);
  usersTotal = signal(0);
  usersPage = 1;
  searchTerm = '';

  // Settings
  planDefaults = signal<any>({});
  planIds = ['starter', 'pro', 'elite'];
  editValues: Record<string, any> = {};
  savingKey = signal<string | null>(null);

  constructor(private api: ApiService, private toast: ToastService, private router: Router) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadUsers();
    this.loadSettings();
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.api.getAdminStats().subscribe({
      next: (r: any) => { this.stats.set(r.data); this.statsLoading.set(false); },
      error: () => { this.statsLoading.set(false); this.toast.error('Failed to load stats'); },
    });
  }

  planEntries(): [string, number][] { return Object.entries(this.stats()?.usersByPlan || {}); }
  planPct(count: number): number {
    const max = Math.max(...Object.values(this.stats()?.usersByPlan || { a: 1 }) as number[], 1);
    return Math.max(4, (count / max) * 100);
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersPage = 1;
    this.api.getAdminUsers({ page: 1, limit: 20, search: this.searchTerm }).subscribe({
      next: (r: any) => { this.users.set(r.data || []); this.usersTotal.set(r.meta?.total || 0); this.usersLoading.set(false); },
      error: () => { this.usersLoading.set(false); this.toast.error('Failed to load users'); },
    });
  }

  searchUsers(): void { this.loadUsers(); }

  loadMoreUsers(): void {
    this.usersPage++;
    this.api.getAdminUsers({ page: this.usersPage, limit: 20, search: this.searchTerm }).subscribe({
      next: (r: any) => this.users.set([...this.users(), ...(r.data || [])]),
    });
  }

  openUser(id: string): void { this.router.navigate(['/admin/users', id]); }

  loadSettings(): void {
    this.api.getAdminSettings().subscribe({
      next: (r: any) => this.planDefaults.set(r.data?.planDefaults || {}),
      error: () => {},
    });
  }

  saveSetting(plan: string, field: string): void {
    const key = `plan.${plan}.${field}`;
    const val = this.editValues[key];
    if (val === undefined || val === '') return this.toast.error('Enter a value first');
    this.savingKey.set(key);
    this.api.putAdminSetting(`plan.${plan}.${field}`, Number(val), 'plans').subscribe({
      next: () => { this.savingKey.set(null); this.toast.success(`${plan} ${field} updated`); },
      error: () => { this.savingKey.set(null); this.toast.error('Failed to save'); },
    });
  }
}
