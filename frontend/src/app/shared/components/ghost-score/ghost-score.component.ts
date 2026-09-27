import { Component, Input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';

/**
 * Displays a job listing's "ghost score" (0-100) — how likely it is to be a
 * real, currently-open role vs. a stale/fake posting. Thresholds mirror the
 * backend ghostJob.service.js: >=70 REAL, 40-69 UNCERTAIN, <40 LIKELY_GHOST.
 */
@Component({
  selector: 'aa-ghost-score',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  template: `
    @if (score() !== null && score() !== undefined) {
      <button type="button" class="ghost-badge" [class]="verdictClass()"
        (click)="expanded.set(!expanded())"
        [aaTooltip]="tooltipText()"
        [attr.aria-expanded]="expanded()"
        [attr.aria-label]="verdictLabel() + ', score ' + score() + ' out of 100. Press to ' + (expanded() ? 'hide' : 'show') + ' details'">
        <aa-icon [name]="verdictIcon()" [size]="13"/>
        <span>{{ verdictLabel() }}</span>
        <span class="ghost-num">{{ score() }}</span>
      </button>
      @if (expanded()) {
        <div class="ghost-detail neo-sm anim-fade-in" role="region" [attr.aria-label]="verdictLabel() + ' details'">
          <div class="ghost-detail-row">
            <span class="text-muted text-xs">{{ confidenceLabel() }}</span>
            <span class="fw-700" [class]="verdictClass()">{{ score() }}/100</span>
          </div>
          <p class="ghost-detail-note text-xs text-muted">
            {{ verdictExplanation() }}
          </p>
        </div>
      }
    }
  `,
  styles: [`
    .ghost-badge {
      font-family: inherit;
      border: none;
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: var(--radius-pill);
      font-size: 10px; font-weight: 700; cursor: pointer; width: fit-content;
    }
    .ghost-badge:focus-visible {
      outline: 2px solid var(--accent, var(--accent)); outline-offset: 2px;
    }
    .ghost-badge.real       { background: var(--success-soft); color: var(--success-text); }
    .ghost-badge.uncertain  { background: var(--warning-soft); color: var(--warning-text); }
    .ghost-badge.ghost      { background: var(--danger-soft); color: var(--danger-text); }
    .ghost-num { opacity: .75; }

    .ghost-detail { margin-top: 6px; padding: 10px; border-radius: 8px; }
    .ghost-detail-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .ghost-detail-row .real      { color: var(--success-text); }
    .ghost-detail-row .uncertain { color: var(--warning-text); }
    .ghost-detail-row .ghost     { color: var(--danger-text); }
    .ghost-detail-note { line-height: 1.5; margin: 0; }
  `]
})
export class GhostScoreComponent {
  private translate = inject(TranslateService, { optional: true });

  @Input() set ghostScore(v: number | null | undefined) { this._score.set(v ?? null); }
  private _score = signal<number | null>(null);
  score = this._score.asReadonly();
  expanded = signal(false);

  verdict = computed(() => {
    const s = this.score();
    if (s === null) return null;
    if (s >= 70) return 'real';
    if (s >= 40) return 'uncertain';
    return 'ghost';
  });

  verdictClass = () => this.verdict() || '';

  verdictLabel = computed(() => {
    const v = this.verdict();
    if (!v) return '';
    if (v === 'real') return this.translate?.instant('ALERTS.GHOST_REAL_TITLE') || 'Real Job';
    if (v === 'uncertain') return this.translate?.instant('ALERTS.GHOST_UNCERTAIN_TITLE') || 'Uncertain';
    return this.translate?.instant('ALERTS.GHOST_LIKELY_TITLE') || 'Likely Ghost';
  });

  verdictIcon = () => ({ real:'checkCircle', uncertain:'alertTriangle', ghost:'xCircle' } as any)[this.verdict() || ''] || 'ghost';

  tooltipText = computed(() => {
    const s = this.score() ?? 0;
    const v = this.verdict();
    if (v === 'real') {
      return `Real Job (${s}/100): Active listing with verified employer, recent posting date, and authentic job requirements.`;
    }
    if (v === 'uncertain') {
      return `Uncertain (${s}/100): Moderate risk — listing has limited compensation details, may be reposted, or has a vague description.`;
    }
    return `Likely Ghost (${s}/100): High risk — posted >30 days ago, lacks salary transparency, or matches known repetitive posting patterns.`;
  });

  confidenceLabel = computed(() => this.translate?.instant('ALERTS.GHOST_CONFIDENCE_LABEL') || 'Real-job confidence');

  verdictExplanation = computed(() => {
    const v = this.verdict();
    if (v === 'real') {
      return 'Recent verified posting with clear company requirements — high confidence this role is actively hiring.';
    }
    if (v === 'uncertain') {
      return 'Some cautionary signals detected (unspecified compensation, reposted vacancy, or generic requirements). Worth reviewing before applying.';
    }
    return 'Multiple ghost-job indicators detected: listing is either stale (>30-45 days), lacks salary transparency, or has repetitive posting signals indicating inactive recruitment.';
  });
}
