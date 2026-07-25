/**
 * Admin — customer 360 view for a single user: plan/role editing, resume
 * status, application counts by status, alert count, and referral stats.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-admin-user-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <button class="back-link" (click)="router.navigate(['/admin'])">
        <aa-icon name="chevronLeft" [size]="14"/> {{ 'COMMON.BACK' | translate }}
      </button>

      @if (loading()) {
        <div class="detail-skeleton neo"></div>
      } @else if (detail()) {
        <div class="detail-header neo">
          <div class="detail-avatar">{{ initials() }}</div>
          <div class="detail-headinfo">
            <div class="detail-name">{{ detail().user.name }}</div>
            <div class="detail-email">{{ detail().user.email }}</div>
          </div>
          <span class="plan-chip" [class]="detail().user.plan">{{ detail().user.plan }}</span>
          @if (detail().user.role === 'admin') { <span class="role-chip">{{ 'ADMIN.ROLE_ADMIN' | translate }}</span> }
        </div>

        <div class="detail-grid">
          <div class="detail-card neo">
            <div class="card-title">{{ 'ADMIN.APPLICATIONS_BY_STATUS' | translate }}</div>
            @for (s of statusEntries(); track s[0]) {
              <div class="kv-row"><span>{{ s[0] }}</span><span>{{ s[1] }}</span></div>
            }
            @if (statusEntries().length === 0) { <div class="empty-mini">{{ 'ADMIN.NO_APPLICATIONS' | translate }}</div> }
          </div>

          <div class="detail-card neo">
            <div class="card-title">{{ 'ADMIN.RESUME_STATUS' | translate }}</div>
            @if (detail().resume) {
              <div class="kv-row"><span>{{ 'ADMIN.FILE' | translate }}</span><span>{{ detail().resume.originalFileName }}</span></div>
              <div class="kv-row"><span>{{ 'ADMIN.VERSION' | translate }}</span><span>v{{ detail().resume.version }}</span></div>
            } @else {
              <div class="empty-mini">{{ 'ADMIN.NO_RESUME' | translate }}</div>
            }
            <div class="kv-row"><span>{{ 'ADMIN.TOTAL_ALERTS' | translate }}</span><span>{{ detail().totalAlerts }}</span></div>
          </div>

          <div class="detail-card neo">
            <div class="card-title">{{ 'ADMIN.REFERRAL_STATS' | translate }}</div>
            <div class="kv-row"><span>{{ 'ADMIN.REF_CODE' | translate }}</span><span>{{ detail().referral.code }}</span></div>
            <div class="kv-row"><span>{{ 'ADMIN.REF_POINTS' | translate }}</span><span>{{ detail().referral.points }}</span></div>
            <div class="kv-row"><span>{{ 'ADMIN.REF_COUNT' | translate }}</span><span>{{ detail().referral.referredCount }}</span></div>
            @if (detail().referral.referredBy) {
              <div class="kv-row"><span>{{ 'ADMIN.REFERRED_BY' | translate }}</span><span>{{ detail().referral.referredBy.name }}</span></div>
            }
          </div>
        </div>

        <div class="edit-card neo">
          <div class="card-title">{{ 'ADMIN.EDIT_USER' | translate }}</div>
          <div class="edit-row">
            <label>{{ 'ADMIN.COL_PLAN' | translate }}</label>
            <select class="edit-select" [(ngModel)]="editPlan">
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
          </div>
          <div class="edit-row">
            <label>{{ 'ADMIN.ROLE' | translate }}</label>
            <select class="edit-select" [(ngModel)]="editRole">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <aa-button size="sm" [loading]="saving()" (clicked)="save()">{{ 'COMMON.SAVE' | translate }}</aa-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .back-link { display:flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:12px; font-weight:700; margin-bottom:18px; }
    .back-link:hover { color:var(--accent); }

    .detail-skeleton { height:120px; border-radius:var(--radius); }

    .detail-header { display:flex; align-items:center; gap:14px; padding:20px 24px; margin-bottom:20px; }
    .detail-avatar { width:48px; height:48px; border-radius:50%; background:var(--accent-dim); color:var(--accent); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px; flex-shrink:0; }
    .detail-headinfo { flex:1; min-width:0; }
    .detail-name { font-size:15px; font-weight:800; color:var(--text); }
    .detail-email { font-size:12px; color:var(--text-muted); }
    .plan-chip { padding:4px 12px; border-radius:999px; font-size:10px; font-weight:800; text-transform:uppercase; background:var(--accent-dim); color:var(--accent); }
    .role-chip { padding:4px 12px; border-radius:999px; font-size:10px; font-weight:800; text-transform:uppercase; background:rgba(248,150,30,.15); color:#f8961e; }

    .detail-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px; }
    @media (max-width:900px){ .detail-grid{ grid-template-columns:1fr; } }
    .detail-card { padding:18px; }
    .card-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted); margin-bottom:12px; }
    .kv-row { display:flex; justify-content:space-between; padding:6px 0; font-size:12px; color:var(--text); text-transform:capitalize; }
    .empty-mini { font-size:11px; color:var(--text-light); }

    .edit-card { padding:20px; }
    .edit-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--glass-border); }
    .edit-row label { font-size:12px; font-weight:700; color:var(--text-muted); }
    .edit-select { padding:7px 12px; border:none; border-radius:8px; background:var(--bg); box-shadow:var(--neo-inset); font-size:12px; color:var(--text); font-family:var(--font-body); }
  `]
})
export class AdminUserDetailComponent implements OnInit {
  loading = signal(true);
  detail = signal<any>(null);
  saving = signal(false);
  editPlan = 'free';
  editRole = 'user';

  constructor(private route: ActivatedRoute, public router: Router, private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getAdminUserDetail(id).subscribe({
      next: (r: any) => {
        this.detail.set(r.data);
        this.editPlan = r.data.user.plan;
        this.editRole = r.data.user.role || 'user';
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load user'); },
    });
  }

  initials(): string {
    const n = this.detail()?.user?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  statusEntries(): [string, number][] { return Object.entries(this.detail()?.applicationsByStatus || {}); }

  save(): void {
    const id = this.detail().user._id;
    this.saving.set(true);
    this.api.updateAdminUser(id, { plan: this.editPlan, role: this.editRole }).subscribe({
      next: (r: any) => {
        this.saving.set(false);
        this.detail.set({ ...this.detail(), user: r.data });
        this.toast.success('User updated');
      },
      error: (e: any) => { this.saving.set(false); this.toast.error(e?.error?.message || 'Failed to update user'); },
    });
  }
}
