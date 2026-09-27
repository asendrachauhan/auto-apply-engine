import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type AppStatus = 'applied'|'pending'|'viewed'|'interview'|'offer'|'rejected';

@Component({
  selector: 'aa-status-badge',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `<span class="badge" [class]="status">{{ (labelKey | translate) }}</span>`,
  styles: [`
    .badge {
      padding: 4px 10px; border-radius: var(--radius-pill);
      font-size: 11px; font-weight: 700; letter-spacing: .3px;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .applied   { background: var(--accent-soft-strong); color: var(--accent);  }      .applied::before   { background: var(--accent); }
    .pending   { background: var(--warning-soft);  color: var(--warning-text);       }      .pending::before   { background: var(--warning); }
    .viewed    { background: var(--warning-soft);  color: var(--warning-text);       }      .viewed::before    { background: var(--warning); }
    .interview { background: var(--success-soft);  color: var(--success-text);       }      .interview::before { background: var(--success); }
    .offer     { background: rgba(244,185,66,.14);  color: var(--gold-text);       }      .offer::before     { background: var(--gold); }
    .rejected  { background: var(--danger-soft);  color: var(--danger-text);       }      .rejected::before  { background: var(--danger); }
  `]
})
export class StatusBadgeComponent {
  @Input() status: AppStatus = 'applied';
  get labelKey(): string {
    return 'JOBS.' + (this.status || 'applied').toUpperCase();
  }
}
