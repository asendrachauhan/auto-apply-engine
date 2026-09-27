/**
 * Job Alerts Page — "Find + Prepare + Notify" flow.
 * Shows all discovered jobs with tailored resume + prefill packet.
 * User clicks job link and manually applies — we've done all the prep.
 */
import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring/progress-ring.component';
import { GhostScoreComponent } from '../../shared/components/ghost-score/ghost-score.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-job-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, NeoButtonComponent, StatusBadgeComponent, ProgressRingComponent, GhostScoreComponent, IconComponent],
  template: `
    <div class="page-container">

      <!-- Header -->
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">{{ 'ALERTS.TITLE' | translate }}</h1>
          <p class="page-subtitle">{{ 'ALERTS.SUBTITLE' | translate }}</p>
        </div>
        <div class="d-flex gap-8 flex-wrap">
          <aa-button variant="secondary" size="sm" (clicked)="loadAlerts()" icon="refresh">{{ 'ALERTS.REFRESH' | translate }}</aa-button>
          <aa-button [loading]="running()" (clicked)="runPipeline()" icon="search">{{ 'ALERTS.FIND_NEW_JOBS' | translate }}</aa-button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="alert-stats">
        @for (s of stats(); track s.label) {
          <div class="stat-chip neo-sm">
            <aa-icon [name]="s.icon" [size]="16" class="stat-chip-icon"/>
            <span class="stat-chip-val">{{ s.val }}</span>
            <span class="stat-chip-lbl">{{ s.label | translate }}</span>
          </div>
        }
      </div>

      <!-- How it works banner -->
      @if (alerts().length === 0 && !loading()) {
        <div class="how-it-works neo">
          <div class="how-title">{{ 'ALERTS.HOW_IT_WORKS' | translate }}</div>
          <div class="how-steps">
            @for (step of howSteps; track step.n) {
              <div class="how-step">
                <div class="how-step-n">{{ step.n }}</div>
                <aa-icon [name]="step.icon" [size]="24" class="how-step-icon"/>
                <div class="how-step-text">{{ step.text | translate }}</div>
              </div>
            }
          </div>
          <div class="how-legal">
            <aa-icon name="shield" [size]="14"/>
            {{ 'ALERTS.LEGAL_NOTE' | translate }}
          </div>
          <aa-button [loading]="running()" (clicked)="runPipeline()" icon="search">
            {{ 'ALERTS.FIND_MATCHES' | translate }}
          </aa-button>
        </div>
      }

      <!-- Filters -->
      @if (alerts().length > 0) {
        <div class="filters-bar neo-sm">
          <div class="filter-group status-group">
            <span class="filter-label">Status</span>
            <div class="filter-chips">
              @for (f of filters; track f.val) {
                <button class="filter-btn" [class.active]="activeFilter() === f.val"
                  (click)="setFilter(f.val)">
                  {{ f.label | translate }}
                </button>
              }
            </div>
          </div>

          <div class="filter-group">
            <span class="filter-label">Source</span>
            <select class="filter-select" [ngModel]="activePlatform()" (ngModelChange)="setPlatform($event)" aria-label="Filter by source platform">
              @for (p of platforms; track p.val) {
                <option [value]="p.val">{{ p.label }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <span class="filter-label">Date</span>
            <select class="filter-select" [ngModel]="activeDate()" (ngModelChange)="setDate($event)" aria-label="Filter by posting date">
              @for (d of dateFilters; track d.val) {
                <option [value]="d.val">{{ d.label }}</option>
              }
            </select>
          </div>

          <div class="filter-score">
            <span class="filter-label">{{ 'ALERTS.MIN_SCORE' | translate }}</span>
            <input type="range" min="50" max="95" step="5" [(ngModel)]="minScore"
              (input)="applyFilters()" (change)="applyFilters()" class="score-range"
              [style.--slider-fill]="((minScore - 50) / (95 - 50) * 100) + '%'"
              aria-label="Minimum match score">
            <span class="score-range-val text-accent fw-700">{{ minScore }}%</span>
          </div>

          <div class="filter-actions-right">
            @if (hasActiveFilters()) {
              <button class="filter-reset-btn" (click)="resetFilters()" title="Reset all filters">
                <aa-icon name="close" [size]="12"/> Reset
              </button>
            }
            <span class="filter-count text-muted text-xs">
              {{ filteredAlerts().length }} of {{ alerts().length }}
            </span>
          </div>
        </div>
      }


      <!-- Loading skeletons -->
      @if (loading()) {
        <div class="alerts-grid">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="skeleton alert-skeleton"></div>
          }
        </div>
      }

      <!-- Alerts grid -->
      @if (!loading() && filteredAlerts().length > 0) {
        <div class="alerts-grid">
          @for (alert of filteredAlerts(); track alert._id) {
            <div class="alert-card neo" [class]="getScoreClass(alert.matchScore)"
              [class.selected]="selectedAlert()?._id === alert._id"
              role="button" tabindex="0"
              [attr.aria-label]="alert.title + ' at ' + alert.company + ', view details'"
              (click)="openAlert(alert)"
              (keydown.enter)="onCardKey($event, alert)" (keydown.space)="onCardKey($event, alert)">

              <!-- Score badge -->
              <div class="score-badge" [style.background]="scoreGradient(alert.matchScore)">
                {{ alert.matchScore }}%
              </div>

              <!-- Job info -->
              <div class="alert-header">
                <div class="company-avatar">{{ alert.company[0] }}</div>
                <div class="alert-job-info">
                  <div class="alert-title">{{ alert.title }}</div>
                  <div class="alert-company">{{ alert.company }}</div>
                  <div class="alert-meta">
                    <span class="meta-tag">{{ alert.location }}</span>
                    <span class="meta-tag source">{{ platformLabel(alert.source, alert.sourcePlatform) }}</span>
                    <span class="meta-tag date" [class.fresh]="isFresh(alert.postedAt || alert.createdAt)" [title]="'Posted: ' + formatFullDate(alert.postedAt || alert.createdAt)">
                      <aa-icon name="clock" [size]="10"/>
                      {{ 'Posted ' + timeAgo(alert.postedAt || alert.createdAt) }}
                    </span>
                    @if (alert.salary) { <span class="meta-tag">{{ alert.salary }}</span> }
                  </div>
                </div>
              </div>

              <!-- Match reasons -->
              @if (alert.matchReasons?.length) {
                <div class="reasons-preview">
                  @for (r of alert.matchReasons.slice(0,2); track r) {
                    <div class="reason-row"><aa-icon name="check" [size]="12" class="reason-check"/>{{ r }}</div>
                  }
                </div>
              }

              <!-- Status + time -->
              <div class="alert-footer">
                <span class="alert-status-badge" [class]="alert.status">
                  {{ statusLabel(alert.status) }}
                </span>
                <span class="alert-time text-muted text-xs">{{ timeAgo(alert.createdAt) }}</span>
              </div>
              @if (alert.ghostScore !== null && alert.ghostScore !== undefined) {
                <aa-ghost-score [ghostScore]="alert.ghostScore" class="mb-8"/>
              }

              <!-- Action buttons -->
              <div class="alert-actions" (click)="$event.stopPropagation()">
                <aa-button variant="primary" size="sm" (clicked)="openAlert(alert)" icon="fileEdit">
                  {{ 'ALERTS.VIEW_PACKET' | translate }}
                </aa-button>
                <aa-button variant="secondary" size="sm" (clicked)="openJobLink(alert)" iconRight="externalLink">
                  {{ 'ALERTS.APPLY' | translate }}
                </aa-button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Empty state after filter -->
      @if (!loading() && alerts().length > 0 && filteredAlerts().length === 0) {
        <div class="empty-filtered neo" style="text-align:center;padding:40px;">
          <aa-icon name="search" [size]="36" style="color:var(--text-light);margin-bottom:10px;"/>
          <div style="font-weight:700;font-size:15px;color:var(--text);">{{ 'ALERTS.NO_ALERTS_MATCH' | translate }}</div>
          <div class="text-muted text-sm mt-8">{{ 'ALERTS.TRY_LOWER_SCORE' | translate }}</div>
        </div>
      }
    </div>

    <!-- Alert Detail Panel -->
    @if (selectedAlert()) {
      <div class="panel-overlay" (click)="closePanel($event)">
        <div class="detail-panel neo anim-slide-in-right">

          <!-- Panel header -->
          <div class="panel-header">
            <div>
              <div class="panel-title">{{ selectedAlert()!.title }}</div>
              <div class="panel-company">{{ selectedAlert()!.company }}</div>
              <div class="panel-posted-meta text-xs text-muted mt-4 d-flex align-center gap-6">
                <span class="meta-tag date" [class.fresh]="isFresh(selectedAlert()!.postedAt || selectedAlert()!.createdAt)">
                  <aa-icon name="clock" [size]="11"/>
                  <strong>Posted:</strong> {{ timeAgo(selectedAlert()!.postedAt || selectedAlert()!.createdAt) }}
                  <span class="text-muted">({{ formatFullDate(selectedAlert()!.postedAt || selectedAlert()!.createdAt) }})</span>
                </span>
              </div>
            </div>
            <button class="panel-close" (click)="selectedAlert.set(null)" aria-label="Close"><aa-icon name="close" [size]="16"/></button>
          </div>

          <!-- Score ring -->
          <div class="panel-score">
            <aa-progress-ring
              [percent]="selectedAlert()!.matchScore"
              [size]="90"
              [color]="scoreColor(selectedAlert()!.matchScore)"
            />
            <div class="panel-score-meta">
              <div class="fw-700" style="font-size:16px;color:var(--text);">
                {{ getScoreLabel(selectedAlert()!.matchScore) }}
              </div>
              <div class="text-muted text-sm">{{ 'ALERTS.VIA' | translate }} {{ platformLabel(selectedAlert()!.source, selectedAlert()!.sourcePlatform) }}</div>
              @if (selectedAlert()!.salary) {
                <div class="text-sm fw-600 text-accent mt-8">{{ selectedAlert()!.salary }}</div>
              }
              @if (selectedAlert()!.ghostScore !== null && selectedAlert()!.ghostScore !== undefined) {
                <div class="mt-8"><aa-ghost-score [ghostScore]="selectedAlert()!.ghostScore"/></div>
              }
            </div>
          </div>

          <!-- Panel tabs -->
          <div class="panel-tabs">
            @for (tab of tabs; track tab.id) {
              <button class="panel-tab" [class.active]="activeTab() === tab.id"
                (click)="activeTab.set(tab.id)">
                <aa-icon [name]="tab.icon" [size]="14"/> {{ tab.label | translate }}
              </button>
            }
          </div>

          <!-- Tab: Application Packet -->
          @if (activeTab() === 'packet') {
            <div class="tab-content anim-fade-in">
              <div class="packet-section">
                <div class="packet-section-title">{{ 'ALERTS.PREFILLED_FIELDS' | translate }}</div>
                <div class="fields-list">
                  @for (field of selectedAlert()!.prefillFields; track field.fieldName) {
                    <div class="field-row">
                      <div class="field-name">{{ field.fieldName }}</div>
                      <div class="field-value">{{ field.value }}</div>
                      <button class="copy-btn" (click)="copyText(field.value, field.fieldName)">
                        <aa-icon [name]="copiedField() === field.fieldName ? 'check' : 'copy'" [size]="14"/>
                      </button>
                    </div>
                  }
                </div>
              </div>

              <div class="packet-section">
                <div class="packet-section-title d-flex justify-between align-center">
                  {{ 'ALERTS.COVER_LETTER' | translate }}
                  <aa-button variant="ghost" size="sm"
                    [icon]="copiedField() === 'Cover Letter' ? 'check' : 'copy'"
                    (clicked)="copyText(selectedAlert()!.coverLetter || '', 'Cover Letter')">
                    {{ copiedField() === 'Cover Letter' ? ('ALERTS.COPIED' | translate) : ('ALERTS.COPY' | translate) }}
                  </aa-button>
                </div>
                <div class="cover-letter-box">{{ selectedAlert()!.coverLetter }}</div>
              </div>

              <div class="packet-section">
                <div class="packet-section-title">{{ 'ALERTS.COPY_EVERYTHING' | translate }}</div>
                <div class="copy-all-box">
                  <pre class="prefill-card">{{ selectedAlert()!.prefillCard }}</pre>
                  <aa-button variant="secondary" [fullWidth]="true"
                    [icon]="copiedField() === 'Full Packet' ? 'checkCircle' : 'copy'"
                    (clicked)="copyText(selectedAlert()!.prefillCard || '', 'Full Packet')">
                    {{ copiedField() === 'Full Packet' ? ('ALERTS.COPIED_FULL' | translate) : ('ALERTS.COPY_FULL_PACKET' | translate) }}
                  </aa-button>
                </div>
              </div>
            </div>
          }

          <!-- Tab: Tailored Resume -->
          @if (activeTab() === 'resume') {
            <div class="tab-content anim-fade-in">
              <div class="resume-actions">
                <aa-button [loading]="loadingPdf()" (clicked)="downloadPDF()" icon="download">{{ 'ALERTS.DOWNLOAD_PDF' | translate }}</aa-button>
              </div>
              @if (selectedAlert()!.tailoredResume?.summary) {
                <div class="packet-section">
                  <div class="packet-section-title">{{ 'ALERTS.TAILORED_SUMMARY' | translate }}</div>
                  <div class="tailored-summary">{{ selectedAlert()!.tailoredResume!.summary }}</div>
                </div>
              }
              @if (selectedAlert()!.keywordsToHighlight?.length) {
                <div class="packet-section">
                  <div class="packet-section-title">{{ 'ALERTS.KEYWORDS_ADDED' | translate }}</div>
                  <div class="chips-wrap">
                    @for (k of selectedAlert()!.keywordsToHighlight; track k) {
                      <span class="chip chip-accent">{{ k }}</span>
                    }
                  </div>
                </div>
              }
              @if (selectedAlert()!.missingSkills?.length) {
                <div class="packet-section">
                  <div class="packet-section-title">{{ 'ALERTS.GAPS_TO_ADDRESS' | translate }}</div>
                  <div class="chips-wrap">
                    @for (s of selectedAlert()!.missingSkills; track s) {
                      <span class="chip" style="border:1px solid var(--warning);color:var(--warning);">{{ s }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Tab: Apply Guide -->
          @if (activeTab() === 'guide') {
            <div class="tab-content anim-fade-in">
              <div class="match-reasons">
                <div class="packet-section-title">{{ 'ALERTS.WHY_YOU_MATCH' | translate }}</div>
                @for (r of selectedAlert()!.matchReasons; track r) {
                  <div class="guide-reason"><aa-icon name="check" [size]="13" class="guide-check"/>{{ r }}</div>
                }
              </div>
              <div class="apply-steps-guide">
                <div class="packet-section-title">{{ 'ALERTS.STEPS_TO_APPLY' | translate }}</div>
                <div class="steps-numbered">
                  <div class="step-n"><span class="sn">1</span><span>{{ 'ALERTS.STEP_OPEN_LINK' | translate }}</span></div>
                  <div class="step-n"><span class="sn">2</span><span>{{ 'ALERTS.STEP_CLICK_APPLY' | translate }}</span></div>
                  <div class="step-n"><span class="sn">3</span><span>{{ 'ALERTS.STEP_UPLOAD_PDF' | translate }}</span></div>
                  <div class="step-n"><span class="sn">4</span><span>{{ 'ALERTS.STEP_COPY_PASTE' | translate }}</span></div>
                  <div class="step-n"><span class="sn">5</span><span>{{ 'ALERTS.STEP_SUBMIT' | translate }}</span></div>
                </div>
              </div>
            </div>
          }

          <!-- Panel footer actions -->
          <div class="panel-footer-actions">
            <aa-button [fullWidth]="true" (clicked)="openJobLink(selectedAlert()!)" iconRight="externalLink">
              {{ 'ALERTS.OPEN_APPLY' | translate }}
            </aa-button>
            <div class="panel-status-row">
              <span class="text-muted text-xs">{{ 'ALERTS.MARK_AS' | translate }}</span>
              @for (s of ['applied','ignored']; track s) {
                <button class="status-chip"
                  [class.active-status]="selectedAlert()!.status === s"
                  (click)="markStatus(selectedAlert()!, s)">
                  {{ s === 'applied' ? ('ALERTS.APPLIED_LABEL' | translate) : ('ALERTS.IGNORE' | translate) }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Stats row */
    .alert-stats { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
    .stat-chip { padding:10px 16px; display:flex; align-items:center; gap:8px; border-radius:var(--radius-pill); }
    .stat-chip-icon { color:var(--accent); }
    .stat-chip-val  { font-family:var(--font-display); font-size:18px; font-weight:800; color:var(--text); }
    .stat-chip-lbl  { font-size:11px; color:var(--text-muted); font-weight:500; }

    /* How it works */
    .how-it-works { padding:28px; margin-bottom:24px; }
    .how-title    { font-family:var(--font-display); font-size:18px; font-weight:700; color:var(--text); margin-bottom:20px; text-align:center; }
    .how-steps    { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px; }
    @media(max-width:768px){ .how-steps{ grid-template-columns:repeat(2,1fr); } }
    .how-step     { text-align:center; padding:16px 12px; border-radius:12px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); display:flex; flex-direction:column; align-items:center; }
    .how-step-n   { font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--accent); margin-bottom:6px; }
    .how-step-icon{ color:var(--accent); margin-bottom:8px; }
    .how-step-text{ font-size:12px; color:var(--text); font-weight:600; line-height:1.4; }
    .how-legal    { background:var(--success-hover); border-radius:10px; padding:12px 16px; font-size:12px; color:var(--text); margin-bottom:20px; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px; }

    /* Filters */
    .filters-bar { display:flex; align-items:center; gap:12px; padding:12px 18px; margin-bottom:20px; flex-wrap:wrap; }
    .filter-group { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .filter-label { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.6px; white-space:nowrap; }
    .filter-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .filter-btn  { padding:6px 14px; border-radius:var(--radius-pill); border:none; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); font-size:12px; font-weight:600; cursor:pointer; color:var(--text-muted); transition:all .2s; }
    .filter-btn:hover { color:var(--text); background:var(--surface-hover); }
    .filter-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .filter-btn.active { box-shadow:var(--neo-inset); color:var(--accent); }
    .filter-select {
      padding:6px 14px;
      border-radius:var(--radius-pill);
      border:1px solid var(--glass-border);
      background:var(--bg);
      color:var(--text);
      font-size:12px;
      font-weight:600;
      box-shadow:var(--neo-sm);
      cursor:pointer;
      outline:none;
      transition:all .2s;
    }
    .filter-select:hover { border-color:var(--accent); }
    .filter-select:focus-visible { border-color:var(--accent); outline:2px solid var(--accent-dim); }
    .filter-score{ display:flex; align-items:center; gap:8px; }
    .score-range { width:90px; accent-color:var(--accent); cursor:pointer; }
    .score-range-val { font-size:13px; font-weight:800; min-width:32px; }
    .filter-actions-right { margin-left:auto; display:flex; align-items:center; gap:10px; }
    .filter-reset-btn {
      display:inline-flex; align-items:center; gap:4px;
      padding:5px 12px; border-radius:var(--radius-pill);
      border:1px dashed var(--danger); background:var(--bg);
      color:var(--danger); font-size:11px; font-weight:700;
      cursor:pointer; transition:all .2s;
    }
    .filter-reset-btn:hover { background:var(--danger-hover); }
    .filter-count { font-weight:600; white-space:nowrap; }
    @media(max-width:768px) {
      .filters-bar { gap:10px; padding:10px 14px; }
      .filter-actions-right { margin-left:0; width:100%; justify-content:space-between; }
    }

    /* Alerts grid */
    .alerts-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr)); gap:16px; }
    .alert-skeleton{ height:200px; border-radius:var(--radius); }

    /* Alert card */
    .alert-card  { padding:18px; cursor:pointer; transition:transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out); position:relative; overflow:hidden; }
    .alert-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .alert-card:hover { transform:translateY(-2px); box-shadow:var(--neo-float); }
    .alert-card.high   { border-left:4px solid var(--success); }
    .alert-card.medium { border-left:4px solid var(--warning); }
    .alert-card.low    { border-left:4px solid var(--text-light); }
    .alert-card.selected { box-shadow:var(--neo-inset); }

    .score-badge {
      position:absolute; top:14px; right:14px;
      padding:4px 10px; border-radius:var(--radius-pill);
      font-family:var(--font-display); font-size:13px; font-weight:800; color:#fff;
    }

    .alert-header { display:flex; gap:12px; margin-bottom:12px; }
    .company-avatar {
      width:44px; height:44px; border-radius:12px; flex-shrink:0;
      background:linear-gradient(135deg,var(--accent),var(--accent-secondary));
      color:#fff; display:flex; align-items:center; justify-content:center;
      font-weight:800; font-size:17px;
    }
    .alert-job-info { flex:1; min-width:0; padding-right:50px; }
    .alert-title    { font-size:14px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .alert-company  { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .alert-meta     { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
    .meta-tag { font-size:10px; font-weight:600; padding:2px 7px; border-radius:var(--radius-pill); background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); color:var(--text-muted); }
    .meta-tag.source { color:var(--accent); background:var(--accent-dim); box-shadow:none; }
    .meta-tag.date { display:inline-flex; align-items:center; gap:3px; color:var(--text); background:var(--surface-hover); }
    .meta-tag.date.fresh { color:var(--success-text); background:var(--success-soft); border-color:var(--success); font-weight:700; }

    .reasons-preview { margin-bottom:10px; }
    .reason-row      { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--text); margin-bottom:4px; line-height:1.4; }
    .reason-check    { color:var(--success); flex-shrink:0; }

    .alert-footer { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .alert-status-badge { font-size:10px; font-weight:700; padding:3px 9px; border-radius:var(--radius-pill); }
    .alert-status-badge.pending  { background:var(--warning-soft);  color:var(--warning-text); }
    .alert-status-badge.notified { background:var(--accent-dim);     color:var(--accent); }
    .alert-status-badge.opened   { background:var(--success-soft);  color:var(--success-text); }
    .alert-status-badge.applied  { background:var(--success-soft);   color:var(--success-text); }
    .alert-status-badge.ignored  { background:var(--divider); color:var(--text-muted); }

    .alert-actions { display:flex; gap:8px; }

    /* Detail Panel */
    .panel-overlay { position:fixed; inset:0; background:var(--shadow-overlay-heavy); backdrop-filter:blur(6px); z-index:200; display:flex; justify-content:flex-end; }
    .detail-panel  {
      width:min(480px,100vw); height:100vh; overflow-y:auto;
      padding:24px 22px; display:flex; flex-direction:column; gap:14px;
      border-radius:0;
    }
    .panel-header  { display:flex; justify-content:space-between; align-items:flex-start; }
    .panel-title   { font-size:17px; font-weight:800; color:var(--text); }
    .panel-company { font-size:13px; color:var(--text-muted); margin-top:3px; }
    .panel-close   { background:none; border:none; cursor:pointer; color:var(--text-muted); flex-shrink:0; display:flex; padding:6px; border-radius:8px; }
    .panel-close:hover { color:var(--text); background:var(--surface-hover); }
    .panel-close:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

    .panel-score { display:flex; align-items:center; gap:18px; padding:16px; border-radius:12px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); }
    .panel-score-meta { flex:1; }

    .panel-tabs { display:flex; gap:4px; border-radius:var(--radius-sm); background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); padding:4px; }
    .panel-tab  { flex:1; padding:8px 6px; border:none; border-radius:8px; background:transparent; font-size:12px; font-weight:600; cursor:pointer; color:var(--text-muted); transition:all .2s; display:flex; align-items:center; justify-content:center; gap:6px; }
    .panel-tab:hover { color:var(--text); background:var(--surface-hover); }
    .panel-tab:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
    .panel-tab.active { background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-raised); color:var(--accent); }

    .tab-content { display:flex; flex-direction:column; gap:12px; }

    .packet-section { background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); border-radius:12px; padding:14px; }
    .packet-section-title { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.6px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; }

    .fields-list   { display:flex; flex-direction:column; gap:6px; }
    .field-row     { display:flex; align-items:center; gap:8px; padding:8px; border-radius:8px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); }
    .field-name    { font-size:11px; font-weight:600; color:var(--text-muted); min-width:100px; flex-shrink:0; }
    .field-value   { flex:1; font-size:12px; color:var(--text); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .copy-btn      { background:none; border:none; cursor:pointer; color:var(--text-muted); flex-shrink:0; transition:transform .15s; display:flex; }
    .copy-btn:active { transform:scale(1.3); }

    .cover-letter-box { font-size:12px; color:var(--text); line-height:1.7; max-height:160px; overflow-y:auto; white-space:pre-wrap; }
    .copy-all-box     { display:flex; flex-direction:column; gap:10px; }
    .prefill-card     { font-size:10px; color:var(--text); background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); border-radius:8px; padding:10px; max-height:200px; overflow-y:auto; white-space:pre-wrap; font-family:monospace; }

    .resume-actions    { display:flex; gap:8px; margin-bottom:10px; }
    .tailored-summary  { font-size:13px; color:var(--text); line-height:1.7; }

    .guide-reason { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text); margin-bottom:8px; line-height:1.5; }
    .guide-check  { color:var(--success); flex-shrink:0; }
    .steps-numbered   { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
    .step-n           { display:flex; align-items:flex-start; gap:10px; font-size:13px; color:var(--text); }
    .sn { background:linear-gradient(135deg,var(--accent),var(--accent-secondary)); color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; flex-shrink:0; }

    .panel-footer-actions { display:flex; flex-direction:column; gap:10px; margin-top:auto; padding-top:12px; border-top:1px solid var(--divider); }
    .panel-status-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .status-chip { padding:6px 14px; border-radius:var(--radius-pill); border:none; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); font-size:12px; font-weight:600; cursor:pointer; color:var(--text-muted); transition:all .2s; }
    .status-chip.active-status { box-shadow:var(--neo-inset); color:var(--accent); }
  `]
})
export class JobAlertsComponent implements OnInit {
  alerts        = signal<any[]>([]);
  filteredAlerts= signal<any[]>([]);
  loading       = signal(true);
  running       = signal(false);
  selectedAlert = signal<any>(null);
  activeTab     = signal('packet');
  copiedField   = signal('');
  loadingPdf    = signal(false);
  activeFilter   = signal('all');
  activePlatform = signal('all');
  activeDate     = signal('all');
  minScore       = 65;

  platforms = [
    { val: 'all',       label: 'All Sources' },
    { val: 'indeed',    label: 'Indeed' },
    { val: 'linkedin',  label: 'LinkedIn' },
    { val: 'naukri',    label: 'Naukri' },
    { val: 'adzuna',    label: 'Adzuna' },
    { val: 'himalayas', label: 'Himalayas' },
    { val: 'remotive',  label: 'Remotive' },
    { val: 'other',     label: 'Other Boards' },
  ];

  dateFilters = [
    { val: 'all', label: 'All Time' },
    { val: '1h',  label: 'Last 1 Hour (<60m)' },
    { val: '24h', label: 'Last 24 Hours' },
    { val: '3d',  label: 'Last 3 Days' },
    { val: '7d',  label: 'Last 7 Days' },
    { val: '14d', label: 'Last 14 Days' },
    { val: '30d', label: 'Last 30 Days' },
  ];

  hasActiveFilters = computed(() => {
    return this.activeFilter() !== 'all' ||
      this.activePlatform() !== 'all' ||
      this.activeDate() !== 'all' ||
      this.minScore !== 65;
  });

  statsData     = signal<any>(null);
  stats = computed(() => [
    { icon:'target',        val: this.statsData()?.total        || 0, label:'ALERTS.TOTAL_FOUND'  },
    { icon:'bell',          val: this.statsData()?.notified     || 0, label:'ALERTS.NOTIFIED'     },
    { icon:'checkCircle',   val: this.statsData()?.applied      || 0, label:'ALERTS.YOU_APPLIED'  },
    { icon:'star',          val: (this.statsData()?.avgMatchScore||0)+'%', label:'ALERTS.AVG_SCORE'  },
  ]);

  filters = [
    { val:'all',      label:'ALERTS.FILTER_ALL'      },
    { val:'notified', label:'ALERTS.FILTER_NEW'       },
    { val:'opened',   label:'ALERTS.FILTER_OPENED'    },
    { val:'applied',  label:'ALERTS.FILTER_APPLIED'   },
    { val:'ignored',  label:'ALERTS.FILTER_IGNORED'   },
  ];

  tabs = [
    { id:'packet', icon:'fileEdit',    label:'ALERTS.TAB_PACKET' },
    { id:'resume', icon:'resume',      label:'ALERTS.TAB_RESUME' },
    { id:'guide',  icon:'checkCircle', label:'ALERTS.TAB_GUIDE'  },
  ];

  howSteps = [
    { n:1, icon:'search',        text:'ALERTS.STEP_1' },
    { n:2, icon:'target',        text:'ALERTS.STEP_2' },
    { n:3, icon:'fileEdit',      text:'ALERTS.STEP_3' },
    { n:4, icon:'messageCircle', text:'ALERTS.STEP_4' },
  ];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    public translate: TranslateService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadAlerts();
    this.api.getAlertStats().subscribe({ next: (r: any) => this.statsData.set(r.data) });

    // Handle deep-linked alert ID from notification clicks (/alerts/:id or /alerts?alertId=...)
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) this.fetchAndOpenAlert(id);
    });
    this.route.queryParams.subscribe(query => {
      const id = query['id'] || query['alertId'];
      if (id) this.fetchAndOpenAlert(id);
    });
  }

  fetchAndOpenAlert(id: string): void {
    this.api.getAlert(id).subscribe({
      next: (r: any) => {
        if (r.data) {
          this.selectedAlert.set(r.data);
          this.activeTab.set('packet');
        }
      },
      error: () => {},
    });
  }

  loadAlerts(silent = false): void {
    if (!silent) this.loading.set(true);
    this.api.getAlerts({ limit: 50 }).subscribe({
      next: (r: any) => {
        this.alerts.set(r.data || []);
        this.applyFilters();
        if (!silent) this.loading.set(false);
      },
      error: () => {
        if (!silent) this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    let list = this.alerts();

    // 1. Status Filter
    if (this.activeFilter() !== 'all') {
      list = list.filter(a => a.status === this.activeFilter());
    }

    // 2. Platform / Source Filter
    if (this.activePlatform() !== 'all') {
      const p = this.activePlatform().toLowerCase();
      list = list.filter(a => {
        const src = (a.source || '').toLowerCase();
        const srcPlat = (a.sourcePlatform || '').toLowerCase();
        const url = (a.jobUrl || '').toLowerCase();
        if (p === 'other') {
          const known = ['indeed', 'linkedin', 'naukri', 'adzuna', 'himalayas', 'remotive'];
          return !known.some(k => src.includes(k) || srcPlat.includes(k) || url.includes(k));
        }
        return src.includes(p) || srcPlat.includes(p) || url.includes(p);
      });
    }

    // 3. Date / Recency Filter
    if (this.activeDate() !== 'all') {
      const now = Date.now();
      let maxAgeMs = 0;
      if (this.activeDate() === '1h') maxAgeMs = 60 * 60 * 1000;
      else if (this.activeDate() === '24h') maxAgeMs = 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '3d') maxAgeMs = 3 * 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '14d') maxAgeMs = 14 * 24 * 60 * 60 * 1000;
      else if (this.activeDate() === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

      if (maxAgeMs > 0) {
        list = list.filter(a => {
          const raw = a.postedAt || a.createdAt || a.appliedAt;
          const d = raw ? new Date(raw).getTime() : 0;
          return d > 0 && (now - d) <= maxAgeMs;
        });
      }
    }

    // 4. Match Score Filter
    list = list.filter(a => (a.matchScore || 0) >= this.minScore);

    // Sort by recency (newest posted first)
    list.sort((a, b) => {
      const tA = new Date(a.postedAt || a.createdAt).getTime();
      const tB = new Date(b.postedAt || b.createdAt).getTime();
      return tB - tA;
    });

    this.filteredAlerts.set(list);
  }

  setFilter(f: string): void { this.activeFilter.set(f); this.applyFilters(); }
  setPlatform(p: string): void { this.activePlatform.set(p); this.applyFilters(); }
  setDate(d: string): void { this.activeDate.set(d); this.applyFilters(); }
  resetFilters(): void {
    this.activeFilter.set('all');
    this.activePlatform.set('all');
    this.activeDate.set('all');
    this.minScore = 65;
    this.applyFilters();
  }

  runPipeline(): void {
    this.running.set(true);
    this.api.runAlertPipeline().subscribe({
      next: () => {
        this.toast.success('Job discovery started in background — searching all 8 job platforms...');
        let attempts = 0;
        const initialCount = this.alerts().length;
        const pollInterval = setInterval(() => {
          attempts++;
          // Silent polling prevents screen skeleton flicker every cycle
          this.loadAlerts(true);
          const currentCount = this.alerts().length;
          if (currentCount > initialCount) {
            const added = currentCount - initialCount;
            this.toast.success(`Job discovery finished! Found and prepared ${added} new job match(es).`);
            clearInterval(pollInterval);
            this.running.set(false);
            this.api.getAlertStats().subscribe({ next: (r: any) => this.statsData.set(r.data) });
          } else if (attempts >= 18) {
            // 18 * 4000ms = 72 seconds
            clearInterval(pollInterval);
            this.running.set(false);
            this.loadAlerts(true);
            this.toast.info('Job discovery completed. Latest alerts and matches are displayed.');
          }
        }, 4000);
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || 'Job discovery pipeline failed');
        this.running.set(false);
      },
    });
  }

  openAlert(alert: any): void {
    this.api.getAlert(alert._id).subscribe({
      next: (r: any) => {
        this.selectedAlert.set(r.data);
        this.activeTab.set('packet');
        this.alerts.update(list => list.map(a => a._id === alert._id ? { ...a, status: r.data.status } : a));
      },
      error: () => { this.selectedAlert.set(alert); this.activeTab.set('packet'); },
    });
  }
  onCardKey(event: Event, alert: any): void {
    if (event.target !== event.currentTarget) return; // let nested buttons handle their own activation
    event.preventDefault();
    this.openAlert(alert);
  }

  closePanel(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('panel-overlay')) {
      this.selectedAlert.set(null);
    }
  }
  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.selectedAlert()) this.selectedAlert.set(null); }

  openJobLink(alert: any): void {
    window.open(alert.jobUrl, '_blank');
    this.markStatus(alert, 'opened');
  }

  markStatus(alert: any, status: string): void {
    this.api.updateAlertStatus(alert._id, status).subscribe({
      next: (r: any) => {
        this.alerts.update(list => list.map(a => a._id === alert._id ? { ...a, status } : a));
        if (this.selectedAlert()?._id === alert._id) {
          this.selectedAlert.update(a => ({ ...a, status }));
        }
        this.applyFilters();
        this.toast.success(status === 'applied' ? 'Marked as applied' : 'Updated');
      },
    });
  }

  copyText(text: string, fieldName: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField.set(fieldName);
      this.toast.success(`Copied: ${fieldName}`);
      setTimeout(() => this.copiedField.set(''), 2000);
    });
  }

  downloadPDF(): void {
    const alert = this.selectedAlert();
    if (!alert) return;
    this.loadingPdf.set(true);
    this.api.downloadAlertPdf(alert._id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const company = (alert.company || 'Job').replace(/\s+/g, '_');
        a.href = url;
        a.download = `Tailored_Resume_${company}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.loadingPdf.set(false);
        this.toast.success(this.translate.instant('ALERTS.DOWNLOAD_SUCCESS') || 'PDF downloaded successfully');
      },
      error: () => {
        this.toast.error(this.translate.instant('ALERTS.DOWNLOAD_ERROR') || 'PDF not available');
        this.loadingPdf.set(false);
      }
    });
  }

  scoreColor(score: number): string {
    if (score >= 85) return 'var(--success)';
    if (score >= 70) return 'var(--warning)';
    return 'var(--accent)';
  }

  scoreGradient(score: number): string {
    if (score >= 85) return 'linear-gradient(135deg,var(--success),var(--success-secondary))';
    if (score >= 70) return 'linear-gradient(135deg,var(--warning),#f3722c)';
    return 'linear-gradient(135deg,var(--accent),var(--accent-secondary))';
  }

  getScoreClass(score: number): string {
    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }

  getScoreLabel(score: number): string {
    if (score >= 90) return this.translate.instant('ALERTS.EXCELLENT_MATCH') || 'Excellent Match';
    if (score >= 80) return this.translate.instant('ALERTS.STRONG_MATCH') || 'Strong Match';
    if (score >= 70) return this.translate.instant('ALERTS.FAIR_MATCH') || 'Fair Match';
    return this.translate.instant('ALERTS.LOW_MATCH') || 'Low Match';
  }

  platformLabel(source: string, sourcePlatform?: string | null): string {
    const map: Record<string, string> = {
      'remotive': 'Remotive', 'himalayas': 'Himalayas',
      'arbeitnow': 'Arbeitnow', 'adzuna': 'Adzuna',
      'indeed': 'Indeed', 'linkedin': 'LinkedIn', 'naukri': 'Naukri',
      'google-jobs': 'Google Jobs',
    };
    // A 'google-jobs' result found via LinkedIn/Naukri gets credited to the
    // real originating platform instead of the generic aggregator label —
    // added Session 36 so the "lean harder on Google Jobs for LinkedIn/
    // Naukri coverage" backend change is actually visible to the user.
    if (source === 'google-jobs' && sourcePlatform && map[sourcePlatform]) {
      return `${map[sourcePlatform]} (via Google)`;
    }
    return map[source] || source || 'Job Board';
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      pending:  this.translate.instant('ALERTS.STATUS_NEW') || 'New',
      notified: this.translate.instant('ALERTS.STATUS_NOTIFIED') || 'Notified',
      opened:   this.translate.instant('ALERTS.STATUS_OPENED') || 'Opened',
      applied:  this.translate.instant('ALERTS.STATUS_APPLIED') || 'Applied',
      ignored:  this.translate.instant('ALERTS.STATUS_IGNORED') || 'Ignored',
    };
    return map[s] || s;
  }

  isFresh(d: any): boolean {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !isNaN(t) && (Date.now() - t) <= 24 * 60 * 60 * 1000;
  }

  timeAgo(d: string | Date | null | undefined): string {
    if (!d) return '';
    const diffMs = Date.now() - new Date(d).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  formatFullDate(d: string | Date | null | undefined): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
