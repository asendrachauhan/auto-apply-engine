import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-eu-careers',
  standalone: true,
  imports: [CommonModule, FormsModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">India → Europe Careers</h1>
        <p class="page-subtitle">CTC conversion, visa pathways, and EU-ready resume guidance — nobody else offers this.</p>
      </div>

      <!-- Country pathway cards -->
      @if (loadingPathways()) {
        <div class="pathways-grid">
          @for (_ of [1,2,3,4]; track $index) { <div class="skeleton" style="height:210px;border-radius:16px;"></div> }
        </div>
      } @else {
        <div class="pathways-grid">
          @for (p of pathways(); track p.country) {
            <div class="pathway-card neo" [class.selected]="selectedCountry() === countryCode(p.country)"
              (click)="selectCountry(countryCode(p.country))">
              <div class="pathway-header">
                <span class="country-code">{{ countryCode(p.country) }}</span>
                <div>
                  <div class="pathway-country">{{ p.country }}</div>
                  <div class="pathway-visa text-muted text-xs">{{ p.visaName }}</div>
                </div>
              </div>
              <div class="pathway-stats">
                <div class="pw-stat">
                  <div class="pw-stat-val">€{{ (p.avgMidSalaryEUR/1000).toFixed(0) }}k</div>
                  <div class="pw-stat-lbl">Avg mid salary</div>
                </div>
                <div class="pw-stat">
                  <div class="pw-stat-val">{{ p.processingDays.min }}–{{ p.processingDays.max }}d</div>
                  <div class="pw-stat-lbl">Visa processing</div>
                </div>
              </div>
              <div class="pathway-strengths">
                @for (s of p.strengths.slice(0,2); track s) {
                  <div class="strength-row"><aa-icon name="check" [size]="12"/>{{ s }}</div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- CTC Converter -->
      <div class="section-card">
        <div class="section-title"><aa-icon name="currency" [size]="16"/> CTC → EUR Converter</div>
        <div class="ctc-form">
          <div class="ctc-field">
            <label class="text-xs text-muted">Your CTC (₹ LPA)</label>
            <input type="number" class="neo-input" [(ngModel)]="ctcLPA" placeholder="e.g. 12" min="1">
          </div>
          <div class="ctc-field">
            <label class="text-xs text-muted">Target country</label>
            <select class="neo-input" [(ngModel)]="targetCountry">
              @for (p of pathways(); track p.country) {
                <option [value]="countryCode(p.country)">{{ p.country }}</option>
              }
            </select>
          </div>
          <aa-button [loading]="converting()" (clicked)="convert()" icon="currency">Convert</aa-button>
        </div>

        @if (conversion()) {
          <div class="conversion-result neo-sm anim-fade-in">
            <div class="conv-row">
              <div class="conv-item">
                <div class="conv-label">Your CTC</div>
                <div class="conv-val">€{{ conversion().equivalentEUR.toLocaleString() }}</div>
              </div>
              <aa-icon name="chevronRight" [size]="20" class="conv-arrow"/>
              <div class="conv-item">
                <div class="conv-label">Local market rate</div>
                <div class="conv-val text-accent">€{{ conversion().marketAverageEUR.toLocaleString() }}</div>
              </div>
              <div class="conv-uplift" [class.positive]="conversion().potentialUpliftX >= 1">
                {{ conversion().potentialUpliftX }}x
              </div>
            </div>
            <p class="conv-guidance text-sm">{{ conversion().negotiationGuidance }}</p>
            <div class="conv-badge" [class.eligible]="conversion().meetsVisaMinimum">
              <aa-icon [name]="conversion().meetsVisaMinimum ? 'checkCircle' : 'alertTriangle'" [size]="14"/>
              {{ conversion().meetsVisaMinimum ? 'Meets visa minimum salary' : 'Below visa minimum salary' }}
            </div>
          </div>
        }
      </div>

      <div class="grid-2">
        <!-- Visa Eligibility -->
        <div class="section-card">
          <div class="section-title d-flex justify-between align-center">
            <span class="d-flex align-center gap-8"><aa-icon name="passport" [size]="16"/> Visa Eligibility</span>
            <aa-button variant="ghost" size="sm" [loading]="loadingVisa()" (clicked)="checkVisa()">Check for {{ targetCountry }}</aa-button>
          </div>
          @if (visaResult()) {
            <div class="visa-status" [class.eligible]="visaResult().eligible">
              <aa-icon [name]="visaResult().eligible ? 'checkCircle' : 'alertTriangle'" [size]="18"/>
              <span>{{ visaResult().eligible ? 'Likely eligible' : 'Gaps to address' }} — {{ visaResult().visaType }}</span>
            </div>
            @if (visaResult().positives?.length) {
              <div class="visa-list">
                @for (p of visaResult().positives; track p) { <div class="visa-item positive"><aa-icon name="check" [size]="12"/>{{ p }}</div> }
              </div>
            }
            @if (visaResult().issues?.length) {
              <div class="visa-list">
                @for (i of visaResult().issues; track i) { <div class="visa-item issue"><aa-icon name="alertTriangle" [size]="12"/>{{ i }}</div> }
              </div>
            }
            <a class="visa-link" [href]="visaResult().website" target="_blank">Official visa portal <aa-icon name="externalLink" [size]="11"/></a>
          } @else if (!resumeMissing()) {
            <p class="text-muted text-sm">Click "Check" to see your eligibility based on your uploaded resume.</p>
          } @else {
            <p class="text-muted text-sm">Upload your resume first to check visa eligibility.</p>
          }
        </div>

        <!-- EU Resume Guide -->
        <div class="section-card">
          <div class="section-title d-flex justify-between align-center">
            <span class="d-flex align-center gap-8"><aa-icon name="fileEdit" [size]="16"/> EU Resume Guide</span>
            <aa-button variant="ghost" size="sm" [loading]="loadingGuide()" (clicked)="loadGuide()">Load for {{ targetCountry }}</aa-button>
          </div>
          @if (resumeGuide()) {
            <div class="guide-issues">
              @for (item of resumeGuide().issues; track item.issue) {
                <div class="guide-issue">
                  <span class="sev-badge" [class]="item.severity.toLowerCase()">{{ item.severity }}</span>
                  <div>
                    <div class="issue-title">{{ item.issue }}</div>
                    <div class="issue-fix text-muted text-xs">{{ item.fix }}</div>
                  </div>
                </div>
              }
            </div>
            @if (resumeGuide().culturalNotes?.length) {
              <div class="divider"></div>
              <div class="text-xs fw-600 text-muted mb-8">CULTURAL NOTES</div>
              @for (n of resumeGuide().culturalNotes; track n) {
                <div class="cultural-note text-sm">{{ n }}</div>
              }
            }
          } @else if (!resumeMissing()) {
            <p class="text-muted text-sm">Click "Load" for country-specific resume guidance based on your resume.</p>
          } @else {
            <p class="text-muted text-sm">Upload your resume first for personalised guidance.</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pathways-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(240px,1fr)); gap: 16px; margin-bottom: 24px; }
    .pathway-card  { padding: 18px; cursor: pointer; transition: all .22s; }
    .pathway-card:hover { transform: translateY(-2px); box-shadow: var(--neo-float); }
    .pathway-card.selected { box-shadow: var(--neo-inset); }
    .pathway-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .country-code { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg,var(--accent),#a855f7); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0; }
    .pathway-country { font-size: 14px; font-weight: 700; color: var(--text); }
    .pathway-stats  { display: flex; gap: 16px; margin-bottom: 12px; }
    .pw-stat-val    { font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--accent); }
    .pw-stat-lbl    { font-size: 10px; color: var(--text-muted); }
    .pathway-strengths { display: flex; flex-direction: column; gap: 5px; }
    .strength-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text); }
    .strength-row aa-icon { color: var(--success); flex-shrink: 0; }

    .ctc-form { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 16px; }
    .ctc-field { display: flex; flex-direction: column; gap: 6px; min-width: 140px; }
    .neo-input { padding: 10px 14px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: none; border-radius: var(--radius-sm); box-shadow: var(--neo-inset); font-size: 13px; color: var(--text); outline: none; }

    .conversion-result { padding: 18px; }
    .conv-row  { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
    .conv-item { flex: 1; min-width: 100px; }
    .conv-label{ font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
    .conv-val  { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--text); }
    .conv-arrow{ color: var(--text-light); }
    .conv-uplift { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--text-muted); padding: 6px 14px; border-radius: var(--radius-pill); background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset); }
    .conv-uplift.positive { color: var(--success); }
    .conv-guidance { color: var(--text); line-height: 1.6; margin-bottom: 12px; }
    .conv-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--warning); }
    .conv-badge.eligible { color: var(--success); }

    .visa-status { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--warning); margin-bottom: 12px; }
    .visa-status.eligible { color: var(--success); }
    .visa-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .visa-item { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; color: var(--text); line-height: 1.5; }
    .visa-item.positive aa-icon { color: var(--success); }
    .visa-item.issue aa-icon    { color: var(--warning); }
    .visa-link { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--accent); font-weight: 600; text-decoration: none; margin-top: 6px; }

    .guide-issues { display: flex; flex-direction: column; gap: 10px; }
    .guide-issue  { display: flex; gap: 10px; align-items: flex-start; }
    .sev-badge    { font-size: 9px; font-weight: 800; padding: 3px 7px; border-radius: 6px; flex-shrink: 0; margin-top: 2px; }
    .sev-badge.high   { background: rgba(245,87,108,.14); color: #c53030; }
    .sev-badge.medium { background: rgba(248,150,30,.14); color: #c05621; }
    .issue-title { font-size: 12px; font-weight: 700; color: var(--text); }
    .issue-fix   { margin-top: 2px; line-height: 1.5; }
    .cultural-note { color: var(--text); line-height: 1.6; margin-bottom: 8px; padding-left: 4px; border-left: 2px solid var(--accent-dim); }
    .mb-8 { margin-bottom: 8px; }
  `]
})
export class EuCareersComponent implements OnInit {
  pathways        = signal<any[]>([]);
  loadingPathways = signal(true);
  selectedCountry = signal('DE');

  ctcLPA        = 12;
  targetCountry = 'DE';
  converting    = signal(false);
  conversion    = signal<any>(null);

  loadingVisa = signal(false);
  visaResult  = signal<any>(null);
  loadingGuide= signal(false);
  resumeGuide = signal<any>(null);
  resumeMissing = signal(false);

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadingPathways.set(true);
    this.api.getEuPathways().subscribe({
      next: (r: any) => { this.pathways.set(r.data || []); this.loadingPathways.set(false); },
      error: () => this.loadingPathways.set(false),
    });
  }

  countryCode(name: string): string {
    const map: Record<string,string> = { 'Germany':'DE', 'Netherlands':'NL', 'Portugal':'PT', 'Sweden':'SE' };
    return map[name] || name.slice(0,2).toUpperCase();
  }

  selectCountry(code: string): void { this.selectedCountry.set(code); this.targetCountry = code; }

  convert(): void {
    if (!this.ctcLPA || this.ctcLPA <= 0) { this.toast.error('Enter a valid CTC amount'); return; }
    this.converting.set(true);
    this.api.convertCtc(this.ctcLPA, this.targetCountry).subscribe({
      next: (r: any) => { this.conversion.set(r.data); this.converting.set(false); },
      error: (e: any) => { this.toast.error(e.error?.message || 'Conversion failed'); this.converting.set(false); },
    });
  }

  checkVisa(): void {
    this.loadingVisa.set(true);
    this.api.getVisaEligibility(this.targetCountry).subscribe({
      next: (r: any) => { this.visaResult.set(r.data); this.resumeMissing.set(false); this.loadingVisa.set(false); },
      error: (e: any) => {
        this.loadingVisa.set(false);
        if (e.status === 404) { this.resumeMissing.set(true); }
        else this.toast.error(e.error?.message || 'Check failed');
      },
    });
  }

  loadGuide(): void {
    this.loadingGuide.set(true);
    this.api.getEuResumeGuide(this.targetCountry).subscribe({
      next: (r: any) => { this.resumeGuide.set(r.data); this.resumeMissing.set(false); this.loadingGuide.set(false); },
      error: (e: any) => {
        this.loadingGuide.set(false);
        if (e.status === 404) { this.resumeMissing.set(true); }
        else this.toast.error(e.error?.message || 'Load failed');
      },
    });
  }
}
