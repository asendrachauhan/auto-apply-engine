import { Component, signal, computed, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export type OnboardingStepId = 'welcome' | 'verify' | 'resume' | 'preferences' | 'notifications' | 'finish';

@Component({
  selector: 'aa-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, NeoButtonComponent, IconComponent, TranslateModule],
  template: `
    <div class="onboard-page">
      <div class="onboard-card neo anim-fade-in">
        <!-- Progress bar -->
        <div class="progress-bar">
          @for (s of steps(); track s; let idx = $index) {
            <div class="progress-dot" [class.done]="currentStepIndex() > idx" [class.active]="currentStepIndex() === idx"></div>
          }
        </div>

        <div class="step-num">{{ 'ONBOARDING.STEP_OF' | translate:{current: currentStepIndex() + 1, total: steps().length} }}</div>

        <!-- Step: Welcome -->
        @if (currentStep() === 'welcome') {
          <div class="step-content anim-fade-in">
            <aa-icon name="sparkles" [size]="40" class="step-icon-svg"/>
            <h2>{{ 'ONBOARDING.WELCOME_TITLE' | translate }}</h2>
            <p>{{ 'ONBOARDING.WELCOME_SUBTITLE' | translate }}</p>
            <div class="feature-list">
              @for (f of welcomeFeatures; track f) {
                <div class="feature-row"><aa-icon name="check" [size]="14"/> {{ f | translate }}</div>
              }
            </div>
          </div>
        }

        <!-- Step: Verify Email (Enforced before Resume Upload) -->
        @if (currentStep() === 'verify') {
          <div class="step-content anim-fade-in text-center">
            <div class="verify-icon-wrap" [class.verified]="isEmailVerified()">
              <aa-icon [name]="isEmailVerified() ? 'checkCircle' : 'mail'" [size]="44" class="verify-icon-svg"/>
            </div>

            @if (!isEmailVerified()) {
              <h2>{{ 'ONBOARDING.VERIFY_EMAIL_TITLE' | translate }}</h2>
              <p class="verify-desc">{{ 'ONBOARDING.VERIFY_EMAIL_SUBTITLE' | translate }}</p>

              <div class="email-badge-card neo-inset">
                <div class="email-badge-left">
                  <aa-icon name="mail" [size]="16" class="text-accent"/>
                  <span class="user-email-text">{{ auth.currentUser()?.email }}</span>
                </div>
                <span class="status-pill pending">{{ 'ONBOARDING.VERIFY_EMAIL_PENDING' | translate }}</span>
              </div>

              <div class="verify-actions">
                <aa-button
                  [fullWidth]="true"
                  (clicked)="checkVerification(true)"
                  [loading]="checkingVerification()"
                  icon="checkCircle">
                  {{ 'ONBOARDING.VERIFY_EMAIL_CHECK_BTN' | translate }}
                </aa-button>

                <aa-button
                  variant="secondary"
                  [fullWidth]="true"
                  (clicked)="resendVerification()"
                  [loading]="resendingVerification()"
                  [disabled]="resendCooldown() > 0"
                  icon="send">
                  @if (resendCooldown() > 0) {
                    {{ 'ONBOARDING.VERIFY_EMAIL_COOLDOWN' | translate:{ seconds: resendCooldown() } }}
                  } @else {
                    {{ 'ONBOARDING.VERIFY_EMAIL_RESEND_BTN' | translate }}
                  }
                </aa-button>
              </div>

              <div class="verify-help-box">
                <aa-icon name="info" [size]="14"/>
                <span>{{ 'ONBOARDING.VERIFY_EMAIL_HINT' | translate }}</span>
              </div>
            } @else {
              <h2>{{ 'ONBOARDING.VERIFY_EMAIL_SUCCESS_TITLE' | translate }}</h2>
              <p class="text-success fw-600 mb-20">{{ 'ONBOARDING.VERIFY_EMAIL_SUCCESS_DESC' | translate }}</p>

              <aa-button
                [fullWidth]="true"
                (clicked)="goToStep('resume')"
                iconRight="chevronRight">
                {{ 'ONBOARDING.VERIFY_EMAIL_CONTINUE_TO_RESUME' | translate }}
              </aa-button>
            }
          </div>
        }

        <!-- Step: Resume -->
        @if (currentStep() === 'resume') {
          <div class="step-content anim-fade-in">
            <aa-icon name="resume" [size]="40" class="step-icon-svg"/>
            <h2>{{ 'ONBOARDING.RESUME_TITLE' | translate }}</h2>
            <p>{{ 'ONBOARDING.RESUME_SUBTITLE' | translate }}</p>
            <button type="button" class="upload-zone neo-inset" (click)="fileInput.click()" [class.has-file]="uploaded()" [attr.aria-label]="'ONBOARDING.DROP_FILE' | translate">
              @if (uploading()) {
                <div class="text-muted">{{ 'ONBOARDING.PARSING' | translate }}</div>
              } @else if (!uploaded()) {
                <div><aa-icon name="upload" [size]="20"/> {{ 'ONBOARDING.DROP_FILE' | translate }}</div>
                <div class="text-muted text-sm mt-8">{{ 'ONBOARDING.PASTE_TEXT_HINT' | translate }}</div>
              } @else {
                <div class="text-success fw-700"><aa-icon name="checkCircle" [size]="16"/> {{ 'ONBOARDING.RESUME_PARSED' | translate }}</div>
              }
            </button>
            <input #fileInput type="file" accept=".pdf,.doc,.docx,.txt" style="display:none" (change)="onFile($event)">
            <textarea class="neo-input mt-16" rows="6" [(ngModel)]="resumeText"
              [placeholder]="'ONBOARDING.PASTE_TEXT_PLACEHOLDER' | translate"></textarea>
          </div>
        }

        <!-- Step: Preferences -->
        @if (currentStep() === 'preferences') {
          <div class="step-content anim-fade-in">
            <aa-icon name="target" [size]="40" class="step-icon-svg"/>
            <h2>{{ 'ONBOARDING.PREFERENCES_TITLE' | translate }}</h2>
            <div class="input-group">
              <label class="input-label">{{ 'ONBOARDING.TARGET_ROLES' | translate }}</label>
              <input class="neo-input" [(ngModel)]="prefs.titles" [placeholder]="'ONBOARDING.TARGET_ROLES_PLACEHOLDER' | translate">
            </div>
            <div class="input-group">
              <label class="input-label">{{ 'ONBOARDING.LOCATIONS' | translate }}</label>
              <input class="neo-input" [(ngModel)]="prefs.locations" [placeholder]="'ONBOARDING.LOCATIONS_PLACEHOLDER' | translate">
            </div>
            <div class="toggle-row-onboard">
              <span>{{ 'ONBOARDING.REMOTE_ONLY_Q' | translate }}</span>
              <label class="mini-toggle-wrap">
                <input type="checkbox" [(ngModel)]="prefs.remote">
                <span class="t-track"><span class="t-thumb"></span></span>
              </label>
            </div>
          </div>
        }

        <!-- Step: Notifications -->
        @if (currentStep() === 'notifications') {
          <div class="step-content anim-fade-in">
            <aa-icon name="bell" [size]="40" class="step-icon-svg"/>
            <h2>{{ 'ONBOARDING.NOTIFICATIONS_TITLE' | translate }}</h2>
            <p>{{ 'ONBOARDING.NOTIFICATIONS_SUBTITLE' | translate }}</p>
            <div class="input-group">
              <label class="input-label">{{ 'ONBOARDING.WHATSAPP_OPTIONAL' | translate }}</label>
              <input class="neo-input" type="tel" [(ngModel)]="notif.whatsapp" [placeholder]="'ONBOARDING.WHATSAPP_PLACEHOLDER' | translate">
            </div>
            <div class="input-group">
              <label class="input-label">{{ 'ONBOARDING.EMAIL' | translate }}</label>
              <input class="neo-input" type="email" [(ngModel)]="notif.email" [placeholder]="'ONBOARDING.EMAIL_PLACEHOLDER' | translate">
            </div>
          </div>
        }

        <!-- Step: All Set -->
        @if (currentStep() === 'finish') {
          <div class="step-content anim-fade-in" style="text-align:center;">
            <aa-icon name="zap" [size]="40" class="step-icon-svg"/>
            <h2>{{ 'ONBOARDING.ALL_SET_TITLE' | translate }}</h2>
            <p>{{ 'ONBOARDING.ALL_SET_SUBTITLE' | translate }}</p>
            <div class="ready-list">
              <div class="ready-row" [class.checked]="uploaded()">
                <aa-icon [name]="uploaded() ? 'checkCircle' : 'circle'" [size]="14"/> {{ 'ONBOARDING.RESUME_UPLOADED' | translate }}
              </div>
              <div class="ready-row checked"><aa-icon name="checkCircle" [size]="14"/> {{ 'ONBOARDING.PREFERENCES_SAVED' | translate }}</div>
              <div class="ready-row" [class.checked]="notif.email || notif.whatsapp">
                <aa-icon [name]="(notif.email || notif.whatsapp) ? 'checkCircle' : 'circle'" [size]="14"/> {{ 'ONBOARDING.NOTIFICATIONS_SET' | translate }}
              </div>
            </div>
            @if (!uploaded()) {
              <p class="text-warning text-xs mt-16">{{ 'ONBOARDING.SKIPPED_RESUME_WARNING' | translate }}</p>
            }
          </div>
        }

        <!-- Navigation -->
        <div class="step-nav">
          @if (currentStepIndex() > 0) {
            <aa-button variant="secondary" (clicked)="back()" icon="chevronLeft">{{ 'ONBOARDING.BACK' | translate }}</aa-button>
          } @else {
            <div></div>
          }
          @if (currentStep() !== 'finish') {
            <aa-button
              (clicked)="next()"
              [loading]="loading() || checkingVerification()"
              [disabled]="currentStep() === 'verify' && !isEmailVerified()"
              iconRight="chevronRight">
              {{ getNextButtonText() | translate }}
            </aa-button>
          } @else {
            <aa-button (clicked)="finish()" [loading]="loading()" icon="zap">{{ 'ONBOARDING.ACTIVATE_GO' | translate }}</aa-button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .onboard-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); }
    .onboard-card { max-width:480px; width:100%; padding:36px 32px; }
    .progress-bar { display:flex; gap:8px; margin-bottom:24px; }
    .progress-dot { flex:1; height:4px; border-radius:4px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); transition:all .3s; }
    .progress-dot.active { background:var(--accent); box-shadow:none; }
    .progress-dot.done   { background:linear-gradient(135deg,var(--accent),var(--accent-secondary)); box-shadow:none; }
    .step-num { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.8px; margin-bottom:20px; }
    .step-content { margin-bottom:28px; }
    .step-icon-svg { color: var(--accent); margin-bottom:14px; }
    h2 { margin-bottom:8px; }
    p  { margin-bottom:20px; }
    .text-center { text-align: center; }
    .mb-20 { margin-bottom: 20px; }
    .feature-list { display:flex; flex-direction:column; gap:10px; margin-top:16px; }
    .feature-row  { display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text); }
    .feature-row aa-icon { color:var(--success); flex-shrink:0; }

    /* Verify email step styling */
    .verify-icon-wrap {
      width: 68px; height: 68px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
      background: rgba(108, 99, 255, 0.1);
      border: 1px solid rgba(108, 99, 255, 0.25);
      color: var(--accent);
      transition: all 0.3s ease;
    }
    .verify-icon-wrap.verified {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.3);
      color: var(--success);
    }
    .verify-icon-svg { display: flex; }
    .verify-desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px; }
    .email-badge-card {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 12px 16px; border-radius: 12px; margin: 16px 0 20px;
      background: var(--bg); backdrop-filter: blur(var(--glass-blur));
      box-shadow: var(--neo-inset);
    }
    .email-badge-left { display: flex; align-items: center; gap: 8px; overflow: hidden; }
    .user-email-text { font-size: 13px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-pill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0; }
    .status-pill.pending { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    .status-pill.verified { background: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.3); }
    .verify-actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
    .verify-help-box { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--text-muted); }

    /* Resume upload zone */
    .upload-zone { padding:28px; text-align:center; border:2px dashed rgba(108,99,255,.3); border-radius:var(--radius); cursor:pointer; font-size:14px; font-weight:600; color:var(--text-muted); transition:all .2s; background:none; width:100%; display:block; font-family:inherit; }
    .upload-zone:hover,.upload-zone.has-file { border-color:var(--accent); }
    .upload-zone:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .upload-zone > div { display:flex; align-items:center; justify-content:center; gap:8px; }
    .input-group { margin-bottom:14px; }
    .input-label { display:block; font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.6px; margin-bottom:6px; }
    .neo-input { width:100%; padding:12px 16px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border:none; border-radius:10px; box-shadow:var(--neo-inset); font-size:13px; color:var(--text); font-family:var(--font-body); outline:none; box-sizing:border-box; }
    .neo-input::placeholder { color:var(--text-light); }
    .toggle-row-onboard { display:flex; align-items:center; justify-content:space-between; padding:10px 0; font-size:13px; font-weight:600; color:var(--text); }
    .mini-toggle-wrap { position:relative; width:46px; height:24px; display:inline-block; }
    .mini-toggle-wrap input { opacity:0; width:0; height:0; }
    .t-track { position:absolute; inset:0; border-radius:24px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); cursor:pointer; transition:.3s; }
    .t-thumb { position:absolute; left:3px; top:3px; width:18px; height:18px; border-radius:50%; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); transition:.3s; }
    input:checked + .t-track { background:linear-gradient(135deg,var(--accent),var(--accent-secondary)); }
    input:checked + .t-track .t-thumb { transform:translateX(22px); background:#fff; }
    .ready-list { display:flex; flex-direction:column; gap:12px; margin-top:20px; text-align:left; }
    .ready-row  { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; color:var(--text-muted); }
    .ready-row.checked { color:var(--text); }
    .ready-row aa-icon { color: var(--success); }
    .ready-row:not(.checked) aa-icon { color: var(--text-light); }
    .step-nav   { display:flex; justify-content:space-between; align-items:center; }
    .text-warning { color: var(--warning); }
    .text-success { color: var(--success); }
  `]
})
export class OnboardingComponent implements OnInit, OnDestroy {
  currentStep = signal<OnboardingStepId>('welcome');
  loading = signal(false);
  uploading = signal(false);
  uploaded  = signal(false);
  checkingVerification = signal(false);
  resendingVerification = signal(false);
  resendCooldown = signal(0);
  resumeText = signal('');

  prefs = { titles:'', locations:'', remote:false };
  notif = { whatsapp:'', email:'' };
  welcomeFeatures = ['ONBOARDING.FEATURE_1','ONBOARDING.FEATURE_2','ONBOARDING.FEATURE_3','ONBOARDING.FEATURE_4'];

  private resumeFile: File | null = null;
  private cooldownTimer: any = null;

  isEmailVerified = computed(() => !!this.auth.currentUser()?.emailVerified);

  steps = computed<OnboardingStepId[]>(() => {
    if (this.isEmailVerified() && this.currentStep() !== 'verify') {
      return ['welcome', 'resume', 'preferences', 'notifications', 'finish'];
    }
    return ['welcome', 'verify', 'resume', 'preferences', 'notifications', 'finish'];
  });

  currentStepIndex = computed(() => {
    const idx = this.steps().indexOf(this.currentStep());
    return idx >= 0 ? idx : 0;
  });

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // If an unverified user was on a later step, redirect them to verify first
    if (!this.isEmailVerified() && (this.currentStep() as string) === 'resume') {
      this.currentStep.set('verify');
    }
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    // When user returns from clicking the verification link in their email client
    if (this.currentStep() === 'verify' && !this.isEmailVerified()) {
      this.checkVerification(false);
    }
  }

  checkVerification(showToasts = true): void {
    this.checkingVerification.set(true);
    this.auth.fetchMe().subscribe({
      next: () => {
        this.checkingVerification.set(false);
        if (this.auth.currentUser()?.emailVerified) {
          if (showToasts) {
            this.toast.success(this.translate.instant('ONBOARDING.VERIFY_EMAIL_SUCCESS_TOAST'));
          }
          this.currentStep.set('resume');
        } else if (showToasts) {
          this.toast.info(this.translate.instant('ONBOARDING.VERIFY_EMAIL_NOT_YET_TOAST'));
        }
      },
      error: () => {
        this.checkingVerification.set(false);
        if (showToasts) {
          this.toast.info(this.translate.instant('ONBOARDING.VERIFY_EMAIL_NOT_YET_TOAST'));
        }
      },
    });
  }

  resendVerification(): void {
    if (this.resendingVerification() || this.resendCooldown() > 0) return;
    this.resendingVerification.set(true);
    this.auth.resendVerification().subscribe({
      next: () => {
        this.resendingVerification.set(false);
        this.toast.success(this.translate.instant('ONBOARDING.VERIFY_EMAIL_RESENT_TOAST'));
        this.startCooldown(60);
      },
      error: (e: any) => {
        this.resendingVerification.set(false);
        this.toast.error(e.error?.message || this.translate.instant('ONBOARDING.RESEND_FAILED'));
      },
    });
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const cur = this.resendCooldown();
      if (cur <= 1) {
        this.resendCooldown.set(0);
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      } else {
        this.resendCooldown.set(cur - 1);
      }
    }, 1000);
  }

  goToStep(stepId: OnboardingStepId): void {
    if (stepId === 'resume' && !this.isEmailVerified()) {
      this.toast.info(this.translate.instant('ONBOARDING.VERIFY_EMAIL_FIRST'));
      this.currentStep.set('verify');
      return;
    }
    this.currentStep.set(stepId);
  }

  onFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.resumeFile = file;
    this.uploadResume(file);
  }

  private uploadResume(file: File): void {
    if (!this.isEmailVerified()) {
      this.toast.error(this.translate.instant('ONBOARDING.VERIFY_EMAIL_FIRST'));
      this.currentStep.set('verify');
      return;
    }

    this.uploading.set(true);
    const fd = new FormData();
    fd.append('resume', file, file.name);
    this.api.uploadResume(fd).subscribe({
      next: () => { this.uploaded.set(true); this.uploading.set(false); this.resumeText.set(file.name); },
      error: (e: any) => {
        this.uploading.set(false);
        if (e.status === 403) {
          this.toast.info(this.translate.instant('ONBOARDING.VERIFY_EMAIL_UPLOAD'));
          this.currentStep.set('verify');
        } else {
          this.toast.error(e.error?.message || this.translate.instant('ONBOARDING.UPLOAD_FAILED'));
        }
      },
    });
  }

  getNextButtonText(): string {
    if (this.currentStep() === 'verify') {
      return this.isEmailVerified() ? 'ONBOARDING.NEXT' : 'ONBOARDING.VERIFY_EMAIL_CHECK_BTN';
    }
    if (this.currentStep() === 'resume' && !this.resumeText()) {
      return 'ONBOARDING.SKIP';
    }
    return 'ONBOARDING.NEXT';
  }

  next(): void {
    const cur = this.currentStep();
    if (cur === 'welcome') {
      if (this.isEmailVerified()) {
        this.currentStep.set('resume');
      } else {
        this.currentStep.set('verify');
      }
      return;
    }

    if (cur === 'verify') {
      if (!this.isEmailVerified()) {
        this.checkVerification(true);
        return;
      }
      this.currentStep.set('resume');
      return;
    }

    if (cur === 'resume') {
      if (!this.isEmailVerified()) {
        this.toast.error(this.translate.instant('ONBOARDING.VERIFY_EMAIL_FIRST'));
        this.currentStep.set('verify');
        return;
      }
      if (this.resumeText() && !this.uploaded() && !this.resumeFile) {
        // pasted text, not a file — upload it as a text resume before advancing
        this.uploading.set(true);
        const blob = new Blob([this.resumeText()], { type: 'text/plain' });
        const fd = new FormData();
        fd.append('resume', blob, 'resume.txt');
        this.api.uploadResume(fd).subscribe({
          next: () => { this.uploaded.set(true); this.uploading.set(false); this.currentStep.set('preferences'); },
          error: (e: any) => {
            this.uploading.set(false);
            if (e.status === 403) {
              this.toast.info(this.translate.instant('ONBOARDING.VERIFY_EMAIL_PARSE'));
              this.currentStep.set('verify');
            } else {
              this.toast.error(e.error?.message || this.translate.instant('ONBOARDING.PARSE_FAILED'));
              this.currentStep.set('preferences');
            }
          },
        });
        return;
      }
      this.currentStep.set('preferences');
      return;
    }

    if (cur === 'preferences') {
      this.currentStep.set('notifications');
      return;
    }

    if (cur === 'notifications') {
      this.currentStep.set('finish');
      return;
    }
  }

  back(): void {
    const cur = this.currentStep();
    if (cur === 'verify') {
      this.currentStep.set('welcome');
      return;
    }
    if (cur === 'resume') {
      if (this.isEmailVerified()) {
        this.currentStep.set('welcome');
      } else {
        this.currentStep.set('verify');
      }
      return;
    }
    if (cur === 'preferences') {
      this.currentStep.set('resume');
      return;
    }
    if (cur === 'notifications') {
      this.currentStep.set('preferences');
      return;
    }
    if (cur === 'finish') {
      this.currentStep.set('notifications');
      return;
    }
  }

  finish(): void {
    this.loading.set(true);
    const preferences = {
      jobTitles: this.prefs.titles.split(',').map(s => s.trim()).filter(Boolean),
      locations: this.prefs.locations.split(',').map(s => s.trim()).filter(Boolean),
      remoteOnly: this.prefs.remote,
    };
    const notificationSettings = {
      whatsappEnabled: !!this.notif.whatsapp,
      whatsappNumber: this.notif.whatsapp,
      emailEnabled: !!this.notif.email,
      emailAddress: this.notif.email,
    };

    this.api.updatePreferences({ preferences, notificationSettings, onboardingComplete: true }).subscribe({
      next: () => {
        // Patch locally right away — the write we just confirmed succeeded
        // is what onboardingGuard actually checks, and it must not depend
        // on the separate fetchMe() call below also succeeding.
        this.auth.patchUser({ onboardingComplete: true });
        this.auth.fetchMe().subscribe({
          next: () => {
            this.api.startAutomation().subscribe({
              next: () => { this.toast.success(this.translate.instant('ONBOARDING.TOAST_ACTIVATED')); this.router.navigate(['/dashboard']); },
              error: (e: any) => {
                if (e.status === 403) this.toast.info(this.translate.instant('ONBOARDING.TOAST_VERIFY_AUTO'));
                this.router.navigate(['/dashboard']);
              },
            });
          },
          error: () => this.router.navigate(['/dashboard']),
        });
      },
      error: () => {
        this.toast.error(this.translate.instant('ONBOARDING.TOAST_PREFS_FAILED'));
        this.loading.set(false);
      },
    });
  }
}
