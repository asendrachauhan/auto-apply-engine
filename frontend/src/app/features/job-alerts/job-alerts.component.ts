/**
 * Job Alerts Page — "Find + Prepare + Notify" flow.
 * Shows all discovered jobs with tailored resume + prefill packet.
 * User clicks job link and manually applies — we've done all the prep.
 */
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
  imports: [CommonModule, FormsModule, RouterModule, NeoButtonComponent, StatusBadgeComponent, ProgressRingComponent, GhostScoreComponent, IconComponent],
  template: `
    <div class="page-container">

      <!-- Header -->
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">Job Alerts</h1>
          <p class="page-subtitle">AI found these jobs, tailored your resume, and prepared the application. You just click &amp; paste.</p>
        </div>
        <div class="d-flex gap-8 flex-wrap">
          <aa-button variant="secondary" size="sm" (clicked)="loadAlerts()" icon="refresh">Refresh</aa-button>
          <aa-button [loading]="running()" (clicked)="runPipeline()" icon="search">Find New Jobs</aa-button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="alert-stats">
        @for (s of stats(); track s.label) {
          <div class="stat-chip neo-sm">
            <aa-icon [name]="s.icon" [size]="16" class="stat-chip-icon"/>
            <span class="stat-chip-val">{{ s.val }}</span>
            <span class="stat-chip-lbl">{{ s.label }}</span>
          </div>
        }
      </div>

      <!-- How it works banner -->
      @if (alerts().length === 0 && !loading()) {
        <div class="how-it-works neo">
          <div class="how-title">How Job Alerts Work</div>
          <div class="how-steps">
            @for (step of howSteps; track step.n) {
              <div class="how-step">
                <div class="how-step-n">{{ step.n }}</div>
                <aa-icon [name]="step.icon" [size]="24" class="how-step-icon"/>
                <div class="how-step-text">{{ step.text }}</div>
              </div>
            }
          </div>
          <div class="how-legal">
            <aa-icon name="shield" [size]="14"/>
            100% legal — we find jobs on Remotive, Himalayas, Arbeitnow, Adzuna and more. We never auto-apply. You stay in full control.
          </div>
          <aa-button [loading]="running()" (clicked)="runPipeline()" icon="search">
            Find My First Job Matches
          </aa-button>
        </div>
      }

      <!-- Filters -->
      @if (alerts().length > 0) {
        <div class="filters-bar neo-sm">
          @for (f of filters; track f.val) {
            <button class="filter-btn" [class.active]="activeFilter() === f.val"
              (click)="setFilter(f.val)">
              {{ f.label }}
            </button>
          }
          <div class="filter-score">
            <span class="text-muted text-xs">Min score</span>
            <input type="range" min="50" max="95" step="5" [(ngModel)]="minScore"
              (change)="applyFilters()" class="score-range">
            <span class="score-range-val text-accent fw-700">{{ minScore }}%</span>
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
              (click)="openAlert(alert)">

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
                    <span class="meta-tag source">{{ platformLabel(alert.source) }}</span>
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
                  View Packet
                </aa-button>
                <aa-button variant="secondary" size="sm" (clicked)="openJobLink(alert)" iconRight="externalLink">
                  Apply
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
          <div style="font-weight:700;font-size:15px;color:var(--text);">No alerts match this filter</div>
          <div class="text-muted text-sm mt-8">Try lowering the minimum score or changing the status filter</div>
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
            </div>
            <button class="panel-close" (click)="selectedAlert.set(null)"><aa-icon name="close" [size]="16"/></button>
          </div>

          <!-- Score ring -->
          <div class="panel-score">
            <aa-progress-ring
              [percent]="selectedAlert()!.matchScore"
              [size]="90"
              [color]="scoreGradient(selectedAlert()!.matchScore)"
            />
            <div class="panel-score-meta">
              <div class="fw-700" style="font-size:16px;color:var(--text);">
                {{ getScoreLabel(selectedAlert()!.matchScore) }}
              </div>
              <div class="text-muted text-sm">via {{ platformLabel(selectedAlert()!.source) }}</div>
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
                <aa-icon [name]="tab.icon" [size]="14"/> {{ tab.label }}
              </button>
            }
          </div>

          <!-- Tab: Application Packet -->
          @if (activeTab() === 'packet') {
            <div class="tab-content anim-fade-in">
              <div class="packet-section">
                <div class="packet-section-title">Pre-filled Form Fields</div>
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
                  Cover Letter
                  <aa-button variant="ghost" size="sm"
                    [icon]="copiedField() === 'Cover Letter' ? 'check' : 'copy'"
                    (clicked)="copyText(selectedAlert()!.coverLetter || '', 'Cover Letter')">
                    {{ copiedField() === 'Cover Letter' ? 'Copied' : 'Copy' }}
                  </aa-button>
                </div>
                <div class="cover-letter-box">{{ selectedAlert()!.coverLetter }}</div>
              </div>

              <div class="packet-section">
                <div class="packet-section-title">Copy Everything</div>
                <div class="copy-all-box">
                  <pre class="prefill-card">{{ selectedAlert()!.prefillCard }}</pre>
                  <aa-button variant="secondary" [fullWidth]="true"
                    [icon]="copiedField() === 'Full Packet' ? 'checkCircle' : 'copy'"
                    (clicked)="copyText(selectedAlert()!.prefillCard || '', 'Full Packet')">
                    {{ copiedField() === 'Full Packet' ? 'Copied!' : 'Copy Full Packet' }}
                  </aa-button>
                </div>
              </div>
            </div>
          }

          <!-- Tab: Tailored Resume -->
          @if (activeTab() === 'resume') {
            <div class="tab-content anim-fade-in">
              <div class="resume-actions">
                <aa-button [loading]="loadingPdf()" (clicked)="downloadPDF()" icon="download">Download Tailored PDF</aa-button>
              </div>
              @if (selectedAlert()!.tailoredResume?.summary) {
                <div class="packet-section">
                  <div class="packet-section-title">Tailored Summary</div>
                  <div class="tailored-summary">{{ selectedAlert()!.tailoredResume!.summary }}</div>
                </div>
              }
              @if (selectedAlert()!.keywordsToHighlight?.length) {
                <div class="packet-section">
                  <div class="packet-section-title">Keywords Added</div>
                  <div class="chips-wrap">
                    @for (k of selectedAlert()!.keywordsToHighlight; track k) {
                      <span class="chip chip-accent">{{ k }}</span>
                    }
                  </div>
                </div>
              }
              @if (selectedAlert()!.missingSkills?.length) {
                <div class="packet-section">
                  <div class="packet-section-title">Gaps to Address</div>
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
                <div class="packet-section-title">Why You Match</div>
                @for (r of selectedAlert()!.matchReasons; track r) {
                  <div class="guide-reason"><aa-icon name="check" [size]="13" class="guide-check"/>{{ r }}</div>
                }
              </div>
              <div class="apply-steps-guide">
                <div class="packet-section-title">Steps to Apply</div>
                <div class="steps-numbered">
                  <div class="step-n"><span class="sn">1</span><span>Open the job link</span></div>
                  <div class="step-n"><span class="sn">2</span><span>Click Apply / Easy Apply</span></div>
                  <div class="step-n"><span class="sn">3</span><span>Upload tailored resume PDF (download above)</span></div>
                  <div class="step-n"><span class="sn">4</span><span>Copy-paste from the "Application Packet" tab</span></div>
                  <div class="step-n"><span class="sn">5</span><span>Submit — usually under 8 minutes</span></div>
                </div>
              </div>
            </div>
          }

          <!-- Panel footer actions -->
          <div class="panel-footer-actions">
            <aa-button [fullWidth]="true" (clicked)="openJobLink(selectedAlert()!)" iconRight="externalLink">
              Open Job &amp; Apply
            </aa-button>
            <div class="panel-status-row">
              <span class="text-muted text-xs">Mark as:</span>
              @for (s of ['applied','ignored']; track s) {
                <button class="status-chip"
                  [class.active-status]="selectedAlert()!.status === s"
                  (click)="markStatus(selectedAlert()!, s)">
                  {{ s === 'applied' ? 'Applied' : 'Ignore' }}
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
    .how-legal    { background:rgba(67,233,123,.1); border-radius:10px; padding:12px 16px; font-size:12px; color:var(--text); margin-bottom:20px; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px; }

    /* Filters */
    .filters-bar { display:flex; align-items:center; gap:8px; padding:12px 16px; margin-bottom:20px; flex-wrap:wrap; }
    .filter-btn  { padding:6px 14px; border-radius:var(--radius-pill); border:none; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); font-size:12px; font-weight:600; cursor:pointer; color:var(--text-muted); transition:all .2s; }
    .filter-btn.active { box-shadow:var(--neo-inset); color:var(--accent); }
    .filter-score{ display:flex; align-items:center; gap:8px; margin-left:auto; }
    .score-range { -webkit-appearance:none; width:100px; height:5px; border-radius:3px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); outline:none; }
    .score-range::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); cursor:pointer; }
    .score-range-val { font-size:13px; font-weight:800; min-width:36px; }

    /* Alerts grid */
    .alerts-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
    .alert-skeleton{ height:200px; border-radius:var(--radius); }

    /* Alert card */
    .alert-card  { padding:18px; cursor:pointer; transition:all .22s; position:relative; overflow:hidden; }
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
      background:linear-gradient(135deg,var(--accent),#a855f7);
      color:#fff; display:flex; align-items:center; justify-content:center;
      font-weight:800; font-size:17px;
    }
    .alert-job-info { flex:1; min-width:0; padding-right:50px; }
    .alert-title    { font-size:14px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .alert-company  { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .alert-meta     { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
    .meta-tag { font-size:10px; font-weight:600; padding:2px 7px; border-radius:var(--radius-pill); background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-sm); color:var(--text-muted); }
    .meta-tag.source { color:var(--accent); background:var(--accent-dim); box-shadow:none; }

    .reasons-preview { margin-bottom:10px; }
    .reason-row      { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--text); margin-bottom:4px; line-height:1.4; }
    .reason-check    { color:var(--success); flex-shrink:0; }

    .alert-footer { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .alert-status-badge { font-size:10px; font-weight:700; padding:3px 9px; border-radius:var(--radius-pill); }
    .alert-status-badge.pending  { background:rgba(248,150,30,.14);  color:#c05621; }
    .alert-status-badge.notified { background:var(--accent-dim);     color:var(--accent); }
    .alert-status-badge.opened   { background:rgba(67,233,123,.12);  color:#22863a; }
    .alert-status-badge.applied  { background:rgba(67,233,123,.2);   color:#166534; }
    .alert-status-badge.ignored  { background:rgba(163,177,198,.15); color:var(--text-muted); }

    .alert-actions { display:flex; gap:8px; }

    /* Detail Panel */
    .panel-overlay { position:fixed; inset:0; background:rgba(6,8,15,.55); backdrop-filter:blur(6px); z-index:200; display:flex; justify-content:flex-end; }
    .detail-panel  {
      width:min(480px,100vw); height:100vh; overflow-y:auto;
      padding:24px 22px; display:flex; flex-direction:column; gap:14px;
      border-radius:0;
    }
    .panel-header  { display:flex; justify-content:space-between; align-items:flex-start; }
    .panel-title   { font-size:17px; font-weight:800; color:var(--text); }
    .panel-company { font-size:13px; color:var(--text-muted); margin-top:3px; }
    .panel-close   { background:none; border:none; cursor:pointer; color:var(--text-muted); flex-shrink:0; display:flex; }

    .panel-score { display:flex; align-items:center; gap:18px; padding:16px; border-radius:12px; background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); }
    .panel-score-meta { flex:1; }

    .panel-tabs { display:flex; gap:4px; border-radius:var(--radius-sm); background:var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow:var(--neo-inset); padding:4px; }
    .panel-tab  { flex:1; padding:8px 6px; border:none; border-radius:8px; background:transparent; font-size:12px; font-weight:600; cursor:pointer; color:var(--text-muted); transition:all .2s; display:flex; align-items:center; justify-content:center; gap:6px; }
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
    .sn { background:linear-gradient(135deg,var(--accent),#a855f7); color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; flex-shrink:0; }

    .panel-footer-actions { display:flex; flex-direction:column; gap:10px; margin-top:auto; padding-top:12px; border-top:1px solid rgba(163,177,198,.2); }
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
  activeFilter  = signal('all');
  minScore      = 65;

  statsData     = signal<any>(null);
  stats = computed(() => [
    { icon:'target',        val: this.statsData()?.total        || 0, label:'Total Found'  },
    { icon:'bell',          val: this.statsData()?.notified     || 0, label:'Notified'     },
    { icon:'checkCircle',   val: this.statsData()?.applied      || 0, label:'You Applied'  },
    { icon:'star',          val: (this.statsData()?.avgMatchScore||0)+'%', label:'Avg Score'  },
  ]);

  filters = [
    { val:'all',      label:'All'       },
    { val:'notified', label:'New'       },
    { val:'opened',   label:'Opened'    },
    { val:'applied',  label:'Applied'   },
    { val:'ignored',  label:'Ignored'   },
  ];

  tabs = [
    { id:'packet', icon:'fileEdit', label:'Packet' },
    { id:'resume', icon:'resume',   label:'Resume' },
    { id:'guide',  icon:'checkCircle', label:'Guide' },
  ];

  howSteps = [
    { n:1, icon:'search',        text:'AI discovers new jobs from Remotive, Himalayas, Arbeitnow & Adzuna every 2 hours' },
    { n:2, icon:'target',        text:'Scores each job against your profile — only high matches reach you' },
    { n:3, icon:'fileEdit',      text:'Tailors your resume & generates a cover letter specific to that job' },
    { n:4, icon:'messageCircle', text:'Sends you WhatsApp + Email with the job link, tailored PDF & pre-filled form' },
  ];

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadAlerts();
    this.api.getAlertStats().subscribe({ next: (r: any) => this.statsData.set(r.data) });
  }

  loadAlerts(): void {
    this.loading.set(true);
    this.api.getAlerts({ limit: 50 }).subscribe({
      next: (r: any) => {
        this.alerts.set(r.data || []);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void {
    let list = this.alerts();
    if (this.activeFilter() !== 'all') list = list.filter(a => a.status === this.activeFilter());
    list = list.filter(a => (a.matchScore || 0) >= this.minScore);
    this.filteredAlerts.set(list);
  }

  setFilter(f: string): void { this.activeFilter.set(f); this.applyFilters(); }

  runPipeline(): void {
    this.running.set(true);
    this.api.runAlertPipeline().subscribe({
      next: () => {
        this.toast.success('Job discovery started — check back in 2–3 minutes');
        setTimeout(() => { this.running.set(false); this.loadAlerts(); }, 8000);
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || 'Pipeline failed');
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

  closePanel(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('panel-overlay')) {
      this.selectedAlert.set(null);
    }
  }

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
    if (alert.tailoredResumePdfUrl) {
      window.open(alert.tailoredResumePdfUrl, '_blank');
      return;
    }
    this.loadingPdf.set(true);
    this.api.getAlertPDF(alert._id).subscribe({
      next: (r: any) => {
        if (r.data?.url) window.open(r.data.url, '_blank');
        else this.toast.info('PDF generation in progress. Try again in 30 seconds.');
        this.loadingPdf.set(false);
      },
      error: () => { this.toast.error('PDF not available'); this.loadingPdf.set(false); },
    });
  }

  scoreGradient(score: number): string {
    if (score >= 85) return 'linear-gradient(135deg,#43e97b,#38f9d7)';
    if (score >= 70) return 'linear-gradient(135deg,#f8961e,#f3722c)';
    return 'linear-gradient(135deg,#6c63ff,#a855f7)';
  }

  getScoreClass(score: number): string {
    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }

  getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent Match';
    if (score >= 80) return 'Strong Match';
    if (score >= 70) return 'Good Match';
    return 'Fair Match';
  }

  platformLabel(source: string): string {
    const map: Record<string, string> = {
      'remotive': 'Remotive', 'himalayas': 'Himalayas',
      'arbeitnow': 'Arbeitnow', 'adzuna': 'Adzuna',
    };
    return map[source] || source || 'Job Board';
  }

  statusLabel(s: string): string {
    return { pending:'New', notified:'Notified', opened:'Opened', applied:'Applied', ignored:'Ignored' }[s] || s;
  }

  timeAgo(d: string): string {
    if (!d) return '';
    const diff  = Date.now() - new Date(d).getTime();
    const hours = Math.floor(diff / 3600000);
    return hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours/24)}d ago`;
  }
}
