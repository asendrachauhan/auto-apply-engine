/**
 * Referral Program — shareable code/link, running totals, and reward
 * history. Points are only ever credited when someone you referred makes
 * their first paid plan purchase (see backend webhook handler); they can
 * be redeemed toward your own plan purchase from the Plans page.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-referral',
  standalone: true,
  imports: [CommonModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ 'REFERRAL.TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'REFERRAL.SUBTITLE' | translate }}</p>
      </div>

      @if (loading()) {
        <div class="ref-skeleton neo"></div>
      } @else if (summary()) {
        <!-- Code + link card -->
        <div class="ref-card neo">
          <div class="ref-code-row">
            <div class="ref-code-label">{{ 'REFERRAL.YOUR_CODE' | translate }}</div>
            <div class="ref-code">{{ summary().code }}</div>
          </div>
          <div class="ref-link-row">
            <input class="ref-link-input" [value]="summary().link" readonly (click)="copyText(summary().link)">
            <aa-button variant="secondary" size="sm" icon="copy" (clicked)="copyText(summary().link)">{{ 'COMMON.COPY' | translate }}</aa-button>
          </div>
        </div>

        <!-- Stats -->
        <div class="ref-stats">
          <div class="stat-card neo">
            <aa-icon name="users" [size]="20" class="stat-icon"/>
            <div class="stat-val">{{ summary().referredCount }}</div>
            <div class="stat-lbl">{{ 'REFERRAL.PEOPLE_REFERRED' | translate }}</div>
          </div>
          <div class="stat-card neo">
            <aa-icon name="gift" [size]="20" class="stat-icon"/>
            <div class="stat-val">{{ summary().pointsAvailable }}</div>
            <div class="stat-lbl">{{ 'REFERRAL.POINTS_AVAILABLE' | translate }}</div>
          </div>
          <div class="stat-card neo">
            <aa-icon name="trendingUp" [size]="20" class="stat-icon"/>
            <div class="stat-val">{{ summary().pointsLifetimeEarned }}</div>
            <div class="stat-lbl">{{ 'REFERRAL.LIFETIME_EARNED' | translate }}</div>
          </div>
        </div>

        <div class="ref-note neo-sm">
          <aa-icon name="info" [size]="14"/>
          {{ 'REFERRAL.HOW_IT_WORKS' | translate: { points: pointsPerReferral } }}
        </div>

        <!-- History -->
        <h2 class="section-title">{{ 'REFERRAL.HISTORY' | translate }}</h2>
        @if (history().length === 0) {
          <div class="empty-state neo">
            <div class="empty-title">{{ 'REFERRAL.NO_HISTORY' | translate }}</div>
          </div>
        } @else {
          <div class="history-list">
            @for (h of history(); track h._id) {
              <div class="history-row neo-sm">
                <div class="history-icon" [class.negative]="h.points < 0">
                  <aa-icon [name]="h.points < 0 ? 'currency' : 'gift'" [size]="14"/>
                </div>
                <div class="history-info">
                  <div class="history-title">{{ historyLabel(h) }}</div>
                  <div class="history-date">{{ h.createdAt | date:'mediumDate' }}</div>
                </div>
                <div class="history-points" [class.negative]="h.points < 0">{{ h.points > 0 ? '+' : '' }}{{ h.points }}</div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .ref-skeleton { height: 180px; border-radius: var(--radius); margin-bottom: 24px; }

    .ref-card { padding: 24px; margin-bottom: 20px; }
    .ref-code-row { display:flex; align-items:baseline; gap:12px; margin-bottom:18px; }
    .ref-code-label { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.6px; }
    .ref-code { font-family:var(--font-display); font-size:22px; font-weight:800; color:var(--accent); letter-spacing:1px; }
    .ref-link-row { display:flex; gap:10px; }
    .ref-link-input {
      flex:1; padding:11px 14px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
      border:none; border-radius:10px; box-shadow:var(--neo-inset); font-size:12px; color:var(--text); font-family: var(--font-body); cursor:pointer;
    }

    .ref-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px; }
    @media (max-width:640px){ .ref-stats{ grid-template-columns:1fr; } }
    .stat-card { padding:20px; text-align:center; }
    .stat-icon { color:var(--accent); margin-bottom:8px; }
    .stat-val { font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--text); }
    .stat-lbl { font-size:11px; color:var(--text-muted); font-weight:600; margin-top:4px; }

    .ref-note { display:flex; align-items:center; gap:8px; padding:12px 16px; font-size:12px; color:var(--text-muted); margin-bottom:24px; }

    .section-title { font-family:var(--font-display); font-size:15px; font-weight:700; color:var(--text); margin-bottom:14px; }

    .empty-state { padding: 32px 24px; text-align:center; }
    .empty-title { font-size: 13px; color: var(--text-muted); }

    .history-list { display:flex; flex-direction:column; gap:8px; }
    .history-row { display:flex; align-items:center; gap:12px; padding:12px 14px; }
    .history-icon { width:30px; height:30px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--accent-dim); color:var(--accent); }
    .history-icon.negative { background:rgba(239,68,68,.1); color:#ef4444; }
    .history-info { flex:1; min-width:0; }
    .history-title { font-size:12px; font-weight:600; color:var(--text); }
    .history-date { font-size:10px; color:var(--text-light); margin-top:2px; }
    .history-points { font-family:var(--font-display); font-size:14px; font-weight:800; color:var(--success); }
    .history-points.negative { color:#ef4444; }
  `]
})
export class ReferralComponent implements OnInit {
  loading = signal(true);
  summary = signal<any>(null);
  history = signal<any[]>([]);
  pointsPerReferral = 100;

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.api.getMyReferral().subscribe({
      next: (r: any) => { this.summary.set(r.data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load referral info'); },
    });
    this.api.getReferralHistory({ limit: 20 }).subscribe({
      next: (r: any) => this.history.set(r.data || []),
      error: () => {},
    });
  }

  copyText(text: string): void {
    navigator.clipboard.writeText(text).then(() => this.toast.success('Copied to clipboard'));
  }

  historyLabel(h: any): string {
    if (h.reason === 'first_paid_plan') {
      const name = h.referredUserId?.name || 'A friend';
      return `${name} upgraded to ${h.plan}`;
    }
    if (h.reason === 'redeemed_at_checkout') return `Redeemed at checkout${h.plan ? ' — ' + h.plan + ' plan' : ''}`;
    return 'Manual adjustment';
  }
}
