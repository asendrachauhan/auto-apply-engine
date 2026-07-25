import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring/progress-ring.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-resume',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NeoButtonComponent, ProgressRingComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header d-flex justify-between align-center">
        <div>
          <h1 class="page-title">{{ 'RESUME.TITLE' | translate }}</h1>
          <p class="page-subtitle">{{ 'RESUME.SUBTITLE' | translate }}</p>
        </div>
        @if (parsed()) {
          <aa-button variant="secondary" size="sm" (clicked)="reset()" icon="refresh">{{ 'RESUME.RE_UPLOAD' | translate }}</aa-button>
        }
      </div>

      @if (!parsed()) {
        <!-- Upload section -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="upload" [size]="16"/> {{ 'RESUME.UPLOAD_SECTION' | translate }}</div>
          <div
            class="upload-zone"
            [class.dragover]="dragover()"
            (click)="fileInput.click()"
            (dragover)="dragover.set(true); $event.preventDefault()"
            (dragleave)="dragover.set(false)"
            (drop)="onDrop($event)"
          >
            <aa-icon name="resume" [size]="48" class="upload-icon"/>
            <div class="upload-title">{{ 'RESUME.DROP_ZONE' | translate }}</div>
            <div class="upload-sub">{{ 'RESUME.FORMATS' | translate }}</div>
            <aa-button variant="secondary" size="sm" class="mt-16"
              (clicked)="$event.stopPropagation(); fileInput.click()">
              {{ 'RESUME.CHOOSE_FILE' | translate }}
            </aa-button>
          </div>
          <input #fileInput type="file" accept=".pdf,.doc,.docx,.txt"
            style="display:none" (change)="onFileSelect($event)">
        </div>

        <div class="section-card">
          <div class="section-title"><aa-icon name="fileEdit" [size]="16"/> {{ 'RESUME.PASTE_SECTION' | translate }}</div>
          <textarea class="neo-input" rows="11" [(ngModel)]="rawText"
            placeholder="Paste your full resume text here…&#10;&#10;Include: name, email, skills, experience, education…"></textarea>
          <div class="d-flex gap-8 mt-16">
            <aa-button [loading]="parsing()" (clicked)="parseText()" icon="sparkles">{{ 'RESUME.PARSE_BTN' | translate }}</aa-button>
            <aa-button variant="ghost" size="sm" (clicked)="loadSample()">{{ 'RESUME.LOAD_SAMPLE' | translate }}</aa-button>
          </div>
        </div>
      } @else {
        <!-- Parsed resume view -->
        <div class="grid-2">
          <!-- ATS Score card -->
          <div class="section-card score-card">
            <aa-progress-ring
              [percent]="parsed().atsScore || 0"
              [size]="130"
              [stroke]="10"
              [label]="'RESUME.ATS_SCORE' | translate"
              [color]="scoreColor(parsed().atsScore)"
            />
            <div class="score-grade">{{ scoreGrade(parsed().atsScore) }}</div>
            <div class="text-muted text-sm">{{ 'RESUME.AI_OPTIMISED' | translate }}</div>
            <div class="d-flex gap-8 mt-16">
              <aa-button size="sm" [loading]="parsing()" (clicked)="reoptimize()" icon="refresh">{{ 'RESUME.RE_OPTIMISE' | translate }}</aa-button>
              <aa-button size="sm" variant="secondary" (clicked)="downloadTip()" icon="download">{{ 'RESUME.DOWNLOAD' | translate }}</aa-button>
            </div>
          </div>

          <!-- Profile card -->
          <div class="section-card">
            <div class="section-title"><aa-icon name="users" [size]="16"/> {{ 'RESUME.PROFILE_SECTION' | translate }}</div>
            <div class="profile-name">{{ name() }}</div>
            <div class="profile-role text-muted">{{ primaryRole() }}</div>
            <div class="profile-email text-muted text-sm">{{ email() }}</div>
            <div class="divider"></div>
            <div class="text-xs fw-600 text-muted mb-8">{{ 'RESUME.TARGET_ROLES' | translate }}</div>
            <div class="chips-wrap">
              @for (r of targetRoles(); track r) {
                <span class="chip chip-accent">{{ r }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Skills -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="settings" [size]="16"/> {{ 'RESUME.SKILLS_SECTION' | translate }}</div>
          <div class="skills-group">
            <div class="skills-group-title">{{ 'RESUME.TECHNICAL' | translate }}</div>
            <div class="chips-wrap">
              @for (s of techSkills(); track s) { <span class="chip">{{ s }}</span> }
            </div>
          </div>
          <div class="skills-group mt-16">
            <div class="skills-group-title">{{ 'RESUME.SOFT_SKILLS' | translate }}</div>
            <div class="chips-wrap">
              @for (s of softSkills(); track s) { <span class="chip">{{ s }}</span> }
            </div>
          </div>
          @if (tools().length) {
            <div class="skills-group mt-16">
              <div class="skills-group-title">{{ 'RESUME.TOOLS_PLATFORMS' | translate }}</div>
              <div class="chips-wrap">
                @for (s of tools(); track s) { <span class="chip">{{ s }}</span> }
              </div>
            </div>
          }
        </div>

        <!-- Experience -->
        <div class="section-card">
          <div class="section-title"><aa-icon name="briefcase" [size]="16"/> {{ 'RESUME.EXPERIENCE_SECTION' | translate }}</div>
          <div class="exp-list">
            @for (exp of experience(); track exp.company) {
              <div class="exp-item">
                <div class="exp-header">
                  <div>
                    <div class="exp-title">{{ exp.title }}</div>
                    <div class="exp-company">{{ exp.company }} · {{ exp.duration }}</div>
                  </div>
                  @if (exp.current) { <span class="current-badge">{{ 'RESUME.CURRENT_BADGE' | translate }}</span> }
                </div>
                <ul class="exp-bullets">
                  @for (a of (exp.achievements || []); track a) { <li>{{ a }}</li> }
                </ul>
                @if (exp.technologies?.length) {
                  <div class="chips-wrap mt-8">
                    @for (t of exp.technologies; track t) { <span class="chip chip-sm">{{ t }}</span> }
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- AI Improvements -->
        @if (improvements().length) {
          <div class="section-card">
            <div class="section-title"><aa-icon name="sparkles" [size]="16"/> {{ 'RESUME.AI_IMPROVEMENTS' | translate }}</div>
            <div class="imp-list">
              @for (imp of improvements(); track imp) {
                <div class="imp-row">
                  <aa-icon name="check" [size]="14" class="imp-check"/>
                  <span>{{ imp }}</span>
                </div>
              }
            </div>
            @if (keywords().length) {
              <div class="divider"></div>
              <div class="text-xs fw-600 text-muted mb-8">{{ 'RESUME.ATS_KEYWORDS' | translate }}</div>
              <div class="chips-wrap">
                @for (k of keywords(); track k) { <span class="chip chip-accent">{{ k }}</span> }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    /* Upload Zone */
    .upload-zone {
      padding: 52px 24px; text-align: center;
      border: 2px dashed rgba(108,99,255,.25); border-radius: var(--radius);
      background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset);
      cursor: pointer; transition: all .25s ease;
    }
    .upload-zone:hover, .upload-zone.dragover {
      border-color: var(--accent);
      background: rgba(108,99,255,.03);
    }
    .upload-icon  { color: var(--accent); margin-bottom: 14px; }
    .upload-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
    .upload-sub   { font-size: 12px; color: var(--text-muted); }

    .neo-input {
      width: 100%; padding: 13px 16px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
      border: none; border-radius: var(--radius-sm);
      box-shadow: var(--neo-inset); font-family: var(--font-body);
      font-size: 13px; color: var(--text); outline: none; resize: vertical;
      transition: box-shadow .22s;
    }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px var(--accent-dim); }
    .neo-input::placeholder { color: var(--text-light); }

    .score-card { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .score-grade {
      font-family: var(--font-display); font-size: 18px; font-weight: 800;
      color: var(--accent);
    }

    .profile-name  { font-size: 22px; font-weight: 800; color: var(--text); }
    .profile-role  { font-size: 14px; margin-top: 4px; }
    .profile-email { margin-top: 2px; }

    .skills-group-title {
      font-size: 10px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: .8px; margin-bottom: 8px;
    }

    .exp-list { display: flex; flex-direction: column; gap: 16px; }
    .exp-item {
      padding: 16px; border-radius: var(--radius-sm);
      background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-inset);
    }
    .exp-header  { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .exp-title   { font-size: 14px; font-weight: 700; color: var(--text); }
    .exp-company { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .current-badge {
      font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
      background: var(--accent-dim); color: var(--accent); flex-shrink: 0;
    }
    .exp-bullets { padding-left: 16px; display: flex; flex-direction: column; gap: 5px; }
    .exp-bullets li { font-size: 12px; color: var(--text); line-height: 1.6; }
    .chip-sm { padding: 3px 8px; font-size: 10px; }

    .imp-list { display: flex; flex-direction: column; gap: 8px; }
    .imp-row  { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text); line-height: 1.5; }
    .imp-check{ color: var(--success); flex-shrink: 0; margin-top: 1px; }

    .mb-8 { margin-bottom: 8px; }
  `]
})
export class ResumeComponent implements OnInit {
  rawText  = '';
  parsed   = signal<any>(null);
  parsing  = signal(false);
  dragover = signal(false);

  /** Cached so "Re-optimise" can re-submit the same source content — the
   *  backend has a single /resume/upload endpoint that both parses and
   *  optimises, there's no separate re-optimise endpoint. */
  private lastFormData: FormData | null = null;

  /* derived signals */
  name        = () => this.opt()?.fullName        || this.par()?.fullName        || '';
  email       = () => this.opt()?.email           || this.par()?.email           || '';
  primaryRole = () => this.opt()?.targetRoles?.[0]|| this.par()?.targetRoles?.[0]|| '';
  targetRoles = () => this.opt()?.targetRoles     || this.par()?.targetRoles     || [];
  techSkills  = () => this.opt()?.skills?.technical|| this.par()?.skills?.technical || [];
  softSkills  = () => this.opt()?.skills?.soft    || this.par()?.skills?.soft    || [];
  tools       = () => this.opt()?.skills?.tools   || this.par()?.skills?.tools   || [];
  experience  = () => this.opt()?.experience      || this.par()?.experience      || [];
  improvements= () => this.opt()?.improvementSummary || [];
  keywords    = () => this.opt()?.keywordsAdded || [];
  private opt = () => this.parsed()?.optimizedData;
  private par = () => this.parsed()?.parsedData;

  constructor(private api: ApiService, private toast: ToastService, private translate: TranslateService) {}

  ngOnInit(): void {
    this.api.getMyResume().subscribe({
      next: (r: any) => { if (r.data) this.parsed.set(r.data); },
      error: () => {}
    });
  }

  onDrop(e: DragEvent): void {
    e.preventDefault(); this.dragover.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.readAndUpload(file);
  }

  onFileSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.readAndUpload(file);
  }

  private readAndUpload(file: File): void {
    this.parsing.set(true);
    const fd = new FormData();
    fd.append('resume', file, file.name);
    this.lastFormData = fd;
    this.api.uploadResume(fd).subscribe({
      next: (r: any) => { this.parsed.set(r.data); this.parsing.set(false); this.toast.success('Resume parsed & optimised'); },
      error: (e: any) => { this.toast.error(e.error?.message || 'Upload failed'); this.parsing.set(false); }
    });
  }

  parseText(): void {
    if (!this.rawText.trim()) { this.toast.error('Paste resume content first'); return; }
    this.parsing.set(true);
    const blob = new Blob([this.rawText], { type: 'text/plain' });
    const fd   = new FormData();
    fd.append('resume', blob, 'resume.txt');
    this.lastFormData = fd;
    this.api.uploadResume(fd).subscribe({
      next: (r: any) => { this.parsed.set(r.data); this.parsing.set(false); this.toast.success('Parsed & optimised'); },
      error: (e: any) => { this.toast.error(e.error?.message || 'Parse failed'); this.parsing.set(false); }
    });
  }

  reoptimize(): void {
    if (!this.lastFormData) {
      this.toast.info('Re-upload your resume to run the optimiser again');
      return;
    }
    this.parsing.set(true);
    this.api.uploadResume(this.lastFormData).subscribe({
      next: (r: any) => {
        this.parsed.set(r.data);
        this.parsing.set(false);
        this.toast.success(`Re-optimised — ATS score ${r.data?.atsScore}%`);
      },
      error: () => { this.toast.error('Re-optimise failed'); this.parsing.set(false); }
    });
  }

  reset(): void { this.parsed.set(null); this.rawText = ''; this.lastFormData = null; }

  downloadTip(): void {
    this.toast.info('Download feature: copy the optimised text into a Word doc, or export via the backend PDF endpoint.');
  }

  loadSample(): void {
    this.rawText = `John Doe | Full Stack Developer | john@example.com | +91 98765 43210
LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

SUMMARY
Full Stack Developer with 2+ years building scalable SaaS products. Specialised in MEAN stack with growing expertise in Generative AI integration.

SKILLS
Technical: Angular, Node.js, Express.js, MongoDB, TypeScript, REST APIs, Git, Docker
Tools: AWS, Postman, Jira, Figma
Soft: Problem Solving, Agile, Communication

EXPERIENCE
Full Stack Developer — KiteSuite, Bangalore (Jan 2023 – Present)
- Built AI-powered workspace features reducing task creation time by 40%
- Developed REST APIs serving 10k+ daily active users
- Integrated LangChain for document Q&A, cutting support tickets by 30%
- Led Angular migration improving page load by 35%

EDUCATION
B.Tech Computer Science — XYZ University, 2022 | CGPA: 8.2

PROJECTS
RAG Chatbot | Angular + Node.js + LangChain | PDF question-answering chatbot
Fleet Management System | Angular + Node.js | Real-time vehicle tracking dashboard`;
  }

  scoreColor(score: number): string {
    if (score >= 85) return '#43e97b';
    if (score >= 70) return '#f8961e';
    return '#f5576c';
  }

  scoreGrade(score: number): string {
    if (score >= 90) return this.translate.instant('RESUME.GRADE_EXCELLENT');
    if (score >= 80) return this.translate.instant('RESUME.GRADE_VERY_GOOD');
    if (score >= 70) return this.translate.instant('RESUME.GRADE_GOOD');
    return this.translate.instant('RESUME.GRADE_NEEDS_WORK');
  }
}
