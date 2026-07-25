import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-automation',
  standalone: true,
  imports: [CommonModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">{{ 'AUTOMATION.TITLE' | translate }}</h1>
          <p class="page-subtitle">{{ 'AUTOMATION.SUBTITLE' | translate }}</p>
        </div>
        <aa-button [loading]="running()" (clicked)="runNow()" icon="play">{{ 'AUTOMATION.RUN_NOW' | translate }}</aa-button>
      </div>

      <div class="grid-2">
        <!-- Session stats -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="trendingUp" [size]="16"/> {{ 'AUTOMATION.LAST_SESSION' | translate }}</div>
          @if (lastSession()) {
            <div class="stats-mini grid-3">
              <div class="stat-mini neo-sm">
                <div class="stat-m-val">{{ lastSession().stats?.jobsFound || 0 }}</div>
                <div class="stat-m-lbl">{{ 'AUTOMATION.FOUND' | translate }}</div>
              </div>
              <div class="stat-mini neo-sm">
                <div class="stat-m-val text-accent">{{ lastSession().stats?.jobsMatched || 0 }}</div>
                <div class="stat-m-lbl">{{ 'AUTOMATION.MATCHED' | translate }}</div>
              </div>
              <div class="stat-mini neo-sm">
                <div class="stat-m-val text-success">{{ lastSession().stats?.applicationsSent || 0 }}</div>
                <div class="stat-m-lbl">{{ 'AUTOMATION.APPLIED' | translate }}</div>
              </div>
            </div>
            <div class="session-meta">
              {{ 'AUTOMATION.STATUS' | translate }}: <strong>{{ lastSession().status }}</strong> ·
              {{ 'AUTOMATION.DURATION' | translate }}: <strong>{{ duration(lastSession()) }}</strong>
            </div>
          } @else {
            <div class="text-muted text-sm" style="padding:20px 0;text-align:center;">{{ 'AUTOMATION.NO_SESSIONS' | translate }}</div>
          }
        </div>

        <!-- Session history -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="clock" [size]="16"/> {{ 'AUTOMATION.HISTORY' | translate }}</div>
          <div class="history-list">
            @for (s of history(); track s._id) {
              <div class="history-row">
                <div class="h-status" [class]="s.status">{{ s.status }}</div>
                <div class="h-stats">{{ s.stats?.applicationsSent || 0 }} {{ 'AUTOMATION.APPLIED' | translate }}</div>
                <div class="h-time text-muted text-xs">{{ formatDate(s.startedAt) }}</div>
              </div>
            }
            @if (history().length === 0) {
              <div class="text-muted text-sm">{{ 'AUTOMATION.NO_HISTORY' | translate }}</div>
            }
          </div>
        </div>
      </div>

      <!-- Step progress -->
      <div class="section-card">
        <div class="section-title d-flex align-center gap-8">
          <aa-icon name="refresh" [size]="16"/> {{ 'AUTOMATION.CURRENT_STATUS' | translate }}:
          <span class="run-status" [class]="runStatus()">{{ runStatus() }}</span>
        </div>
        <div class="steps-grid">
          @for (step of steps; track step.labelKey) {
            <div class="step-card neo-sm" [class]="step.status">
              <aa-icon [name]="step.icon" [size]="22" class="step-icon"/>
              <div class="step-label">{{ step.labelKey | translate }}</div>
              <div class="step-status-badge" [class]="step.status">{{ step.status }}</div>
            </div>
          }
        </div>
        <p class="text-muted text-xs mt-16" *ngIf="running()">
          {{ 'AUTOMATION.STEP_TRACKER_MSG' | translate }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .stats-mini { margin-bottom: 12px; }
    .stat-mini  { padding: 14px; text-align: center; }
    .stat-m-val { font-family: var(--font-display); font-size: 26px; font-weight: 800; color: var(--text); line-height: 1; }
    .stat-m-lbl { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
    .session-meta { font-size: 12px; color: var(--text-muted); padding-top: 12px; border-top: 1px solid rgba(163,177,198,.2); }

    .history-list { display: flex; flex-direction: column; gap: 6px; }
    .history-row  { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(163,177,198,.12); }
    .h-status     { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
    .h-status.completed { background: rgba(67,233,123,.14); color: #22863a; }
    .h-status.failed    { background: rgba(245,87,108,.14); color: #c53030; }
    .h-status.running   { background: rgba(108,99,255,.14); color: var(--accent); }
    .h-stats  { flex: 1; font-size: 12px; font-weight: 600; color: var(--text); }
    .h-time   { flex-shrink: 0; }

    .run-status  { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 8px; margin-left: 4px; }
    .run-status.Idle      { background: rgba(163,177,198,.2); color: var(--text-muted); }
    .run-status.Running   { background: rgba(108,99,255,.14); color: var(--accent); }
    .run-status.Completed { background: rgba(67,233,123,.14); color: #22863a; }

    .steps-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 12px; }
    @media(max-width:700px){ .steps-grid{ grid-template-columns:repeat(2,1fr); } }
    .step-card  { padding: 16px 12px; text-align: center; transition: all .3s; display: flex; flex-direction: column; align-items: center; }
    .step-card.pending { opacity: .4; }
    .step-card.running { box-shadow: var(--neo-inset); }
    .step-icon  { color: var(--text-muted); margin-bottom: 8px; }
    .step-card.running .step-icon,
    .step-card.done .step-icon { color: var(--accent); }
    .step-label { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
    .step-status-badge { font-size: 10px; font-weight: 700; }
    .step-status-badge.pending { color: var(--text-light); }
    .step-status-badge.running { color: var(--accent); }
    .step-status-badge.done    { color: var(--success); }
  `]
})
export class AutomationComponent implements OnInit, OnDestroy {
  lastSession = signal<any>(null);
  history     = signal<any[]>([]);
  running     = signal(false);
  runStatus   = signal('Idle');

  steps = [
    { icon:'search',        labelKey:'AUTOMATION.SEARCH_JOBS',    status:'pending' },
    { icon:'sparkles',      labelKey:'AUTOMATION.AI_MATCH',       status:'pending' },
    { icon:'fileEdit',      labelKey:'AUTOMATION.COVER_LETTERS',  status:'pending' },
    { icon:'send',          labelKey:'AUTOMATION.APPLY_STEP',     status:'pending' },
    { icon:'messageCircle', labelKey:'AUTOMATION.NOTIFY',         status:'pending' },
  ];

  private subs: Subscription[] = [];

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    const poll = interval(10_000).pipe(startWith(0), switchMap(() => this.api.getAutoStatus()))
      .subscribe({ next: (r: any) => {
        this.lastSession.set(r.data?.lastSession);
        if (r.data?.lastSession?.status === 'running') this.runStatus.set('Running');
        else if (r.data?.lastSession?.status === 'completed') this.runStatus.set('Completed');
      }});
    const hist = this.api.getAutoHistory().subscribe({ next: (r: any) => this.history.set((r.data || []).slice(0,10)) });
    this.subs.push(poll, hist);
  }

  runNow(): void {
    this.running.set(true);
    this.runStatus.set('Running');
    this.api.runAutomationNow().subscribe({
      next: () => {
        this.toast.success('Automation run started — this can take a few minutes');
        this.animateSteps();
        setTimeout(() => this.running.set(false), 3000);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message || 'Run failed');
        this.running.set(false);
        this.runStatus.set('Idle');
      },
    });
  }

  /** Visual progress indicator for the pipeline stages while a run is
   *  in flight — the backend runs this asynchronously and doesn't stream
   *  per-step events, so real numbers land via the status/history polls above. */
  private animateSteps(): void {
    this.steps.forEach(s => s.status = 'pending');
    this.steps.forEach((s,i) => {
      setTimeout(() => s.status = 'running', i * 2000);
      setTimeout(() => s.status = 'done',    i * 2000 + 1800);
    });
  }

  duration(s: any): string {
    if (!s?.durationMs) return '—';
    return s.durationMs > 60000 ? `${Math.round(s.durationMs/60000)}m` : `${Math.round(s.durationMs/1000)}s`;
  }

  formatDate(d: string): string {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff/3600000);
    return h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }
}
