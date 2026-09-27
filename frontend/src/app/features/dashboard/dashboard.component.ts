import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring/progress-ring.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, NeoButtonComponent, ProgressRingComponent, StatusBadgeComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">{{ 'DASHBOARD.TITLE' | translate }}</h1>
          <p class="page-subtitle">{{ 'DASHBOARD.WELCOME' | translate: { name: firstName() } }}</p>
        </div>
        <div class="header-actions">
          <aa-button variant="secondary" size="sm" [routerLink]="['/plans']" icon="star">
            {{ planLabel() }}
          </aa-button>
          <aa-button [loading]="runningNow()" (clicked)="runNow()" icon="zap">{{ 'DASHBOARD.RUN_NOW' | translate }}</aa-button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="stats-grid">
        @for (s of stats(); track s.label) {
          <div class="stat-card neo stagger-1 anim-slide-in-up">
            <aa-icon class="stat-icon" [name]="s.icon" [size]="22"/>
            <div class="stat-value">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-delta" [class.positive]="s.positive">{{ s.delta }}</div>
          </div>
        }
      </div>

      <div class="grid-2">
        <!-- Daily limit ring -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="zap" [size]="16"/> {{ 'DASHBOARD.TODAYS_PROGRESS' | translate }}</div>
          <div class="ring-row">
            <aa-progress-ring
              [percent]="dailyPercent()"
              [size]="110"
              [label]="'DASHBOARD.APPLIED' | translate"
              [suffix]="''"
            />
            <div class="ring-meta">
              <div class="ring-big">{{ todayApplied() }}<span class="ring-denom">/{{ user()?.dailyApplyLimit || 20 }}</span></div>
              <div class="text-muted text-sm">{{ 'DASHBOARD.TODAYS_APPS' | translate }}</div>
              <div class="mt-8">
                <aa-button size="sm" variant="secondary" [routerLink]="['/automation']">{{ 'DASHBOARD.VIEW_LOG' | translate }}</aa-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Automation toggle -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="automation" [size]="16"/> {{ 'DASHBOARD.AUTOMATION_CONTROL' | translate }}</div>
          <div class="auto-control">
            <div class="auto-state" [class.active]="autoActive()">
              <div class="auto-pulse" [class.on]="autoActive()"></div>
              <div>
                <div class="auto-state-label">{{ autoActive() ? ('DASHBOARD.RUNNING_AUTO' | translate) : ('DASHBOARD.AUTOMATION_PAUSED' | translate) }}</div>
                <div class="text-muted text-sm">{{ autoActive() ? ('DASHBOARD.NEXT_RUN' | translate) : ('DASHBOARD.TOGGLE_ACTIVATE' | translate) }}</div>
              </div>
            </div>
            <label class="big-toggle">
              <input type="checkbox" [checked]="autoActive()" (change)="toggleAuto($event)">
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
            </label>
          </div>
          @if (isPro()) {
            <div class="realtime-row">
              <span class="pro-badge">PRO</span>
              <span class="text-sm text-muted">{{ 'DASHBOARD.REALTIME_WATCHER' | translate }}</span>
              <label class="mini-toggle">
                <input type="checkbox" [checked]="watchActive()" (change)="toggleWatch($event)">
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </label>
            </div>
          }
        </div>
      </div>

      <!-- Recent applications -->
      <div class="section-card">
        <div class="section-title d-flex justify-between align-center">
          <span class="d-flex align-center gap-8"><aa-icon name="briefcase" [size]="16"/> {{ 'DASHBOARD.RECENT_APPLICATIONS' | translate }}</span>
          <aa-button variant="ghost" size="sm" [routerLink]="['/jobs']">{{ 'DASHBOARD.VIEW_ALL' | translate }}</aa-button>
        </div>

        @if (loadingApps()) {
          <div class="apps-list">
            @for (_ of [1,2,3]; track $index) {
              <div class="skeleton" style="height:56px;border-radius:10px;"></div>
            }
          </div>
        } @else if (recentApps().length === 0) {
          <div class="empty-state">
            @if (!hasResume()) {
              <aa-icon name="briefcase" [size]="40" class="empty-icon"/>
              <div class="empty-title">{{ 'DASHBOARD.NO_APPS_YET' | translate }}</div>
              <div class="empty-sub">{{ 'DASHBOARD.UPLOAD_TO_START' | translate }}</div>
              <aa-button size="sm" [routerLink]="['/resume']" class="mt-16" icon="upload">{{ 'DASHBOARD.UPLOAD_RESUME' | translate }}</aa-button>
            } @else if (!autoActive()) {
              <aa-icon name="zap" [size]="40" class="empty-icon"/>
              <div class="empty-title">{{ 'DASHBOARD.RESUME_READY_TITLE' | translate }}</div>
              <div class="empty-sub">{{ 'DASHBOARD.RESUME_READY_SUB' | translate }}</div>
              <aa-button size="sm" [routerLink]="['/automation']" class="mt-16" icon="zap">{{ 'DASHBOARD.ACTIVATE_AUTOMATION' | translate }}</aa-button>
            } @else {
              <aa-icon name="clock" [size]="40" class="empty-icon"/>
              <div class="empty-title">{{ 'DASHBOARD.AUTOMATION_RUNNING_TITLE' | translate }}</div>
              <div class="empty-sub">{{ 'DASHBOARD.AUTOMATION_RUNNING_SUB' | translate }}</div>
              <aa-button size="sm" variant="secondary" (clicked)="runNow()" [loading]="runningNow()" class="mt-16" icon="play">{{ 'DASHBOARD.RUN_NOW' | translate }}</aa-button>
            }
          </div>
        } @else {
          <div class="apps-list">
            @for (app of recentApps(); track app._id) {
              <div class="app-row">
                <div class="app-company-avatar">{{ app.company[0] }}</div>
                <div class="app-info">
                  <div class="app-title">{{ app.jobTitle }}</div>
                  <div class="app-meta">{{ app.company }} · {{ app.source }}</div>
                </div>
                <div class="app-score">{{ app.matchScore }}%</div>
                <aa-status-badge [status]="app.status"/>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .stats-grid     { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
    @media(max-width:900px){ .stats-grid{ grid-template-columns:repeat(2,1fr);} }
    @media(max-width:500px){ .stats-grid{ grid-template-columns:1fr;} }

    .stat-card  { padding: 22px; position: relative; overflow: hidden; }
    /* First card = "Total Applied", the metric that proves the automation is
       actually working. Giving it a subtle accent border instead of treating
       all 4 stat cards as equal-weight competes less for attention and gives
       the eye a clear entry point — the "north-star metric first" pattern
       used by Stripe/Vercel-style dashboards rather than a flat metric wall. */
    .stat-card:first-child { border: 1px solid var(--accent-dim); }
    .stat-card:first-child .stat-value { color: var(--accent); }
    .stat-icon  { color: var(--accent); margin-bottom: 10px; }
    .stat-value { font-family: var(--font-display); font-size: 34px; font-weight: 800; color: var(--text); line-height: 1; }
    .stat-label { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 4px; }
    .stat-delta { font-size: 11px; font-weight: 700; margin-top: 6px; color: var(--text-light); }
    .stat-delta.positive { color: var(--success); }

    .ring-row   { display: flex; align-items: center; gap: 24px; }
    .ring-meta  { flex: 1; }
    .ring-big   { font-family: var(--font-display); font-size: 32px; font-weight: 800; color: var(--text); line-height: 1; }
    .ring-denom { font-size: 16px; color: var(--text-muted); font-weight: 400; }

    .auto-control { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
    .auto-state   { display: flex; align-items: center; gap: 12px; }
    .auto-pulse   { width: 12px; height: 12px; border-radius: 50%; background: var(--text-light); transition: all .3s; flex-shrink: 0; }
    .auto-pulse.on { background: var(--success); box-shadow: 0 0 10px var(--success-glow); animation: pulse 2s infinite; }
    .auto-state-label { font-size: 14px; font-weight: 700; color: var(--text); }
    @keyframes pulse { 0%,100%{box-shadow:0 0 8px var(--success-glow);}50%{box-shadow:0 0 18px var(--success-glow-strong);} }

    .big-toggle { position: relative; display: inline-block; width: 58px; height: 30px; flex-shrink: 0; }
    .big-toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-track { position: absolute; inset: 0; border-radius: 30px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset); cursor: pointer; transition: .3s; }
    .toggle-thumb { position: absolute; left: 4px; top: 4px; width: 22px; height: 22px; border-radius: 50%; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); transition: .3s; }
    .big-toggle input:checked + .toggle-track { background: linear-gradient(135deg,var(--accent),var(--accent-secondary)); box-shadow: inset 2px 2px 5px var(--shadow-inset); }
    .big-toggle input:checked + .toggle-track .toggle-thumb { transform: translateX(28px); background: #fff; }

    .realtime-row { display: flex; align-items: center; gap: 10px; padding-top: 12px; border-top: 1px solid var(--divider); }
    .pro-badge    { background: linear-gradient(135deg,var(--accent),var(--accent-secondary)); color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
    .mini-toggle  { position: relative; display: inline-block; width: 44px; height: 24px; margin-left: auto; flex-shrink: 0; }
    .mini-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .mini-toggle .toggle-track { position: absolute; inset: 0; border-radius: 999px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset); cursor: pointer; transition: background .25s ease, border-color .25s ease; }
    .mini-toggle .toggle-thumb { position: absolute; left: 3px; top: 50%; width: 16px; height: 16px; border-radius: 50%; background: var(--text-muted); box-shadow: 0 1px 3px rgba(0,0,0,0.3); transform: translateY(-50%); transition: transform .25s ease, background .25s ease; }
    .mini-toggle input:checked + .toggle-track { background: linear-gradient(135deg,var(--accent),var(--accent-secondary)); border-color: var(--accent); }
    .mini-toggle input:checked + .toggle-track .toggle-thumb { transform: translate(20px, -50%); background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.4); }

    .empty-state { text-align: center; padding: 40px 20px; }
    .empty-icon  { color: var(--text-light); margin-bottom: 12px; }
    .empty-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
    .empty-sub   { font-size: 13px; color: var(--text-muted); }

    .apps-list { display: flex; flex-direction: column; gap: 6px; }
    .app-row   { display: flex; align-items: center; gap: 12px; padding: 12px 8px; border-radius: 10px; transition: all .2s; }
    .app-row:hover { box-shadow: var(--neo-sm); }
    .app-company-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg,var(--accent),var(--accent-secondary)); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0; }
    .app-info  { flex: 1; min-width: 0; }
    .app-title { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-meta  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .app-score { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--accent); flex-shrink: 0; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  user       = computed(() => this.auth.currentUser());
  firstName  = computed(() => this.user()?.name?.split(' ')[0] || 'there');
  autoActive = signal(false);
  watchActive= signal(false);
  runningNow = signal(false);
  loadingApps= signal(true);
  todayApplied = signal(0);
  isPro      = computed(() => ['pro','elite'].includes(this.user()?.plan || 'free'));
  recentApps = signal<any[]>([]);

  stats = computed(() => {
    const t = this.translate;
    return [
      { icon:'send',          label: t.instant('DASHBOARD.TOTAL_APPLIED'), value: this.totalApps(),      delta: this.todayApplied() + ' ' + t.instant('DASHBOARD.TODAY_SUFFIX'), positive: true },
      { icon:'target',        label: t.instant('DASHBOARD.MATCH_RATE'),    value: this.matchRate()+'%',  delta: t.instant('DASHBOARD.AVG_SCORE'),                                positive: true },
      { icon:'messageCircle', label: t.instant('DASHBOARD.INTERVIEWS'),    value: this.interviews(),     delta: t.instant('DASHBOARD.AMONG_RECENT'),                             positive: true },
      { icon:'star',          label: t.instant('DASHBOARD.ATS_SCORE'),     value: this.atsScore() ?? '—',delta: t.instant('DASHBOARD.RESUME_SCORE'),                             positive: false },
    ];
  });

  totalApps  = signal(0);
  matchRate  = signal(0);
  interviews = signal(0);
  atsScore   = signal<number|null>(null);
  // Derived from the resume fetch we already do — used to make the "no
  // applications yet" empty state contextual instead of one-size-fits-all
  // (see empty-state template block: the reason a new user's list is empty
  // is different from why an active user's is momentarily empty, and a
  // generic message is wrong for at least one of those cases every time).
  hasResume  = computed(() => this.atsScore() !== null);

  dailyPercent = computed(() => {
    const limit = this.user()?.dailyApplyLimit || 20;
    return Math.min(100, Math.round((this.todayApplied() / limit) * 100));
  });

  planLabel = computed(() => {
    const plan = this.user()?.plan || 'free';
    return this.translate.instant('SIDEBAR.PLAN_LABEL', { plan: plan.charAt(0).toUpperCase() + plan.slice(1) });
  });

  private subs: Subscription[] = [];

  constructor(
    private api: ApiService,
    public  auth: AuthService,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // Recent applications + derived stats — refresh every 30s
    const appsPoll = interval(30_000).pipe(startWith(0),
      switchMap(() => this.api.getApplications({ limit: 50 })))
      .subscribe({
        next: (r: any) => {
          const apps = r.data || [];
          this.recentApps.set(apps.slice(0, 6));
          this.totalApps.set(r.meta?.total ?? apps.length);
          this.updateDerivedStats(apps);
          this.loadingApps.set(false);
        },
        error: () => this.loadingApps.set(false),
      });

    const autoSub = interval(30_000).pipe(startWith(0), switchMap(() => this.api.getAutoStatus()))
      .subscribe({ next: (r: any) => this.autoActive.set(r.data?.active ?? false) });

    this.api.getMyResume().subscribe({ next: (r: any) => this.atsScore.set(r.data?.atsScore ?? null), error: () => {} });

    this.subs.push(appsPoll, autoSub);
  }

  private updateDerivedStats(apps: any[]): void {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    this.todayApplied.set(apps.filter(a => a.appliedAt && new Date(a.appliedAt) >= todayStart).length);
    this.interviews.set(apps.filter(a => a.status === 'interview' || a.status === 'offer').length);
    const scored = apps.filter(a => typeof a.matchScore === 'number');
    this.matchRate.set(scored.length ? Math.round(scored.reduce((s,a) => s + a.matchScore, 0) / scored.length) : 0);
  }

  toggleAuto(e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    const call = on ? this.api.startAutomation() : this.api.stopAutomation();
    call.subscribe({
      next: () => {
        this.autoActive.set(on);
        this.toast.success(on ? 'Automation activated' : 'Automation paused');
      },
      error: () => this.toast.error('Failed to toggle automation'),
    });
  }

  toggleWatch(e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    const call = on ? this.api.startWatch() : this.api.stopWatch();
    call.subscribe({
      next: () => {
        this.watchActive.set(on);
        this.toast.success(on ? 'Real-time watcher started' : 'Watcher stopped');
      },
      error: (err: any) => this.toast.error(err.error?.message || 'Failed'),
    });
  }

  runNow(): void {
    this.runningNow.set(true);
    this.api.runAutomationNow().subscribe({
      next: () => {
        this.toast.success('Automation run started');
        setTimeout(() => this.runningNow.set(false), 3000);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message || 'Run failed');
        this.runningNow.set(false);
      },
    });
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }
}
