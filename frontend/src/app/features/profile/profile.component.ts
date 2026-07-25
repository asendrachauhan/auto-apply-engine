import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ 'PROFILE.PAGE_TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'PROFILE.PAGE_SUBTITLE' | translate }}</p>
      </div>

      <div class="grid-2">
        <!-- Identity -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="users" [size]="16"/> {{ 'PROFILE.IDENTITY' | translate }}</div>
          <div class="profile-avatar-row">
            <div class="big-avatar">{{ initials() }}</div>
            <div>
              <div class="fw-700" style="font-size:16px;color:var(--text);">{{ user()?.name }}</div>
              <div class="text-muted text-sm">{{ user()?.email }}</div>
              @if (user()?.emailVerified) {
                <span class="verified-badge"><aa-icon name="checkCircle" [size]="11"/> {{ 'PROFILE.VERIFIED' | translate }}</span>
              } @else {
                <span class="unverified-badge"><aa-icon name="alertTriangle" [size]="11"/> {{ 'PROFILE.NOT_VERIFIED' | translate }}</span>
              }
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">{{ 'PROFILE.FULL_NAME' | translate }}</label>
            <input class="neo-input" [(ngModel)]="nameField">
          </div>
          <div class="field-group">
            <label class="field-label">{{ 'PROFILE.LINKEDIN_URL' | translate }}</label>
            <input class="neo-input" [(ngModel)]="linkedinField" placeholder="https://linkedin.com/in/you">
          </div>
          <div class="field-group">
            <label class="field-label">{{ 'PROFILE.GITHUB_URL' | translate }}</label>
            <input class="neo-input" [(ngModel)]="githubField" placeholder="https://github.com/you">
          </div>
          <div class="field-group">
            <label class="field-label">{{ 'PROFILE.PORTFOLIO_URL' | translate }}</label>
            <input class="neo-input" [(ngModel)]="portfolioField" placeholder="https://yoursite.com">
          </div>
          <aa-button [loading]="savingProfile()" (clicked)="saveProfile()" icon="checkCircle">{{ 'PROFILE.SAVE_CHANGES' | translate }}</aa-button>
        </div>

        <div>
          <!-- Password -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="shield" [size]="16"/> {{ 'PROFILE.CHANGE_PASSWORD' | translate }}</div>
            <div class="field-group">
              <label class="field-label">{{ 'PROFILE.CURRENT_PASSWORD' | translate }}</label>
              <input type="password" class="neo-input" [(ngModel)]="currentPassword">
            </div>
            <div class="field-group">
              <label class="field-label">{{ 'PROFILE.NEW_PASSWORD' | translate }}</label>
              <input type="password" class="neo-input" [(ngModel)]="newPassword">
              <div class="field-hint">{{ 'PROFILE.PASSWORD_HINT' | translate }}</div>
            </div>
            <aa-button variant="secondary" [loading]="savingPassword()" (clicked)="changePassword()" icon="refresh">
              {{ 'PROFILE.UPDATE_PASSWORD' | translate }}
            </aa-button>
          </div>

          <!-- Account info -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="info" [size]="16"/> {{ 'PROFILE.ACCOUNT' | translate }}</div>
            <div class="info-row"><span class="text-muted text-sm">{{ 'PROFILE.PLAN' | translate }}</span><span class="fw-700">{{ planLabel() }}</span></div>
            <div class="info-row"><span class="text-muted text-sm">{{ 'PROFILE.DAILY_APPLY_LIMIT' | translate }}</span><span class="fw-700">{{ user()?.dailyApplyLimit }}/day</span></div>
            <div class="info-row"><span class="text-muted text-sm">{{ 'PROFILE.MEMBER_SINCE' | translate }}</span><span class="fw-700">{{ memberSince() }}</span></div>
          </div>

          <!-- Danger zone -->
          <div class="section-card danger-zone">
            <div class="section-title text-danger"><aa-icon name="alertTriangle" [size]="16"/> {{ 'PROFILE.DANGER_ZONE' | translate }}</div>
            <p class="text-sm text-muted mb-16">
              {{ 'PROFILE.DANGER_DESC' | translate }}
            </p>
            @if (!confirmingDelete()) {
              <aa-button variant="danger" size="sm" (clicked)="confirmingDelete.set(true)" icon="trash">{{ 'PROFILE.DELETE_ACCOUNT' | translate }}</aa-button>
            } @else {
              <div class="field-group">
                <label class="field-label">{{ 'PROFILE.ENTER_PASSWORD_CONFIRM' | translate }}</label>
                <input type="password" class="neo-input" [(ngModel)]="deletePassword">
              </div>
              <div class="d-flex gap-8">
                <aa-button variant="danger" size="sm" [loading]="deleting()" (clicked)="deleteAccount()">{{ 'PROFILE.CONFIRM_DELETE_BTN' | translate }}</aa-button>
                <aa-button variant="secondary" size="sm" (clicked)="confirmingDelete.set(false)">{{ 'COMMON.CANCEL' | translate }}</aa-button>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-avatar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .big-avatar { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg,var(--accent),#a855f7); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:20px; flex-shrink:0; }
    .verified-badge   { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--success); font-weight:600; margin-top:4px; }
    .unverified-badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--warning); font-weight:600; margin-top:4px; }

    .field-group { margin-bottom: 14px; }
    .field-label { display:block; font-size:12px; font-weight:600; color:var(--text); margin-bottom:6px; }
    .field-hint  { font-size:11px; color:var(--text-muted); margin-top:4px; }
    .neo-input {
      width:100%; padding:10px 14px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border:none;
      border-radius:var(--radius-sm); box-shadow:var(--neo-inset);
      font-size:13px; color:var(--text); outline:none; box-sizing:border-box;
    }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px var(--accent-dim); }

    .info-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(163,177,198,.15); }
    .info-row:last-child { border-bottom:none; }

    .danger-zone { border: 1px solid rgba(245,87,108,.25); }
    .text-danger { color: var(--danger); }
    .mb-16 { margin-bottom: 16px; }
  `]
})
export class ProfileComponent implements OnInit {
  nameField=''; linkedinField=''; githubField=''; portfolioField='';
  currentPassword=''; newPassword='';
  deletePassword=''; confirmingDelete = signal(false);

  savingProfile  = signal(false);
  savingPassword = signal(false);
  deleting       = signal(false);

  user = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const n = this.user()?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2);
  });
  planLabel = computed(() => {
    const p = this.user()?.plan || 'free';
    return p === 'free'
      ? this.translate.instant('COMMON.FREE')
      : p.charAt(0).toUpperCase() + p.slice(1);
  });
  memberSince = computed(() => {
    const d = this.user()?.createdAt;
    return d ? new Date(d).toLocaleDateString(undefined, { month:'long', year:'numeric' }) : '—';
  });

  constructor(
    public auth: AuthService,
    private toast: ToastService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    const u = this.user();
    this.nameField      = u?.name || '';
    this.linkedinField   = u?.linkedinUrl || '';
    this.githubField     = u?.githubUrl || '';
    this.portfolioField  = u?.portfolioUrl || '';
  }

  saveProfile(): void {
    if (!this.nameField.trim()) {
      this.toast.error(this.translate.instant('PROFILE.NAME_REQUIRED'));
      return;
    }
    this.savingProfile.set(true);
    this.auth.updateProfile({
      name: this.nameField, linkedinUrl: this.linkedinField,
      githubUrl: this.githubField, portfolioUrl: this.portfolioField,
    }).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROFILE.PROFILE_UPDATED'));
        this.savingProfile.set(false);
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || this.translate.instant('PROFILE.UPDATE_FAILED'));
        this.savingProfile.set(false);
      },
    });
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword) {
      this.toast.error(this.translate.instant('PROFILE.FILL_BOTH_PASSWORDS'));
      return;
    }
    this.savingPassword.set(true);
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROFILE.PASSWORD_CHANGED'));
        this.currentPassword = ''; this.newPassword = '';
        this.savingPassword.set(false);
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || this.translate.instant('PROFILE.CHANGE_FAILED'));
        this.savingPassword.set(false);
      },
    });
  }

  deleteAccount(): void {
    if (!this.deletePassword) {
      this.toast.error(this.translate.instant('PROFILE.ENTER_PASSWORD'));
      return;
    }
    this.deleting.set(true);
    this.auth.deleteAccount(this.deletePassword).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROFILE.DELETION_SCHEDULED'));
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || this.translate.instant('PROFILE.DELETION_FAILED'));
        this.deleting.set(false);
      },
    });
  }
}
