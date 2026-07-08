import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { GhostScoreComponent } from '../../shared/components/ghost-score/ghost-score.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, NeoButtonComponent, StatusBadgeComponent, GhostScoreComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">Applications</h1>
          <p class="page-subtitle">Every job applied on your behalf — tracked here.</p>
        </div>
        <div class="d-flex gap-8">
          <span class="total-badge">{{ pagination().total }} total</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar neo-sm">
        <span class="filter-label">STATUS</span>
        @for (f of filters; track f.value) {
          <button class="filter-btn" [class.active]="activeFilter() === f.value" (click)="setFilter(f.value)">
            {{ f.label }}
          </button>
        }
        <div class="filter-search">
          <aa-icon name="search" [size]="14" class="search-icon"/>
          <input class="neo-input search-input" [(ngModel)]="searchQuery" placeholder="Search company or role…"
            (input)="onSearch()">
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
          <div class="empty-title">No applications found</div>
          <div class="empty-sub">{{ activeFilter() !== 'all' || searchQuery ? 'Try a different filter or search.' : 'Activate automation to start applying.' }}</div>
        </div>
      } @else {
        <div class="jobs-grid">
          @for (app of visibleApps(); track app._id) {
            <div class="job-card neo" [class]="app.status" (click)="selectApp(app)">
              <div class="job-card-top">
                <div class="company-avatar">{{ app.company[0] }}</div>
                <div class="job-main">
                  <div class="job-title">{{ app.jobTitle }}</div>
                  <div class="job-company">{{ app.company }}</div>
                </div>
                <div class="match-score">{{ app.matchScore }}<span>%</span></div>
              </div>

              <div class="job-card-meta">
                <aa-status-badge [status]="app.status"/>
                <span class="source-badge">{{ app.source }}</span>
                <span class="time-badge">{{ formatDate(app.appliedAt) }}</span>
              </div>
              <aa-ghost-score [ghostScore]="app.ghostScore" class="mb-8"/>

              <div class="job-card-actions" (click)="$event.stopPropagation()">
                <aa-button variant="ghost" size="sm" (clicked)="openUrl(app.jobUrl)" iconRight="externalLink">View Job</aa-button>
              </div>
            </div>
          }
        </div>

        <!-- Pagination -->
        @if (pagination().pages > 1) {
          <div class="pagination">
            <aa-button variant="secondary" size="sm" [disabled]="page() === 1" (clicked)="goPage(page()-1)">Prev</aa-button>
            <span class="page-info">{{ page() }} / {{ pagination().pages }}</span>
            <aa-button variant="secondary" size="sm" [disabled]="page() === pagination().pages" (clicked)="goPage(page()+1)">Next</aa-button>
          </div>
        }
      }

      <!-- App detail panel -->
      @if (selectedApp()) {
        <div class="detail-overlay" (click)="selectedApp.set(null)">
          <div class="detail-panel neo anim-slide-in-right" (click)="$event.stopPropagation()">
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ selectedApp()!.jobTitle }}</div>
                <div class="detail-company">{{ selectedApp()!.company }}</div>
              </div>
              <button class="close-btn" (click)="selectedApp.set(null)"><aa-icon name="close" [size]="16"/></button>
            </div>

            <div class="detail-score">
              <div class="big-score">{{ selectedApp()!.matchScore }}%</div>
              <div class="text-muted text-sm">AI Match Score</div>
              @if (selectedApp()!.ghostScore !== null && selectedApp()!.ghostScore !== undefined) {
                <div class="mt-8"><aa-ghost-score [ghostScore]="selectedApp()!.ghostScore" style="margin:0 auto;width:fit-content;"/></div>
              }
            </div>

            @if (selectedApp()!.matchDimensions?.matchReasons?.length) {
              <div class="detail-section">
                <div class="detail-section-title"><aa-icon name="checkCircle" [size]="14"/> Why this matched</div>
                <ul class="reasons-list">
                  @for (r of selectedApp()!.matchDimensions.matchReasons; track r) {
                    <li>{{ r }}</li>
                  }
                </ul>
              </div>
            }

            @if (selectedApp()!.coverLetter) {
              <div class="detail-section">
                <div class="detail-section-title"><aa-icon name="fileEdit" [size]="14"/> Cover Letter Sent</div>
                <div class="cover-preview">{{ selectedApp()!.coverLetter }}</div>
              </div>
            }

            <div class="detail-section">
              <div class="detail-section-title"><aa-icon name="refresh" [size]="14"/> Update Status</div>
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
              Open Job Posting
            </aa-button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .total-badge { background: var(--accent-dim); color: var(--accent); padding: 6px 14px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 700; }

    .filters-bar { display: flex; align-items: center; gap: 8px; padding: 14px 18px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .8px; }
    .filter-btn   { padding: 6px 14px; border-radius: var(--radius-pill); border: none; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-muted); transition: all .22s; }
    .filter-btn.active { box-shadow: var(--neo-inset); color: var(--accent); }
    .filter-search { margin-left: auto; position: relative; display: flex; align-items: center; }
    .search-icon   { position: absolute; left: 12px; color: var(--text-light); pointer-events: none; }
    .search-input  { width: 220px; padding: 8px 14px 8px 32px; font-size: 12px; }
    @media(max-width:600px){ .search-input{ width:100%; } .filter-search{width:100%;} }

    .loading-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: 16px; }
    .jobs-grid    { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: 16px; }

    .empty-state { text-align: center; padding: 56px 24px; }
    .empty-icon  { color: var(--text-light); margin-bottom: 14px; }
    .empty-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .empty-sub   { font-size: 13px; color: var(--text-muted); }

    .job-card    { padding: 18px; cursor: pointer; transition: all .22s; border-left: 4px solid transparent; }
    .job-card:hover { transform: translateY(-2px); box-shadow: var(--neo-float); }
    .job-card.applied   { border-left-color: var(--accent); }
    .job-card.interview { border-left-color: var(--success); }
    .job-card.offer     { border-left-color: #f4b942; }
    .job-card.rejected  { border-left-color: var(--danger); }

    .job-card-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .company-avatar { width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(135deg,var(--accent),#a855f7); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; flex-shrink: 0; }
    .job-main   { flex: 1; min-width: 0; }
    .job-title  { font-size: 14px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .job-company{ font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .match-score{ font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--accent); flex-shrink: 0; }
    .match-score span { font-size: 12px; font-weight: 400; }

    .job-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .source-badge  { font-size: 11px; color: var(--text-muted); background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); padding: 3px 8px; border-radius: var(--radius-pill); }
    .time-badge    { font-size: 11px; color: var(--text-light); }

    .job-card-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .mb-8 { margin-bottom: 8px; display: block; }

    .pagination  { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 24px; }
    .page-info   { font-size: 13px; font-weight: 600; color: var(--text-muted); }

    .detail-overlay { position: fixed; inset: 0; background: rgba(6,8,15,.55); backdrop-filter: blur(6px); z-index: 200; display: flex; justify-content: flex-end; }
    .detail-panel   { width: min(420px, 100vw); height: 100vh; overflow-y: auto; padding: 28px 24px; display: flex; flex-direction: column; gap: 16px; }
    .detail-header  { display: flex; justify-content: space-between; align-items: flex-start; }
    .detail-title   { font-size: 18px; font-weight: 800; color: var(--text); }
    .detail-company { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .close-btn      { background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; }
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
  activeFilter = signal('all');
  searchQuery  = '';
  selectedApp  = signal<any>(null);

  /** Backend has no full-text search on /jobs/applications, so search
   *  narrows the current page client-side rather than hitting the server. */
  visibleApps = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.apps();
    return this.apps().filter(a =>
      a.company?.toLowerCase().includes(q) || a.jobTitle?.toLowerCase().includes(q)
    );
  });

  filters = [
    { value:'all',       label:'All'       },
    { value:'applied',   label:'Applied'   },
    { value:'interview', label:'Interview' },
    { value:'offer',     label:'Offer'     },
    { value:'rejected',  label:'Rejected'  },
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

  setFilter(f: string): void { this.activeFilter.set(f); this.page.set(1); this.loadApps(); }
  goPage(p: number): void    { this.page.set(p); this.loadApps(); }
  onSearch(): void           { /* filtered client-side via visibleApps() */ }

  selectApp(app: any): void  { this.selectedApp.set(app); }
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

  formatDate(d: string): string {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1)  return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }
}
