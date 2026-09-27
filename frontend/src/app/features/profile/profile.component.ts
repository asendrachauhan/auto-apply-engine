import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PasswordRequirementsComponent } from '../../shared/components/password-requirements/password-requirements.component';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'aa-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, NeoButtonComponent, IconComponent, PasswordRequirementsComponent],
  template: `
    <div class="page-container">
      <div class="mb-16">
        <a routerLink="/settings" class="back-link">
          <aa-icon name="chevronLeft" [size]="14"/>
          <span>{{ 'SETTINGS.TITLE' | translate }}</span>
        </a>
      </div>

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
                <button type="button" class="resend-link" [disabled]="resendingVerification()" (click)="resendVerification()">
                  {{ (resendingVerification() ? 'PROFILE.SENDING' : 'PROFILE.RESEND_VERIFICATION') | translate }}
                </button>
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
              <aa-password-requirements [password]="newPassword" #pwdReq/>
            </div>
            <aa-button variant="secondary" [loading]="savingPassword()" [disabled]="newPassword.length > 0 && !pwdReq.isValid()" (clicked)="changePassword()" icon="refresh">
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

          <!-- Active Sessions -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="monitor" [size]="16"/> {{ 'PROFILE.ACTIVE_SESSIONS' | translate }}</div>
            @if (sessionsLoading()) {
              <div class="row-skeleton neo"></div>
            } @else if (sessions().length === 0) {
              <p class="text-sm text-muted">{{ 'PROFILE.NO_SESSIONS' | translate }}</p>
            } @else {
              <div class="session-list">
                @for (s of sessions(); track s.id) {
                  <div class="session-row">
                    <aa-icon name="monitor" [size]="18" class="session-icon"/>
                    <div class="session-info">
                      <div class="session-device">
                        {{ s.userAgent }}
                        @if (s.current) { <span class="session-current-tag">{{ 'PROFILE.THIS_DEVICE' | translate }}</span> }
                      </div>
                      <div class="text-muted text-sm">{{ 'PROFILE.LAST_ACTIVE' | translate }} {{ s.lastUsedAt | date:'medium' }}</div>
                    </div>
                    @if (!s.current) {
                      <aa-button variant="ghost" size="sm" [loading]="revokingId() === s.id" (clicked)="revokeSession(s.id)">{{ 'PROFILE.REVOKE' | translate }}</aa-button>
                    }
                  </div>
                }
              </div>
              @if (sessions().length > 1) {
                <aa-button variant="secondary" size="sm" [loading]="loggingOutAll()" (clicked)="logoutAllOtherDevices()" icon="logOut">
                  {{ 'PROFILE.LOG_OUT_OTHER_DEVICES' | translate }}
                </aa-button>
              }
            }
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
    .breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); text-decoration: none; padding: 5px 10px; border-radius: 8px; background: var(--surface-subtle); border: 1px solid var(--glass-border); transition: all .2s; }
    .back-link:hover { background: var(--surface-hover); color: var(--text); }
    .breadcrumb-sep { color: var(--text-muted); }
    .breadcrumb-current { color: var(--text); font-weight: 600; }

    .profile-avatar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .big-avatar { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg,var(--accent),var(--accent-secondary)); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:20px; flex-shrink:0; }
    .verified-badge   { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--success); font-weight:600; margin-top:4px; }
    .unverified-badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--warning); font-weight:600; margin-top:4px; }
    .resend-link { background:none; border:none; color:var(--accent); font-size:11px; font-weight:700; cursor:pointer; padding:0; margin-top:4px; margin-left:8px; text-decoration:underline; }
    .resend-link:disabled { opacity:0.5; cursor:default; }
    .resend-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    .field-group { margin-bottom: 14px; }
    .field-label { display:block; font-size:12px; font-weight:600; color:var(--text); margin-bottom:6px; }
    .field-hint  { font-size:11px; color:var(--text-muted); margin-top:4px; }
    .neo-input {
      width:100%; padding:10px 14px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border:none;
      border-radius:var(--radius-sm); box-shadow:var(--neo-inset);
      font-size:13px; color:var(--text); outline:none; box-sizing:border-box;
    }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px var(--accent-dim); }

    .info-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--divider); }
    .info-row:last-child { border-bottom:none; }

    .session-list { display:flex; flex-direction:column; gap:4px; margin-bottom:14px; }
    .session-row { display:flex; align-items:center; gap:12px; padding:14px 10px; border:1px solid transparent; border-bottom-color:var(--divider); border-radius:10px; transition:background var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out); }
    .session-row:hover { background:var(--surface-hover); border-color:var(--glass-border); }
    .session-row:last-child { border-bottom:none; }
    .session-icon { color:var(--text-light); flex-shrink:0; }
    .session-info { flex:1; min-width:0; }
    .session-device { font-size:13px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; min-width:0; }
    .session-device { overflow-wrap:anywhere; }
    .session-current-tag { flex-shrink:0; font-size:10px; font-weight:800; text-transform:uppercase; color:var(--accent); background:var(--accent-dim); padding:2px 8px; border-radius:999px; }
    .row-skeleton { height:72px; border-radius:var(--radius-sm); }

    .danger-zone { border: 1px solid var(--danger-soft); }
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
  resendingVerification = signal(false);
  deleting       = signal(false);

  sessions        = signal<any[]>([]);
  sessionsLoading = signal(true);
  revokingId      = signal<string | null>(null);
  loggingOutAll   = signal(false);

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
    this.loadSessions();
  }

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.auth.getSessions().subscribe({
      next: (r: any) => { this.sessions.set(r.data || []); this.sessionsLoading.set(false); },
      error: () => { this.sessionsLoading.set(false); },
    });
  }

  revokeSession(id: string): void {
    this.revokingId.set(id);
    this.auth.revokeSession(id).subscribe({
      next: () => {
        this.sessions.update(list => list.filter(s => s.id !== id));
        this.revokingId.set(null);
        this.toast.success(this.translate.instant('PROFILE.SESSION_REVOKED'));
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || this.translate.instant('PROFILE.REVOKE_FAILED'));
        this.revokingId.set(null);
      },
    });
  }

  logoutAllOtherDevices(): void {
    const others = this.sessions().filter(s => !s.current);
    if (others.length === 0) return;
    this.loggingOutAll.set(true);
    // Revokes every non-current session individually via the same
    // endpoint the per-row "Revoke" button uses — keeps the current
    // device logged in, unlike logoutAllDevices() (used elsewhere for the
    // "I lost my phone" case), which deliberately clears every session
    // including the current one and forces a fresh login everywhere.
    Promise.all(others.map(s => firstValueFrom(this.auth.revokeSession(s.id)).catch(() => null)))
      .then(() => {
        this.sessions.update(list => list.filter(s => s.current));
        this.loggingOutAll.set(false);
        this.toast.success(this.translate.instant('PROFILE.OTHER_DEVICES_LOGGED_OUT'));
      });
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

  resendVerification(): void {
    this.resendingVerification.set(true);
    this.auth.resendVerification().subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROFILE.VERIFICATION_SENT'));
        this.resendingVerification.set(false);
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || this.translate.instant('PROFILE.RESEND_FAILED'));
        this.resendingVerification.set(false);
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
