import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-analytics',
  standalone: true,
  imports: [CommonModule, TranslateModule, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ 'ANALYTICS.PAGE_TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'ANALYTICS.PAGE_SUBTITLE' | translate: { count: apps().length } }}</p>
      </div>

      @if (loading()) {
        <div class="loading-grid">
          @for (_ of [1,2,3,4]; track $index) { <div class="skeleton" style="height:130px;border-radius:16px;"></div> }
        </div>
      } @else if (apps().length === 0) {
        <div class="empty-state neo" style="text-align:center;padding:56px;">
          <aa-icon name="analytics" [size]="44" style="color:var(--text-light);margin-bottom:14px;"/>
          <div style="font-size:16px;font-weight:700;color:var(--text);">{{ 'ANALYTICS.NO_DATA_TITLE' | translate }}</div>
          <div class="text-muted text-sm mt-8">{{ 'ANALYTICS.NO_DATA_SUBTITLE' | translate }}</div>
        </div>
      } @else {

        <!-- Summary stats -->
        <div class="stats-grid">
          <div class="stat-card neo">
            <div class="stat-value">{{ apps().length }}</div>
            <div class="stat-label">{{ 'ANALYTICS.APPS_TRACKED' | translate }}</div>
          </div>
          <div class="stat-card neo">
            <div class="stat-value text-accent">{{ avgMatchScore() }}%</div>
            <div class="stat-label">{{ 'ANALYTICS.AVG_MATCH_SCORE' | translate }}</div>
          </div>
          <div class="stat-card neo">
            <div class="stat-value text-success">{{ interviewRate() }}%</div>
            <div class="stat-label">{{ 'ANALYTICS.INTERVIEW_RATE' | translate }}</div>
          </div>
          <div class="stat-card neo">
            <div class="stat-value">{{ avgGhostScore() }}</div>
            <div class="stat-label">{{ 'ANALYTICS.AVG_GHOST_SCORE' | translate }}</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Applications over time -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="trendingUp" [size]="16"/> {{ 'ANALYTICS.APPS_LAST_14' | translate }}</div>
            <div class="bar-chart">
              @for (d of dailyCounts(); track d.label) {
                <div class="bar-col">
                  <div class="bar" [style.height.%]="d.pct" [title]="d.count + ' on ' + d.label"></div>
                  <div class="bar-label">{{ d.label }}</div>
                </div>
              }
            </div>
          </div>

          <!-- Status breakdown -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="briefcase" [size]="16"/> {{ 'ANALYTICS.STATUS_BREAKDOWN' | translate }}</div>
            <div class="status-bars">
              @for (s of statusBreakdown(); track s.status) {
                <div class="status-bar-row">
                  <span class="status-bar-label">{{ s.status | titlecase }}</span>
                  <div class="status-bar-track">
                    <div class="status-bar-fill" [style.width.%]="s.pct" [style.background]="s.color"></div>
                  </div>
                  <span class="status-bar-count">{{ s.count }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Source breakdown -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="target" [size]="16"/> {{ 'ANALYTICS.APPS_BY_SOURCE' | translate }}</div>
            <div class="status-bars">
              @for (s of sourceBreakdown(); track s.source) {
                <div class="status-bar-row">
                  <span class="status-bar-label">{{ s.source || unknownLabel }}</span>
                  <div class="status-bar-track">
                    <div class="status-bar-fill" [style.width.%]="s.pct" style="background:var(--accent);"></div>
                  </div>
                  <span class="status-bar-count">{{ s.count }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Match score distribution -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="star" [size]="16"/> {{ 'ANALYTICS.MATCH_SCORE_DIST' | translate }}</div>
            <div class="bar-chart small">
              @for (b of scoreBuckets(); track b.label) {
                <div class="bar-col">
                  <div class="bar" [style.height.%]="b.pct" [style.background]="b.color" [title]="b.count + ' ' + applicationsLabel"></div>
                  <div class="bar-label">{{ b.label }}</div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .loading-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
    @media(max-width:800px){ .loading-grid{ grid-template-columns:repeat(2,1fr);} }

    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
    @media(max-width:800px){ .stats-grid{ grid-template-columns:repeat(2,1fr);} }
    .stat-card  { padding: 20px; text-align: center; }
    .stat-value { font-family: var(--font-display); font-size: 30px; font-weight: 800; color: var(--text); }
    .stat-label { font-size: 11px; color: var(--text-muted); margin-top: 6px; }

    .bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 160px; padding-top: 10px; }
    .bar-chart.small { height: 130px; }
    .bar-col   { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
    .bar       { width: 100%; max-width: 28px; background: linear-gradient(180deg,var(--accent),#a855f7); border-radius: 6px 6px 2px 2px; min-height: 3px; transition: height .4s ease; }
    .bar-label { font-size: 9px; color: var(--text-muted); margin-top: 6px; white-space: nowrap; }

    .status-bars     { display: flex; flex-direction: column; gap: 12px; }
    .status-bar-row   { display: flex; align-items: center; gap: 10px; }
    .status-bar-label { font-size: 12px; color: var(--text); font-weight: 600; width: 90px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-bar-track { flex: 1; height: 8px; border-radius: 4px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset); overflow: hidden; }
    .status-bar-fill  { height: 100%; border-radius: 4px; transition: width .4s ease; }
    .status-bar-count { font-size: 12px; font-weight: 700; color: var(--text-muted); width: 24px; text-align: right; flex-shrink: 0; }
  `]
})
export class AnalyticsComponent implements OnInit {
  loading = signal(true);
  apps    = signal<any[]>([]);

  unknownLabel      = '';
  applicationsLabel = '';

  constructor(private api: ApiService, private translate: TranslateService) {}

  ngOnInit(): void {
    this.unknownLabel      = this.translate.instant('ANALYTICS.UNKNOWN');
    this.applicationsLabel = this.translate.instant('ANALYTICS.APPLICATIONS_LABEL');

    this.api.getApplications({ limit: 200 }).subscribe({
      next: (r: any) => { this.apps.set(r.data || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  avgMatchScore = computed(() => {
    const scored = this.apps().filter(a => typeof a.matchScore === 'number');
    return scored.length ? Math.round(scored.reduce((s,a) => s + a.matchScore, 0) / scored.length) : 0;
  });

  avgGhostScore = computed(() => {
    const scored = this.apps().filter(a => typeof a.ghostScore === 'number');
    return scored.length ? Math.round(scored.reduce((s,a) => s + a.ghostScore, 0) / scored.length) : 0;
  });

  interviewRate = computed(() => {
    const total = this.apps().length;
    if (!total) return 0;
    const advanced = this.apps().filter(a => ['interview','offer'].includes(a.status)).length;
    return Math.round((advanced / total) * 100);
  });

  dailyCounts = computed(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = this.apps().filter(a => {
        const t = new Date(a.appliedAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      days.push({ label: d.toLocaleDateString('en-US', { day:'numeric', month:'short' }), count });
    }
    const max = Math.max(...days.map(d => d.count), 1);
    return days.map(d => ({ ...d, pct: Math.max((d.count / max) * 100, d.count > 0 ? 6 : 0) }));
  });

  statusBreakdown = computed(() => {
    const colors: Record<string,string> = {
      applied:'#6c63ff', pending:'#94a3b8', viewed:'#38bdf8',
      interview:'#43e97b', offer:'#f4b942', rejected:'#f5576c',
    };
    const counts: Record<string, number> = {};
    this.apps().forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    const total = this.apps().length || 1;
    return Object.entries(counts)
      .sort((a,b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count, pct: Math.round((count/total)*100), color: colors[status] || '#94a3b8' }));
  });

  sourceBreakdown = computed(() => {
    const counts: Record<string, number> = {};
    this.apps().forEach(a => { const s = a.source || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    const max = Math.max(...Object.values(counts), 1);
    return Object.entries(counts)
      .sort((a,b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count, pct: Math.round((count/max)*100) }));
  });

  scoreBuckets = computed(() => {
    const buckets = [
      { label:'<50',   min:0,  max:50,  color:'#f5576c' },
      { label:'50-64', min:50, max:65,  color:'#f8961e' },
      { label:'65-79', min:65, max:80,  color:'#f4b942' },
      { label:'80-89', min:80, max:90,  color:'#6c63ff' },
      { label:'90+',   min:90, max:101, color:'#43e97b' },
    ];
    const scored = this.apps().filter(a => typeof a.matchScore === 'number');
    const counted = buckets.map(b => ({
      ...b, count: scored.filter(a => a.matchScore >= b.min && a.matchScore < b.max).length,
    }));
    const max = Math.max(...counted.map(b => b.count), 1);
    return counted.map(b => ({ ...b, pct: Math.max((b.count/max)*100, b.count > 0 ? 6 : 0) }));
  });
}
