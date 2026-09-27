import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService, ApiResponse } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

interface LinkedInProfile {
  headline: string;
  about: string;
  experienceBullets: string[];
  currentRole?: string;
  targetRoles?: string[];
  industry?: string;
  fullName?: string;
  fetchBlocked?: boolean;
  fetchBlockedMessage?: string;
}

interface OptimizedProfile {
  headline: string;
  about: string;
  experienceBullets: string[];
  skills?: string[];
  featuredTips?: string[];
  linkedInScore: number;
  improvements: string[];
  keywordsAdded: string[];
  tips: string[];
}

@Component({
  selector: 'aa-linkedin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ 'LINKEDIN.TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'LINKEDIN.SUBTITLE' | translate }}</p>
      </div>

      <!-- Quick Import Card (URL Fetch & Resume Auto-fill) -->
      <div class="section-card import-card">
        <div class="section-title">
          <aa-icon name="zap" [size]="18" class="text-accent"/>
          <span>{{ 'LINKEDIN.FETCH_BTN' | translate }} &amp; Auto-Import</span>
        </div>
        <p class="import-hint">{{ 'LINKEDIN.RESULTS_INFO' | translate }}</p>

        <div class="import-actions">
          <div class="url-input-wrap">
            <aa-icon name="link" [size]="16" class="url-icon"/>
            <input type="url" class="neo-input url-input"
              [(ngModel)]="linkedinUrl"
              (keydown.enter)="fetchFromUrl()"
              [placeholder]="'LINKEDIN.URL_PLACEHOLDER' | translate"
              [disabled]="fetching() || optimizing()">
            <aa-button [loading]="fetching()" (clicked)="fetchFromUrl()" [disabled]="!linkedinUrl.trim() || optimizing()" icon="search">
              {{ (fetching() ? 'LINKEDIN.FETCHING' : 'LINKEDIN.FETCH_BTN') | translate }}
            </aa-button>
          </div>

          <div class="import-or">
            <span>{{ 'COMMON.OR' | translate }}</span>
          </div>

          <aa-button variant="secondary" icon="resume" (clicked)="fetchFromResume()" [disabled]="fetching() || optimizing()">
            {{ 'LINKEDIN.AUTO_FILL_RESUME' | translate }}
          </aa-button>
        </div>

        @if (fetchedSource()) {
          <div class="fetch-badge anim-fade-in">
            <aa-icon name="checkCircle" [size]="14" class="text-success"/>
            <span>{{ fetchedSource() }}</span>
          </div>
        }

        @if (fetchBlockedMessage()) {
          <div class="fetch-blocked-banner anim-fade-in">
            <div class="blocked-icon">
              <aa-icon name="alertCircle" [size]="18"/>
            </div>
            <div class="blocked-body">
              <strong>LinkedIn Profile Auto-Fetch Blocked</strong>
              <p>{{ fetchBlockedMessage() }}</p>
            </div>
            <aa-button variant="secondary" size="sm" icon="resume" (clicked)="fetchFromResume()" [disabled]="fetching()">
              Auto-fill from Resume
            </aa-button>
          </div>
        }
      </div>

      @if (!optimized()) {
        <!-- Details Review & Form -->
        <div class="section-card anim-fade-in">
          <div class="d-flex justify-between align-center mb-16">
            <div class="section-title mb-0">
              <aa-icon name="edit" [size]="16"/>
              <span>{{ 'LINKEDIN.PROFILE_INPUT' | translate }}</span>
            </div>
            <div class="d-flex gap-8">
              <aa-button size="sm" [loading]="optimizing()" (clicked)="optimize()" icon="sparkles">
                {{ (optimizing() ? 'LINKEDIN.OPTIMIZING' : 'LINKEDIN.OPTIMIZE_BTN') | translate }}
              </aa-button>
              <aa-button variant="secondary" size="sm" (clicked)="reset()" [disabled]="optimizing()">
                {{ 'COMMON.CLEAR' | translate }}
              </aa-button>
            </div>
          </div>

          <!-- Headline input -->
          <div class="form-group">
            <label class="form-label">{{ 'LINKEDIN.HEADLINE_LABEL' | translate }} ({{ 'LINKEDIN.MAX_120' | translate }})</label>
            <input type="text" class="neo-input" [(ngModel)]="profileInput().headline" 
              [maxlength]="120" [placeholder]="'LINKEDIN.HEADLINE_PLACEHOLDER' | translate"
              [disabled]="optimizing()">
            <div class="text-xs text-muted mt-4">{{ profileInput().headline.length }}/120</div>
          </div>

          <!-- About section input -->
          <div class="form-group mt-16">
            <label class="form-label">{{ 'LINKEDIN.ABOUT_LABEL' | translate }} ({{ 'LINKEDIN.MAX_2600' | translate }})</label>
            <textarea class="neo-input" rows="5" [(ngModel)]="profileInput().about"
              [maxlength]="2600" [placeholder]="'LINKEDIN.ABOUT_PLACEHOLDER' | translate"
              [disabled]="optimizing()"></textarea>
            <div class="text-xs text-muted mt-4">{{ profileInput().about.length }}/2600</div>
          </div>

          <!-- Experience bullets input -->
          <div class="form-group mt-16">
            <label class="form-label">{{ 'LINKEDIN.BULLETS_LABEL' | translate }}</label>
            <div class="bullets-container">
              @for (bullet of profileInput().experienceBullets; let i = $index; track i) {
                <div class="bullet-row">
                  <textarea class="neo-input bullet-input" rows="2" [(ngModel)]="profileInput().experienceBullets[i]"
                    [placeholder]="'LINKEDIN.BULLET_PLACEHOLDER' | translate"
                    [disabled]="optimizing()"></textarea>
                  <aa-button variant="ghost" size="sm" icon="trash" 
                    (clicked)="removeBullet(i)" [disabled]="optimizing()"></aa-button>
                </div>
              }
            </div>
            <aa-button variant="secondary" size="sm" (clicked)="addBullet()" icon="plus" 
              [disabled]="optimizing()" class="mt-8">{{ 'LINKEDIN.ADD_BULLET' | translate }}</aa-button>
          </div>

          <!-- Optional fields -->
          <div class="form-row mt-16">
            <div class="form-group flex-1">
              <label class="form-label">{{ 'LINKEDIN.CURRENT_ROLE' | translate }}</label>
              <input type="text" class="neo-input" [(ngModel)]="profileInput().currentRole"
                [placeholder]="'LINKEDIN.CURRENT_ROLE_PLACEHOLDER' | translate"
                [disabled]="optimizing()">
            </div>
            <div class="form-group flex-1">
              <label class="form-label">{{ 'LINKEDIN.INDUSTRY' | translate }}</label>
              <input type="text" class="neo-input" [(ngModel)]="profileInput().industry"
                [placeholder]="'LINKEDIN.INDUSTRY_PLACEHOLDER' | translate"
                [disabled]="optimizing()">
            </div>
          </div>

          <!-- Target roles input -->
          <div class="form-group mt-16">
            <label class="form-label">{{ 'LINKEDIN.TARGET_ROLES' | translate }}</label>
            <div class="tags-container">
              @for (role of profileInput().targetRoles; let i = $index; track i) {
                <div class="tag">
                  <span>{{ role }}</span>
                  <button type="button" class="tag-remove" (click)="removeRole(i)" [disabled]="optimizing()">×</button>
                </div>
              }
              <input type="text" class="tag-input" #roleInput [placeholder]="'LINKEDIN.ADD_ROLE' | translate"
                (keydown.enter)="addRole(roleInput)" [disabled]="optimizing()">
            </div>
          </div>

          <!-- Action buttons -->
          <div class="d-flex gap-8 mt-24">
            <aa-button [loading]="optimizing()" (clicked)="optimize()" icon="sparkles">
              {{ (optimizing() ? 'LINKEDIN.OPTIMIZING' : 'LINKEDIN.OPTIMIZE_BTN') | translate }}
            </aa-button>
            <aa-button variant="secondary" (clicked)="reset()" [disabled]="optimizing()">
              {{ 'COMMON.CLEAR' | translate }}
            </aa-button>
          </div>
        </div>
      } @else {
        @if (optimized(); as opt) {
        <!-- Optimized results view with 1-Click Copy paste blocks -->
        <div class="section-card anim-fade-in">
          <div class="d-flex justify-between align-center mb-24">
            <div>
              <div class="section-title"><aa-icon name="checkCircle" [size]="18" class="text-success"/> {{ 'LINKEDIN.OPTIMIZED' | translate }}</div>
              <div class="text-muted text-sm mt-4">{{ 'LINKEDIN.RESULTS_INFO' | translate }}</div>
            </div>
            <div class="score-card">
              <div class="score-value">{{ opt.linkedInScore }}/100</div>
              <div class="score-label">{{ 'LINKEDIN.ENGAGEMENT_SCORE' | translate }}</div>
            </div>
          </div>

          <!-- Score breakdown bar -->
          <div class="score-bar mb-24">
            <div class="score-fill" [style.width.%]="opt.linkedInScore"></div>
          </div>

          <!-- Quick Copy All Banner -->
          <div class="copy-all-banner mb-24">
            <div class="banner-text">
              <strong>1-Click LinkedIn Export:</strong> Copy your entire formatted profile to easily update LinkedIn in seconds.
            </div>
            <aa-button (clicked)="copyAll()" icon="copy">
              {{ (copiedState['all'] ? 'LINKEDIN.COPIED' : 'LINKEDIN.COPY_ALL') | translate }}
            </aa-button>
          </div>

          <!-- Improvements and Keywords -->
          <div class="insights-grid mb-24">
            @if (opt.improvements.length > 0) {
              <div class="insight-box">
                <div class="section-subtitle"><aa-icon name="lightbulb" [size]="15" class="text-warning"/> {{ 'LINKEDIN.IMPROVEMENTS' | translate }}</div>
                <ul class="improvements-list">
                  @for (improvement of opt.improvements; track $index) {
                    <li class="improvement-item">{{ improvement }}</li>
                  }
                </ul>
              </div>
            }

            @if (opt.keywordsAdded.length > 0) {
              <div class="insight-box">
                <div class="section-subtitle"><aa-icon name="tag" [size]="15" class="text-accent"/> {{ 'LINKEDIN.KEYWORDS_ADDED' | translate }}</div>
                <div class="keywords-chips">
                  @for (keyword of opt.keywordsAdded; track $index) {
                    @if (asString(keyword)) {
                      <span class="keyword-chip">{{ asString(keyword) }}</span>
                    }
                  }
                </div>
              </div>
            }
          </div>

          <!-- Optimized Content Blocks with individual copy buttons -->
          <div class="content-sections">
            <!-- Headline block -->
            @if (opt.headline) {
              <div class="content-block">
                <div class="content-header">
                  <span class="content-label">{{ 'LINKEDIN.HEADLINE_OPTIMIZED' | translate }}</span>
                  <aa-button size="xs" variant="secondary" icon="copy" (clicked)="copyPart('headline', asString(opt.headline))">
                    {{ (copiedState['headline'] ? 'LINKEDIN.COPIED' : 'LINKEDIN.COPY_HEADLINE') | translate }}
                  </aa-button>
                </div>
                <div class="content-box">
                  {{ asString(opt.headline) }}
                </div>
              </div>
            }

            <!-- About block -->
            @if (opt.about) {
              <div class="content-block mt-20">
                <div class="content-header">
                  <span class="content-label">{{ 'LINKEDIN.ABOUT_OPTIMIZED' | translate }}</span>
                  <aa-button size="xs" variant="secondary" icon="copy" (clicked)="copyPart('about', asString(opt.about))">
                    {{ (copiedState['about'] ? 'LINKEDIN.COPIED' : 'LINKEDIN.COPY_ABOUT') | translate }}
                  </aa-button>
                </div>
                <div class="content-box content-box--tall">
                  {{ asString(opt.about) }}
                </div>
              </div>
            }

            <!-- Experience bullets block -->
            @if (opt.experienceBullets.length > 0) {
              <div class="content-block mt-20">
                <div class="content-header">
                  <span class="content-label">{{ 'LINKEDIN.BULLETS_OPTIMIZED' | translate }}</span>
                  <aa-button size="xs" variant="secondary" icon="copy" (clicked)="copyPart('bullets', getBulletsString())">
                    Copy All Bullets
                  </aa-button>
                </div>
                <div class="bullets-list">
                  @for (bullet of opt.experienceBullets; let i = $index; track i) {
                    <div class="bullet-item">
                      <div class="bullet-text">• {{ asString(bullet) }}</div>
                      <aa-button variant="ghost" size="xs" icon="copy" (clicked)="copyPart('b_' + i, asString(bullet))">
                        {{ (copiedState['b_' + i] ? 'LINKEDIN.COPIED' : 'Copy') | translate }}
                      </aa-button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Recommended Skills Block -->
            @if ((opt.skills?.length || 0) > 0) {
              <div class="content-block mt-20">
                <div class="content-header">
                  <span class="content-label">Top Recommended Skills for LinkedIn (Recruiter SEO)</span>
                  <aa-button size="xs" variant="secondary" icon="copy" (clicked)="copyPart('skills', getSkillsListString())">
                    {{ (copiedState['skills'] ? 'LINKEDIN.COPIED' : 'Copy All Skills') | translate }}
                  </aa-button>
                </div>
                <div class="skills-grid">
                  @for (skill of (opt.skills || []); let i = $index; track i) {
                    <div class="skill-pill">
                      <span>{{ asString(skill) }}</span>
                      <button type="button" class="mini-copy-btn" (click)="copyPart('s_' + i, asString(skill))" [title]="'Copy ' + asString(skill)">
                        <aa-icon [name]="copiedState['s_' + i] ? 'check' : 'copy'" [size]="12"/>
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Featured Section Recommendations -->
            @if ((opt.featuredTips?.length || 0) > 0) {
              <div class="content-block mt-20">
                <div class="content-header">
                  <span class="content-label">High-Impact Recommendations for LinkedIn "Featured" Section</span>
                </div>
                <div class="featured-tips-list">
                  @for (tip of (opt.featuredTips || []); track $index) {
                    <div class="featured-tip-item">
                      <aa-icon name="sparkles" [size]="14" class="text-accent"/>
                      <span>{{ asString(tip) }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Actionable Profile Advice -->
            @if (opt.tips.length > 0) {
              <div class="content-block mt-20">
                <div class="content-header">
                  <span class="content-label">Recruiter Search Algorithm Optimization Checklist</span>
                </div>
                <div class="featured-tips-list">
                  @for (tip of opt.tips; track $index) {
                    <div class="featured-tip-item">
                      <aa-icon name="checkCircle" [size]="14" class="text-success"/>
                      <span>{{ asString(tip) }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Bottom Actions -->
          <div class="d-flex gap-8 mt-24 pt-24 border-top">
            <aa-button (clicked)="editInputs()" variant="secondary" icon="edit">
              Edit Details
            </aa-button>
            <aa-button (clicked)="copyAll()" icon="copy">
              {{ (copiedState['all'] ? 'LINKEDIN.COPIED' : 'LINKEDIN.COPY_ALL') | translate }}
            </aa-button>
            <aa-button variant="ghost" (clicked)="reset()" icon="refresh">
              {{ 'LINKEDIN.TRY_ANOTHER' | translate }}
            </aa-button>
          </div>
        </div>
        }
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 1100px; margin: 0 auto; padding: 32px 16px; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: var(--text); }
    .page-subtitle { font-size: 14px; color: var(--text-muted); margin: 0; }

    .section-card {
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius, 12px);
      padding: 24px; margin-bottom: 20px;
      box-shadow: var(--neo-raised);
    }
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: var(--text); }
    .section-subtitle { font-size: 14px; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; color: var(--text); }

    /* Quick Import Card */
    .import-card { border-left: 4px solid var(--accent); }
    .import-hint { font-size: 13px; color: var(--text-muted); margin: 0 0 16px 0; }
    .import-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .url-input-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 320px; position: relative; }
    .url-icon { position: absolute; left: 12px; color: var(--text-muted); pointer-events: none; }
    .url-input { padding-left: 36px !important; flex: 1; }
    .import-or { color: var(--text-muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .fetch-badge {
      display: inline-flex; align-items: center; gap: 6px; margin-top: 14px;
      padding: 6px 12px; border-radius: 20px; background: var(--success-soft, rgba(74,222,128,0.14));
      color: var(--success); font-size: 12px; font-weight: 600;
    }
    .fetch-blocked-banner {
      display: flex; align-items: flex-start; gap: 12px; margin-top: 16px;
      padding: 14px 16px; border-radius: 10px;
      background: rgba(250, 173, 20, 0.10); border: 1px solid rgba(250, 173, 20, 0.35);
      color: var(--text);
    }
    .blocked-icon { color: #faad14; flex-shrink: 0; margin-top: 2px; }
    .blocked-body { flex: 1; font-size: 13px; line-height: 1.5; }
    .blocked-body strong { display: block; font-size: 13px; font-weight: 700; color: #faad14; margin-bottom: 4px; }
    .blocked-body p { margin: 0; color: var(--text-muted); }

    /* Form styles */
    .form-group { margin-bottom: 0; }
    .form-group.mt-16 { margin-top: 16px; }
    .form-row { display: flex; gap: 16px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; color: var(--text-muted); }
    .neo-input {
      width: 100%; padding: 11px 14px; border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm, 8px); font-size: 13px;
      background: var(--bg); color: var(--text); font-family: inherit;
      resize: vertical; outline: none; transition: border-color .2s, box-shadow .2s;
    }
    .neo-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-ring); }
    .neo-input:disabled { opacity: 0.6; cursor: not-allowed; }

    .bullets-container { display: flex; flex-direction: column; gap: 10px; }
    .bullet-row { display: flex; gap: 8px; align-items: flex-start; }
    .bullet-input { flex: 1; }

    .tags-container { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); }
    .tag { display: inline-flex; align-items: center; gap: 6px; background: var(--accent-dim); color: var(--accent); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .tag-remove { background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
    .tag-input { flex: 1; min-width: 140px; border: none; background: transparent; font-size: 13px; color: var(--text); outline: none; }

    /* Results styling */
    .score-card { text-align: right; }
    .score-value { font-size: 28px; font-weight: 800; color: var(--accent); line-height: 1; }
    .score-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-top: 4px; }
    .score-bar { height: 6px; background: var(--glass-border); border-radius: 3px; overflow: hidden; }
    .score-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--success)); transition: width .4s ease; }

    .copy-all-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
      padding: 14px 18px; border-radius: 10px; background: var(--accent-dim);
      border: 1px solid var(--accent-ring); flex-wrap: wrap;
    }
    .banner-text { font-size: 13px; color: var(--text); }

    .insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .insight-box { background: var(--bg); border: 1px solid var(--glass-border); border-radius: 10px; padding: 16px; }
    .improvements-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .improvement-item { font-size: 13px; color: var(--text); padding-left: 16px; position: relative; }
    .improvement-item::before { content: '✓'; position: absolute; left: 0; color: var(--success); font-weight: 700; }

    .keywords-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .keyword-chip { background: var(--accent-soft); color: var(--accent); padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 600; }

    .content-block { background: var(--bg); border: 1px solid var(--glass-border); border-radius: 10px; padding: 16px; }
    .content-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .content-label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
    .content-box { font-size: 14px; line-height: 1.6; color: var(--text); white-space: pre-line; word-break: break-word; }
    .content-box--tall { min-height: 80px; }

    .skills-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .skill-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--surface-subtle, rgba(255,255,255,0.04)); border: 1px solid var(--glass-border); border-radius: 20px; font-size: 12px; font-weight: 600; color: var(--text); }
    .mini-copy-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; padding: 2px; border-radius: 4px; }
    .mini-copy-btn:hover { color: var(--accent); }
    .featured-tips-list { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .featured-tip-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.5; color: var(--text); padding: 8px 12px; background: var(--surface-subtle, rgba(255,255,255,0.02)); border-radius: 8px; border: 1px solid var(--glass-border); }

    .bullets-list { display: flex; flex-direction: column; gap: 10px; }
    .bullet-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 10px 14px; background: var(--surface-subtle, rgba(255,255,255,0.02)); border: 1px solid var(--glass-border); border-radius: 8px; }
    .bullet-text { flex: 1; font-size: 13px; line-height: 1.5; color: var(--text); }

    .d-flex { display: flex; flex-wrap: wrap; }
    .justify-between { justify-content: space-between; }
    .align-center { align-items: center; }
    .gap-8 { gap: 8px; }
    .mt-4 { margin-top: 4px; }
    .mt-8 { margin-top: 8px; }
    .mt-16 { margin-top: 16px; }
    .mt-20 { margin-top: 20px; }
    .mt-24 { margin-top: 24px; }
    .mb-0 { margin-bottom: 0; }
    .mb-16 { margin-bottom: 16px; }
    .mb-24 { margin-bottom: 24px; }
    .pt-24 { padding-top: 24px; }
    .border-top { border-top: 1px solid var(--glass-border); }
    .text-muted { color: var(--text-muted); }
    .text-accent { color: var(--accent); }
    .text-success { color: var(--success); }
    .text-warning { color: var(--warning); }
    .text-xs { font-size: 11px; }
    .text-sm { font-size: 13px; }
    .flex-1 { flex: 1; }

    @media (max-width: 768px) {
      .insights-grid { grid-template-columns: 1fr; }
      .form-row { flex-direction: column; gap: 12px; }
      .url-input-wrap { min-width: 100%; }
      .page-container { padding: 16px 8px; }
      .section-card { padding: 16px; }
    }
  `]
})
export class LinkedInComponent implements OnInit {
  linkedinUrl = '';
  fetching = signal(false);
  optimizing = signal(false);
  fetchedSource = signal<string | null>(null);
  fetchBlockedMessage = signal<string | null>(null);

  profileInput = signal<LinkedInProfile>({
    headline: '',
    about: '',
    experienceBullets: [''],
    targetRoles: [],
  });

  optimized = signal<OptimizedProfile | null>(null);
  copiedState: { [key: string]: boolean } = {};

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  ngOnInit() {}

  async fetchFromUrl() {
    if (!this.linkedinUrl.trim()) return;
    this.fetching.set(true);
    this.fetchBlockedMessage.set(null);
    this.fetchedSource.set(null);
    try {
      const res = await this.api.post<ApiResponse<LinkedInProfile>>('/linkedin/fetch', { url: this.linkedinUrl.trim() }).toPromise();
      if (res?.data) {
        this.profileInput.set({
          headline: this.asString(res.data.headline),
          about: this.asString(res.data.about),
          experienceBullets: (res.data.experienceBullets?.length ? res.data.experienceBullets : ['']).map(b => this.asString(b)),
          currentRole: this.asString(res.data.currentRole),
          industry: this.asString(res.data.industry),
          targetRoles: (res.data.targetRoles || []).map(r => this.asString(r)).filter(Boolean),
          fullName: this.asString(res.data.fullName),
        });

        if (res.data.fetchBlocked) {
          // LinkedIn blocked the scrape — show inline banner, don't throw
          this.fetchBlockedMessage.set(
            res.data.fetchBlockedMessage ||
            'LinkedIn is blocking automated access. Please fill in your details manually or use \'Auto-fill from Resume\'.'
          );
        } else {
          this.fetchedSource.set(this.translate.instant('LINKEDIN.FETCH_SUCCESS'));
          this.toast.success('LINKEDIN.FETCH_SUCCESS');
        }
      }
    } catch (err: any) {
      const msg = err?.error?.message || this.translate.instant('LINKEDIN.FETCH_ERROR');
      this.toast.error(msg);
    } finally {
      this.fetching.set(false);
    }
  }

  async fetchFromResume() {
    this.fetching.set(true);
    try {
      const res = await this.api.get<ApiResponse<LinkedInProfile>>('/linkedin/from-resume').toPromise();
      if (res?.data) {
        this.profileInput.set({
          headline: this.asString(res.data.headline),
          about: this.asString(res.data.about),
          experienceBullets: (res.data.experienceBullets?.length ? res.data.experienceBullets : ['']).map(b => this.asString(b)),
          currentRole: this.asString(res.data.currentRole),
          industry: this.asString(res.data.industry),
          targetRoles: (res.data.targetRoles || []).map(r => this.asString(r)).filter(Boolean),
          fullName: this.asString(res.data.fullName),
        });
        this.fetchedSource.set(this.translate.instant('LINKEDIN.RESUME_LOAD_SUCCESS'));
        this.toast.success('LINKEDIN.RESUME_LOAD_SUCCESS');
      }
    } catch (err: any) {
      const msg = err?.error?.message || 'Could not load resume data. Please upload a resume first.';
      this.toast.error(msg);
    } finally {
      this.fetching.set(false);
    }
  }

  addBullet() {
    const bullets = [...this.profileInput().experienceBullets, ''];
    this.profileInput.set({ ...this.profileInput(), experienceBullets: bullets });
  }

  removeBullet(index: number) {
    const bullets = this.profileInput().experienceBullets.filter((_, i) => i !== index);
    this.profileInput.set({
      ...this.profileInput(),
      experienceBullets: bullets.length ? bullets : [''],
    });
  }

  addRole(input: HTMLInputElement) {
    const role = input.value.trim();
    if (role && !this.profileInput().targetRoles?.includes(role)) {
      this.profileInput.set({
        ...this.profileInput(),
        targetRoles: [...(this.profileInput().targetRoles || []), role],
      });
      input.value = '';
    }
  }

  removeRole(index: number) {
    const roles = (this.profileInput().targetRoles || []).filter((_, i) => i !== index);
    this.profileInput.set({ ...this.profileInput(), targetRoles: roles });
  }

  async optimize() {
    const { headline, about, experienceBullets } = this.profileInput();

    if (!headline.trim() && !about.trim() && !experienceBullets.some(b => b.trim())) {
      this.toast.show(this.translate.instant('LINKEDIN.ERROR_EMPTY'), 'error');
      return;
    }

    this.optimizing.set(true);
    try {
      const response = await this.api.post<ApiResponse<OptimizedProfile>>('/linkedin/optimize', this.profileInput()).toPromise();
      if (response && response.data) {
        this.optimized.set(response.data);
        this.toast.show(this.translate.instant('LINKEDIN.OPTIMIZED_SUCCESS'), 'success');
      }
    } catch (err: any) {
      const message = err?.error?.message || this.translate.instant('LINKEDIN.OPTIMIZE_ERROR');
      this.toast.show(message, 'error');
    } finally {
      this.optimizing.set(false);
    }
  }

  asString(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '[object Object]' ? '' : trimmed;
    }
    if (typeof val === 'object') {
      return (val.name || val.title || val.position || val.role || val.skill || val.keyword || val.text || '').trim();
    }
    return String(val);
  }

  getBulletsString(): string {
    const bullets = this.optimized()?.experienceBullets || [];
    return bullets.map(b => this.asString(b)).filter(Boolean).join('\n\n');
  }

  getSkillsListString(): string {
    const skills = this.optimized()?.skills || [];
    return skills.map(s => this.asString(s)).filter(Boolean).join(', ');
  }

  copyToClipboard(text: string): Promise<void> {
    if (!text) return Promise.resolve();
    return navigator.clipboard.writeText(text).then(() => {
      this.toast.show('COMMON.COPIED', 'success');
    });
  }

  copyPart(key: string, text: string) {
    if (!text) return;
    this.copyToClipboard(text).then(() => {
      this.copiedState[key] = true;
      setTimeout(() => { this.copiedState[key] = false; }, 2000);
    });
  }

  copyAll() {
    const opt = this.optimized();
    if (!opt) return;

    const sections = [
      `=== OPTIMIZED LINKEDIN HEADLINE ===\n${this.asString(opt.headline)}`,
      `=== OPTIMIZED ABOUT SUMMARY ===\n${this.asString(opt.about)}`,
      `=== KEY EXPERIENCE HIGHLIGHTS ===\n${(opt.experienceBullets || []).map(b => `• ${this.asString(b)}`).join('\n\n')}`,
    ];

    if (opt.skills?.length) {
      sections.push(`=== TOP RECOMMENDED LINKEDIN SKILLS ===\n${opt.skills.map(s => this.asString(s)).filter(Boolean).join(', ')}`);
    }

    if (opt.keywordsAdded?.length) {
      sections.push(`=== RECOMMENDED SEO KEYWORDS ===\n${opt.keywordsAdded.map(k => this.asString(k)).filter(Boolean).join(', ')}`);
    }

    if (opt.featuredTips?.length) {
      sections.push(`=== FEATURED SECTION RECOMMENDATIONS ===\n${opt.featuredTips.map(t => `• ${this.asString(t)}`).filter(Boolean).join('\n')}`);
    }

    if (opt.tips?.length) {
      sections.push(`=== PROFILE VISIBILITY CHECKLIST ===\n${opt.tips.map(t => `✓ ${this.asString(t)}`).filter(Boolean).join('\n')}`);
    }

    this.copyPart('all', sections.join('\n\n\n'));
  }

  editInputs() {
    this.optimized.set(null);
  }

  reset() {
    this.linkedinUrl = '';
    this.fetchedSource.set(null);
    this.fetchBlockedMessage.set(null);
    this.profileInput.set({
      headline: '',
      about: '',
      experienceBullets: [''],
      targetRoles: [],
    });
    this.optimized.set(null);
  }
}
