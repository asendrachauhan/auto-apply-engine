import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AppStatus = 'applied'|'pending'|'viewed'|'interview'|'offer'|'rejected';

@Component({
  selector: 'aa-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="badge" [class]="status">{{ label }}</span>`,
  styles: [`
    .badge {
      padding: 4px 10px; border-radius: var(--radius-pill);
      font-size: 11px; font-weight: 700; letter-spacing: .3px;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .applied   { background: rgba(108,99,255,.14); color: var(--accent);  }      .applied::before   { background: var(--accent); }
    .pending   { background: rgba(248,150,30,.14);  color: #c05621;       }      .pending::before   { background: #f8961e; }
    .viewed    { background: rgba(248,150,30,.14);  color: #9c6919;       }      .viewed::before    { background: #f8961e; }
    .interview { background: rgba(67,233,123,.14);  color: #22863a;       }      .interview::before { background: var(--success); }
    .offer     { background: rgba(244,185,66,.14);  color: #975a16;       }      .offer::before     { background: #f4b942; }
    .rejected  { background: rgba(245,87,108,.14);  color: #c53030;       }      .rejected::before  { background: var(--danger); }
  `]
})
export class StatusBadgeComponent {
  @Input() status: AppStatus = 'applied';
  readonly labels: Record<AppStatus, string> = {
    applied: 'Applied', pending: 'Pending', viewed: 'Viewed',
    interview: 'Interview', offer: 'Offer', rejected: 'Rejected',
  };
  get label(): string { return this.labels[this.status] || this.status; }
}
