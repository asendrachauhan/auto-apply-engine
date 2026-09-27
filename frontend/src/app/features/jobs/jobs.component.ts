import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { GhostScoreComponent } from '../../shared/components/ghost-score/ghost-score.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NeoButtonComponent, StatusBadgeComponent, GhostScoreComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">{{ 'JOBS.TITLE' | translate }}</h1>
          <p class="page-subtitle">{{ 'JOBS.SUBTITLE' | translate }}</p>
        </div>
        <div class="d-flex gap-8">
          <span class="total-badge">{{ pagination().total }} {{ 'JOBS.TOTAL' | translate }}</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar neo-sm">
        <div class="filter-group status-group">
          <span class="filter-label">{{ 'JOBS.STATUS' | translate }}</span>
          <div class="filter-chips">
            @for (f of filters; track f.value) {
              <button class="filter-btn" [class.active]="activeFilter() === f.value" (click)="setFilter(f.value)">
                {{ f.label | translate }}
              </button>
            }
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-label">Platform</span>
          <select class="filter-select" [ngModel]="activePlatform()" (ngModelChange)="setPlatform($event)" aria-label="Filter applications by platform">
            @for (p of platforms; track p.val) {
              <option [value]="p.val">{{ p.label }}</option>
            }
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">Date</span>
          <select class="filter-select" [ngModel]="activeDate()" (ngModelChange)="setDate($event)" aria-label="Filter applications by date">
            @for (d of dateFilters; track d.val) {
              <option [value]="d.val">{{ d.label }}</option>
            }
          </select>
        </div>

        <div class="filter-search">
          <aa-icon name="search" [size]="14" class="search-icon"/>
          <input class="neo-input search-input" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" [placeholder]="'JOBS.SEARCH_PLACEHOLDER' | translate">
        </div>

        <div class="filter-actions-right">
          @if (hasActiveFilters()) {
            <button class="filter-reset-btn" (click)="resetFilters()" title="Reset all filters">
              <aa-icon name="close" [size]="12"/> Reset
            </button>
          }
          <span class="filter-count text-muted text-xs">
            {{ visibleApps().length }} of {{ apps().length }}
          </span>
        </div>
      </div>

      <!-- Jobs grid -->
      @if (loading()) {
        <div class="loading-grid">
          @for (_ of [1,2,3,4,5,6]; track $index) {
            <div class="skeleton" style="height:110px;border-radius:16px;"></div>
          }
        </div>
      } @else if (visibleApps().length === 0) {
        <div class="empty-state neo">
          <aa-icon name="briefcase" [size]="44" class="empty-icon"/>
          <div class="empty-title">{{ 'JOBS.NO_FOUND' | translate }}</div>
          <div class="empty-sub">{{ activeFilter() !== 'all' || searchQuery() ? ('JOBS.TRY_FILTER' | translate) : ('JOBS.ACTIVATE_AUTOMATION' | translate) }}</div>
        </div>
      } @else {
        <div class="jobs-grid">
          @for (app of visibleApps(); track app._id) {
            <div class="job-card neo" [class]="app.status" role="button" tabindex="0"
              [attr.aria-label]="app.jobTitle + ' at ' + app.company + ', view details'"
              (click)="selectApp(app)"
              (keydown.enter)="onCardKey($event, app)" (keydown.space)="onCardKey($event, app)">
              <div class="job-card-top">
                <div class="company-avatar">{{ app.company[0] }}</div>
                <div class="job-main">
                  <div class="job-title">{{ cleanText(app.jobTitle) }}</div>
                  <div class="job-company">{{ cleanText(app.company) }}</div>
                </div>
                <div class="match-score">{{ app.matchScore }}<span>%</span></div>
              </div>

              <div class="job-card-meta">
                <aa-status-badge [status]="app.status"/>
                <span class="source-badge">{{ app.source }}</span>
                <span class="posting-date-badge" [class.fresh]="isFresh(app.postedAt || app.appliedAt)" [title]="'Posted ' + formatFullDate(app.postedAt || app.appliedAt)">
                  <aa-icon name="clock" [size]="11"/> {{ 'Posted ' + timeAgo(app.postedAt || app.appliedAt) }}
                </span>
                <span class="time-badge">{{ formatDate(app.appliedAt) }}</span>
              </div>
              <aa-ghost-score [ghostScore]="app.ghostScore" class="mb-8"/>

              <div class="job-card-actions" (click)="$event.stopPropagation()">
                <aa-button variant="ghost" size="sm" (clicked)="openUrl(app.jobUrl)" iconRight="externalLink">{{ 'JOBS.VIEW_JOB' | translate }}</aa-button>
              </div>
            </div>
          }
        </div>

        <!-- Pagination -->
        @if (pagination().pages > 1) {
          <div class="pagination">
            <aa-button variant="secondary" size="sm" [disabled]="page() === 1" (clicked)="goPage(page()-1)">{{ 'JOBS.PREV' | translate }}</aa-button>
            <span class="page-info">{{ page() }} / {{ pagination().pages }}</span>
            <aa-button variant="secondary" size="sm" [disabled]="page() === pagination().pages" (clicked)="goPage(page()+1)">{{ 'JOBS.NEXT' | translate }}</aa-button>
          </div>
        }
      }

      <!-- App detail panel -->
      @if (selectedApp()) {
        <div class="detail-overlay" (click)="selectedApp.set(null)">
          <div class="detail-panel neo anim-slide-in-right" (click)="$event.stopPropagation()">
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ cleanText(selectedApp()!.jobTitle) }}</div>
                <div class="detail-company">{{ cleanText(selectedApp()!.company) }}</div>
                <div class="job-posted-time text-xs text-muted mt-4 d-flex align-center gap-4">
                  <aa-icon name="clock" [size]="12"/>
                  <span>Posted {{ timeAgo(selectedApp()!.postedAt || selectedApp()!.appliedAt) }} ({{ formatFullDate(selectedApp()!.postedAt || selectedApp()!.appliedAt) }})</span>
                </div>
              </div>
              <button class="close-btn" (click)="selectedApp.set(null)" aria-label="Close"><aa-icon name="close" [size]="16"/></button>
            </div>

            <div class="detail-score">
              <div class="big-score">{{ selectedApp()!.matchScore }}%</div>
              <div class="text-muted text-sm">{{ 'JOBS.AI_MATCH_SCORE' | translate }}</div>
              @if (selectedApp()!.ghostScore !== null && selectedApp()!.ghostScore !== undefined) {
                <div class="mt-8"><aa-ghost-score [ghostScore]="selectedApp()!.ghostScore" style="margin:0 auto;width:fit-content;"/></div>
              }
            </div>

            @if (selectedApp()!.matchDimensions?.matchReasons?.length) {
              <div class="detail-section">
                <div class="detail-section-title"><aa-icon name="checkCircle" [size]="14"/> {{ 'JOBS.WHY_MATCHED' | translate }}</div>
                <ul class="reasons-list">
                  @for (r of selectedApp()!.matchDimensions.matchReasons; track r) {
                    <li>{{ r }}</li>
                  }
                </ul>
              </div>
            }

            @if (selectedApp()!.coverLetter) {
              <div class="detail-section">
                <div class="detail-section-title"><aa-icon name="fileEdit" [size]="14"/> {{ 'JOBS.COVER_LETTER_SENT' | translate }}</div>
                <div class="cover-preview">{{ selectedApp()!.coverLetter }}</div>
              </div>
            }

            <div class="detail-section">
              <div class="detail-section-title"><aa-icon name="refresh" [size]="14"/> {{ 'JOBS.UPDATE_STATUS' | translate }}</div>
              <div class="status-btns">
                @for (s of statusOptions; track s) {
                  <button class="status-opt" [class.active]="selectedApp()!.status === s"
                    (click)="updateStatus(selectedApp()!, s)">
                    {{ s | titlecase }}
                  </button>
                }
              </div>
            </div>

            <aa-button variant="primary" [fullWidth]="true" (clicked)="openUrl(selectedApp()!.jobUrl)" iconRight="externalLink">
              {{ 'JOBS.OPEN_JOB_POSTING' | translate }}
            </aa-button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .total-badge { background: var(--accent-dim); color: var(--accent); padding: 6px 14px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 700; }

    .filters-bar { display: flex; align-items: center; gap: 12px; padding: 12px 18px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .filter-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .6px; white-space: nowrap; }
    .filter-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .filter-btn   { padding: 6px 14px; border-radius: var(--radius-pill); border: none; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-muted); transition: all .22s; }
    .filter-btn:hover { color:var(--text); background:var(--surface-hover); }
    .filter-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .filter-btn.active { box-shadow:var(--neo-inset); color:var(--accent); }
    .filter-select {
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--glass-border);
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      box-shadow: var(--neo-sm);
      cursor: pointer;
      outline: none;
      transition: all .2s;
    }
    .filter-select:hover { border-color: var(--accent); }
    .filter-select:focus-visible { border-color: var(--accent); outline: 2px solid var(--accent-dim); }
    .filter-search { position: relative; display: flex; align-items: center; }
    .search-icon   { position: absolute; left: 12px; color: var(--text-light); pointer-events: none; }
    .search-input  { width: 200px; padding: 8px 14px 8px 32px; font-size: 12px; }
    .filter-actions-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
    .filter-reset-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 12px; border-radius: var(--radius-pill);
      border: 1px dashed var(--danger); background: var(--bg);
      color: var(--danger); font-size: 11px; font-weight: 700;
      cursor: pointer; transition: all .2s;
    }
    .filter-reset-btn:hover { background: var(--danger-hover); }
    .filter-count { font-weight: 600; white-space: nowrap; }
    @media(max-width:768px){
      .filters-bar { gap: 10px; padding: 10px 14px; }
      .search-input{ width:100%; }
      .filter-search{ width:100%; }
      .filter-actions-right { margin-left: 0; width: 100%; justify-content: space-between; }
    }

    .loading-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,300px),1fr)); gap: 16px; }
    .jobs-grid    { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,300px),1fr)); gap: 16px; }

    .empty-state { text-align: center; padding: 56px 24px; }
    .empty-icon  { color: var(--text-light); margin-bottom: 14px; }
    .empty-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .empty-sub   { font-size: 13px; color: var(--text-muted); }

    .job-card    { padding: 18px; cursor: pointer; transition: transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out); border-left: 4px solid transparent; }
    .job-card:hover { transform: translateY(-2px); box-shadow: var(--neo-float); }
    .job-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .job-card.applied   { border-left-color: var(--accent); }
    .job-card.interview { border-left-color: var(--success); }
    .job-card.offer     { border-left-color: var(--gold); }
    .job-card.rejected  { border-left-color: var(--danger); }

    .job-card-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .company-avatar { width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(135deg,var(--accent),var(--accent-secondary)); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; flex-shrink: 0; }
    .job-main   { flex: 1; min-width: 0; }
    .job-title  { font-size: 14px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .job-company{ font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .match-score{ font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--accent); flex-shrink: 0; }
    .match-score span { font-size: 12px; font-weight: 400; }

    .job-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .source-badge  { font-size: 11px; color: var(--text-muted); background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); padding: 3px 8px; border-radius: var(--radius-pill); }
    .posting-date-badge { font-size: 11px; color: var(--text-muted); background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); padding: 3px 8px; border-radius: var(--radius-pill); display: inline-flex; align-items: center; gap: 4px; }
    .posting-date-badge.fresh { color: var(--success-text); background: var(--success-soft); border-color: var(--success); font-weight: 700; }
    .time-badge    { font-size: 11px; color: var(--text-light); }

    .job-card-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .mb-8 { margin-bottom: 8px; display: block; }

    .pagination  { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 24px; }
    .page-info   { font-size: 13px; font-weight: 600; color: var(--text-muted); }

    .detail-overlay { position: fixed; inset: 0; background: var(--shadow-overlay-heavy); backdrop-filter: blur(6px); z-index: 200; display: flex; justify-content: flex-end; }
    .detail-panel   { width: min(420px, 100vw); height: 100vh; overflow-y: auto; padding: 28px 24px; display: flex; flex-direction: column; gap: 16px; }
    .detail-header  { display: flex; justify-content: space-between; align-items: flex-start; }
    .detail-title   { font-size: 18px; font-weight: 800; color: var(--text); }
    .detail-company { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .close-btn      { background:none; border:none; cursor:pointer; color:var(--text-muted); display:flex; padding:6px; border-radius:8px; }
    .close-btn:hover { background:var(--surface-hover); color:var(--text); }
    .close-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .detail-score   { text-align: center; }
    .big-score      { font-family: var(--font-display); font-size: 52px; font-weight: 800; color: var(--accent); line-height: 1; }
    .detail-section       { background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset); border-radius: 12px; padding: 14px; }
    .detail-section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .6px; margin-bottom: 10px; }
    .reasons-list   { padding-left: 16px; display: flex; flex-direction: column; gap: 6px; }
    .reasons-list li{ font-size: 13px; color: var(--text); }
    .cover-preview  { font-size: 12px; color: var(--text); line-height: 1.7; max-height: 180px; overflow-y: auto; white-space: pre-wrap; }
    .status-btns    { display: flex; flex-wrap: wrap; gap: 8px; }
    .status-opt     { padding: 5px 12px; border-radius: var(--radius-pill); border: none; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-muted); transition: all .2s; }
    .status-opt.active { box-shadow: var(--neo-inset); color: var(--accent); }
  `]
})
export class JobsComponent implements OnInit {
  apps       = signal<any[]>([]);
  loading    = signal(true);
  page       = signal(1);
  pagination = signal({ total:0, pages:1, page:1, limit:20 });
  activeFilter   = signal('all');
  activePlatform = signal('all');
  activeDate     = signal('all');
  searchQuery    = signal('');
  selectedApp    = signal<any>(null);

  platforms = [
    { val: 'all',       label: 'All Platforms' },
    { val: 'indeed',    label: 'Indeed' },
    { val: 'linkedin',  label: 'LinkedIn' },
    { val: 'naukri',    label: 'Naukri' },
    { val: 'adzuna',    label: 'Adzuna' },
    { val: 'himalayas', label: 'Himalayas' },
    { val: 'other',     label: 'Other Boards' },
  ];

  dateFilters = [
    { val: 'all', label: 'All Time' },
    { val: '1h',  label: 'Last 1 Hour (<60m)' },
    { val: '24h', label: 'Last 24 Hours' },
    { val: '3d',  label: 'Last 3 Days' },
    { val: '7d',  label: 'Last 7 Days' },
    { val: '14d', label: 'Last 14 Days' },
    { val: '30d', label: 'Last 30 Days' },
  ];

  hasActiveFilters = computed(() => {
    return this.activeFilter() !== 'all' ||
      this.activePlatform() !== 'all' ||
      this.activeDate() !== 'all' ||
      this.searchQuery().trim() !== '';
  });

  /** Backend has no full-text search or source/date filter on /jobs/applications,
   *  so search, platform and date filter client-side over loaded applications. */
  visibleApps = computed(() => {
    let list = this.apps();
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(a =>
        a.company?.toLowerCase().includes(q) || a.jobTitle?.toLowerCase().includes(q)
      );
    }
    if (this.activePlatform() !== 'all') {
      const p = this.activePlatform().toLowerCase();
      list = list.filter(a => {
        const src = (a.source || '').toLowerCase();
        const srcPlat = (a.sourcePlatform || '').toLowerCase();
        const url = (a.jobUrl || '').toLowerCase();
        if (p === 'other') {
          const known = ['indeed', 'linkedin', 'naukri', 'adzuna', 'himalayas'];
          return !known.some(k => src.includes(k) || srcPlat.includes(k) || url.includes(k));
        }
        return src.includes(p) || srcPlat.includes(p) || url.includes(p);
      });
    }
    if (this.activeDate() !== 'all') {
      const now = Date.now();
      let maxAgeMs = 0;
      if (this.activeDate() === '1h') maxAgeMs = 60 * 60 * 1000;
      else if (this.activeDate() === '24h') maxAgeMs = 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '3d') maxAgeMs = 3 * 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '14d') maxAgeMs = 14 * 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

      if (maxAgeMs > 0) {
        list = list.filter(a => {
          const raw = a.postedAt || a.appliedAt || a.createdAt;
          const d = raw ? new Date(raw).getTime() : 0;
          return d > 0 && (now - d) <= maxAgeMs;
        });
      }
    }
    return list;
  });

  filters = [
    { value:'all',       label:'JOBS.ALL'       },
    { value:'applied',   label:'JOBS.APPLIED'   },
    { value:'interview', label:'JOBS.INTERVIEW' },
    { value:'offer',     label:'JOBS.OFFER'     },
    { value:'rejected',  label:'JOBS.REJECTED'  },
  ];

  statusOptions = ['applied','viewed','interview','offer','rejected'];

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void { this.loadApps(); }

  loadApps(): void {
    this.loading.set(true);
    this.api.getApplications({
      page:   this.page(),
      limit:  20,
      status: this.activeFilter() !== 'all' ? this.activeFilter() : undefined,
    }).subscribe({
      next: (r: any) => {
        this.apps.set(r.data || []);
        this.pagination.set(r.meta || { total:0, pages:1, page:1, limit:20 });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setFilter(f: string): void   { this.activeFilter.set(f); this.page.set(1); this.loadApps(); }
  setPlatform(p: string): void { this.activePlatform.set(p); }
  setDate(d: string): void     { this.activeDate.set(d); }
  resetFilters(): void {
    this.activeFilter.set('all');
    this.activePlatform.set('all');
    this.activeDate.set('all');
    this.searchQuery.set('');
    this.page.set(1);
    this.loadApps();
  }
  goPage(p: number): void      { this.page.set(p); this.loadApps(); }
  onSearch(): void             { /* filtered client-side via visibleApps() */ }

  selectApp(app: any): void  { this.selectedApp.set(app); }
  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.selectedApp()) this.selectedApp.set(null); }
  onCardKey(event: Event, app: any): void {
    // Only act if the key event originated on the card itself, not a nested
    // interactive control (which handles its own Enter/Space activation
    // natively) — otherwise pressing Enter on the "View Job" button inside
    // the card would open both the external link AND the detail panel.
    if (event.target !== event.currentTarget) return;
    event.preventDefault(); // stop Space from scrolling the page
    this.selectApp(app);
  }
  openUrl(url: string): void { window.open(url, '_blank'); }

  updateStatus(app: any, status: string): void {
    this.api.updateJobStatus(app._id, status).subscribe({
      next: (r: any) => {
        this.selectedApp.set(r.data);
        this.loadApps();
        this.toast.success('Status updated');
      },
      error: () => this.toast.error('Update failed'),
    });
  }

  cleanText(str: string): string {
    if (!str) return '';
    return str
      .replace(/&#x2f;/gi, '/')
      .replace(/&#x27;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  isFresh(d: any): boolean {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !isNaN(t) && (Date.now() - t) <= 24 * 60 * 60 * 1000;
  }

  timeAgo(d: string | Date | null | undefined): string {
    if (!d) return '';
    const diffMs = Date.now() - new Date(d).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  formatFullDate(d: string | Date | null | undefined): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDate(d: string): string {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1)  return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }
}
