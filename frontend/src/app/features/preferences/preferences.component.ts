import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'aa-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, NeoButtonComponent, IconComponent, TranslateModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ 'PREFERENCES.TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'PREFERENCES.SUBTITLE' | translate }}</p>
      </div>

      @if (loading()) {
        <div class="skeleton" style="height:400px;border-radius:16px;"></div>
      } @else {
        <div class="grid-2">
          <!-- Search criteria -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="search" [size]="16"/> {{ 'PREFERENCES.SEARCH_CRITERIA' | translate }}</div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.TARGET_TITLES' | translate }}</label>
              <input class="neo-input" [(ngModel)]="jobTitlesText" [placeholder]="'PREFERENCES.TARGET_TITLES_PLACEHOLDER' | translate">
              <div class="field-hint">{{ 'PREFERENCES.COMMA_SEPARATED' | translate }}</div>
            </div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.PREFERRED_LOCATIONS' | translate }}</label>
              <input class="neo-input" [(ngModel)]="locationsText" [placeholder]="'PREFERENCES.LOCATIONS_PLACEHOLDER' | translate">
              <div class="field-hint">{{ 'PREFERENCES.COMMA_SEPARATED' | translate }}</div>
            </div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.MIN_SALARY' | translate }}</label>
              <input type="number" class="neo-input" [(ngModel)]="prefs.minSalary" min="0">
            </div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.JOB_TYPES' | translate }}</label>
              <div class="checkbox-row">
                @for (t of jobTypeOptions; track t) {
                  <label class="check-chip" [class.active]="prefs.jobTypes.includes(t)">
                    <input type="checkbox" [checked]="prefs.jobTypes.includes(t)" (change)="toggleArr(prefs.jobTypes, t)">
                    {{ ('PREFERENCES.JOB_TYPE.' + t) | translate }}
                  </label>
                }
              </div>
            </div>

            <div class="toggle-row">
              <span class="text-sm">{{ 'PREFERENCES.REMOTE_ONLY' | translate }}</span>
              <label class="mini-toggle">
                <input type="checkbox" [(ngModel)]="prefs.remoteOnly">
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </label>
            </div>
          </div>

          <!-- EU + automation tuning -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="eu" [size]="16"/> {{ 'PREFERENCES.EU_AUTOMATION_TUNING' | translate }}</div>

            <div class="toggle-row">
              <span class="text-sm">{{ 'PREFERENCES.ENABLE_EU_MODE' | translate }}</span>
              <label class="mini-toggle">
                <input type="checkbox" [(ngModel)]="prefs.euMode">
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="text-sm">{{ 'PREFERENCES.REQUIRE_VISA' | translate }}</span>
              <label class="mini-toggle">
                <input type="checkbox" [(ngModel)]="prefs.visaSponsorshipRequired">
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </label>
            </div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.CURRENT_CTC' | translate }}</label>
              <input type="number" class="neo-input" [(ngModel)]="prefs.currentCtcLPA" min="0">
            </div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.GHOST_SCORE_MIN' | translate:{score: prefs.ghostScoreMinimum} }}</label>
              <input type="range" min="0" max="100" step="5" class="score-range" [(ngModel)]="prefs.ghostScoreMinimum">
            </div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.AUTO_APPLY_THRESHOLD' | translate:{pct: prefs.autoApplyThreshold} }}</label>
              <input type="range" min="65" max="99" step="1" class="score-range" [(ngModel)]="prefs.autoApplyThreshold">
              <div class="field-hint">{{ 'PREFERENCES.AUTO_APPLY_HINT' | translate }}</div>
            </div>

            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.DAILY_LIMIT' | translate:{limit: dailyApplyLimit} }}</label>
              <input type="range" min="1" [max]="maxDailyLimit()" step="1" class="score-range" [(ngModel)]="dailyApplyLimit">
              <div class="field-hint">{{ 'PREFERENCES.DAILY_LIMIT_HINT' | translate:{plan: planName(), max: maxDailyLimit()} }}</div>
            </div>
          </div>
        </div>

        <!-- Keywords -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="target" [size]="16"/> {{ 'PREFERENCES.KEYWORD_RULES' | translate }}</div>
          <div class="grid-2">
            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.MUST_HAVE_KEYWORDS' | translate }}</label>
              <input class="neo-input" [(ngModel)]="mustHaveText" [placeholder]="'PREFERENCES.MUST_HAVE_PLACEHOLDER' | translate">
              <div class="field-hint">{{ 'PREFERENCES.MUST_HAVE_HINT' | translate }}</div>
            </div>
            <div class="field-group">
              <label class="field-label">{{ 'PREFERENCES.DEAL_BREAKER_KEYWORDS' | translate }}</label>
              <input class="neo-input" [(ngModel)]="dealBreakerText" [placeholder]="'PREFERENCES.DEAL_BREAKER_PLACEHOLDER' | translate">
              <div class="field-hint">{{ 'PREFERENCES.DEAL_BREAKER_HINT' | translate }}</div>
            </div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="bell" [size]="16"/> {{ 'PREFERENCES.NOTIFICATIONS' | translate }}</div>
          <div class="grid-2">
            <div>
              <div class="toggle-row">
                <span class="text-sm">{{ 'PREFERENCES.EMAIL_NOTIFICATIONS' | translate }}</span>
                <label class="mini-toggle">
                  <input type="checkbox" [(ngModel)]="notif.emailEnabled">
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
              <div class="field-group">
                <label class="field-label">{{ 'PREFERENCES.NOTIFICATION_EMAIL' | translate }}</label>
                <input class="neo-input" [(ngModel)]="notif.emailAddress" placeholder="you@example.com">
              </div>
              <div class="toggle-row">
                <span class="text-sm">{{ 'PREFERENCES.WHATSAPP_NOTIFICATIONS' | translate }}</span>
                <label class="mini-toggle">
                  <input type="checkbox" [(ngModel)]="notif.whatsappEnabled">
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
              <div class="field-group">
                <label class="field-label">{{ 'PREFERENCES.WHATSAPP_NUMBER' | translate }}</label>
                <input class="neo-input" [(ngModel)]="notif.whatsappNumber" placeholder="+91 98765 43210">
              </div>
            </div>
            <div>
              <div class="toggle-row">
                <span class="text-sm">{{ 'PREFERENCES.NOTIFY_PER_APPLICATION' | translate }}</span>
                <label class="mini-toggle">
                  <input type="checkbox" [(ngModel)]="notif.perApplication">
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
              <div class="toggle-row">
                <span class="text-sm">{{ 'PREFERENCES.DAILY_SUMMARY' | translate }}</span>
                <label class="mini-toggle">
                  <input type="checkbox" [(ngModel)]="notif.dailySummary">
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
              <div class="toggle-row">
                <span class="text-sm">{{ 'PREFERENCES.WEEKLY_DIGEST' | translate }}</span>
                <label class="mini-toggle">
                  <input type="checkbox" [(ngModel)]="notif.weeklyDigest">
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="save-bar">
          <aa-button [loading]="saving()" (clicked)="save()" icon="checkCircle">{{ 'PREFERENCES.SAVE_BTN' | translate }}</aa-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .field-group  { margin-bottom: 16px; }
    .field-label  { display: block; font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
    .field-hint   { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
    .neo-input {
      width: 100%; padding: 10px 14px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: none;
      border-radius: var(--radius-sm); box-shadow: var(--neo-inset);
      font-size: 13px; color: var(--text); outline: none; box-sizing: border-box;
    }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px var(--accent-dim); }

    .checkbox-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .check-chip {
      display: flex; align-items: center; gap: 5px; padding: 6px 12px;
      border-radius: var(--radius-pill); background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm);
      font-size: 12px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all .2s;
    }
    .check-chip.active { box-shadow: var(--neo-inset); color: var(--accent); }
    .check-chip input { display: none; }

    .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(163,177,198,.15); }
    .mini-toggle  { position: relative; display: inline-block; width: 42px; height: 22px; flex-shrink: 0; }
    .mini-toggle input { opacity: 0; width: 0; height: 0; }
    .mini-toggle .toggle-track { position: absolute; inset: 0; border-radius: 22px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset); cursor: pointer; transition: .3s; }
    .mini-toggle .toggle-thumb { position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); transition: .3s; }
    .mini-toggle input:checked + .toggle-track { background: linear-gradient(135deg,var(--accent),#a855f7); }
    .mini-toggle input:checked + .toggle-track .toggle-thumb { transform: translateX(20px); background: #fff; }

    .score-range { -webkit-appearance: none; width: 100%; height: 5px; border-radius: 3px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset); outline: none; }
    .score-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); cursor: pointer; }

    .save-bar { display: flex; justify-content: flex-end; margin-top: 8px; }
  `]
})
export class PreferencesComponent implements OnInit {
  loading = signal(true);
  saving  = signal(false);

  jobTypeOptions = ['full-time','part-time','contract','remote','hybrid','on-site'];

  prefs: any = {
    jobTitles: [], locations: [], targetCountries: [], minSalary: 0, currency: 'INR',
    jobTypes: [], remoteOnly: false, euMode: false, visaSponsorshipRequired: false,
    currentCtcLPA: null, ghostScoreMinimum: 40, autoApplyThreshold: 80,
    dealBreakerKeywords: [], mustHaveKeywords: [],
  };
  notif: any = {
    whatsappEnabled: false, emailEnabled: true, perApplication: true,
    dailySummary: true, weeklyDigest: true, whatsappNumber: '', emailAddress: '',
  };
  dailyApplyLimit = 3;

  jobTitlesText = ''; locationsText = ''; mustHaveText = ''; dealBreakerText = '';

  constructor(private api: ApiService, public auth: AuthService, private toast: ToastService, private translate: TranslateService) {}

  ngOnInit(): void {
    this.api.getSettings().subscribe({
      next: (r: any) => {
        if (r.data?.preferences)          Object.assign(this.prefs, r.data.preferences);
        if (r.data?.notificationSettings) Object.assign(this.notif, r.data.notificationSettings);
        this.dailyApplyLimit = r.data?.dailyApplyLimit || this.auth.currentUser()?.dailyApplyLimit || 3;
        this.jobTitlesText   = (this.prefs.jobTitles || []).join(', ');
        this.locationsText   = (this.prefs.locations || []).join(', ');
        this.mustHaveText    = (this.prefs.mustHaveKeywords || []).join(', ');
        this.dealBreakerText = (this.prefs.dealBreakerKeywords || []).join(', ');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  planName = () => {
    const p = this.auth.currentUser()?.plan || 'free';
    return p.charAt(0).toUpperCase() + p.slice(1);
  };
  maxDailyLimit = () => this.auth.currentUser()?.planLimits?.dailyApply || 3;

  toggleArr(arr: string[], val: string): void {
    const i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1); else arr.push(val);
  }

  private parseCsv(text: string): string[] {
    return text.split(',').map(s => s.trim()).filter(Boolean);
  }

  save(): void {
    this.prefs.jobTitles           = this.parseCsv(this.jobTitlesText);
    this.prefs.locations           = this.parseCsv(this.locationsText);
    this.prefs.mustHaveKeywords    = this.parseCsv(this.mustHaveText);
    this.prefs.dealBreakerKeywords = this.parseCsv(this.dealBreakerText);

    this.saving.set(true);
    this.api.updatePreferences({
      preferences: this.prefs,
      notificationSettings: this.notif,
      dailyApplyLimit: this.dailyApplyLimit,
    }).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PREFERENCES.SAVED_TOAST'));
        this.saving.set(false);
        this.auth.fetchMe().subscribe();
      },
      error: (e: any) => { this.toast.error(e.error?.message || this.translate.instant('PREFERENCES.SAVE_FAILED_TOAST')); this.saving.set(false); },
    });
  }
}
