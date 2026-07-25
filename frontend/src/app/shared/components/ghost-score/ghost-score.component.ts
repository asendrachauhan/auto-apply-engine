import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

/**
 * Displays a job listing's "ghost score" (0-100) — how likely it is to be a
 * real, currently-open role vs. a stale/fake posting. Thresholds mirror the
 * backend ghostJob.service.js: >=70 REAL, 40-69 UNCERTAIN, <40 LIKELY_GHOST.
 */
@Component({
  selector: 'aa-ghost-score',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (score() !== null && score() !== undefined) {
      <div class="ghost-badge" [class]="verdictClass()" (click)="expanded.set(!expanded())">
        <aa-icon [name]="verdictIcon()" [size]="13"/>
        <span>{{ verdictLabel() }}</span>
        <span class="ghost-num">{{ score() }}</span>
      </div>
      @if (expanded()) {
        <div class="ghost-detail neo-sm anim-fade-in">
          <div class="ghost-detail-row">
            <span class="text-muted text-xs">Real-job confidence</span>
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
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: var(--radius-pill);
      font-size: 10px; font-weight: 700; cursor: pointer; width: fit-content;
    }
    .ghost-badge.real       { background: rgba(67,233,123,.14); color: #22863a; }
    .ghost-badge.uncertain  { background: rgba(248,150,30,.14); color: #c05621; }
    .ghost-badge.ghost      { background: rgba(245,87,108,.14); color: #c53030; }
    .ghost-num { opacity: .75; }

    .ghost-detail { margin-top: 6px; padding: 10px; border-radius: 8px; }
    .ghost-detail-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .ghost-detail-row .real      { color: #22863a; }
    .ghost-detail-row .uncertain { color: #c05621; }
    .ghost-detail-row .ghost     { color: #c53030; }
    .ghost-detail-note { line-height: 1.5; margin: 0; }
  `]
})
export class GhostScoreComponent {
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
  verdictLabel = () => ({ real:'Real Job', uncertain:'Uncertain', ghost:'Likely Ghost' } as any)[this.verdict() || ''] || '';
  verdictIcon  = () => ({ real:'checkCircle', uncertain:'alertTriangle', ghost:'xCircle' } as any)[this.verdict() || ''] || 'ghost';
  verdictExplanation = () => ({
    real:      'Recent posting with a clear description and application path — high confidence this role is actively hiring.',
    uncertain: 'Some red flags (old listing, missing salary, or vague description) — worth a closer look before applying.',
    ghost:     'Multiple signals suggest this listing may be stale or not actively hiring. Applied anyway since it matched your criteria.',
  } as any)[this.verdict() || ''] || '';
}
