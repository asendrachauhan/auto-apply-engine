import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'aa-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="onboard-page">
      <div class="onboard-card neo anim-fade-in">
        <!-- Progress bar -->
        <div class="progress-bar">
          @for (_ of steps; track $index) {
            <div class="progress-dot" [class.done]="step() > $index" [class.active]="step() === $index"></div>
          }
        </div>

        <div class="step-num">Step {{ step()+1 }} of {{ steps.length }}</div>

        <!-- Step 0: Welcome -->
        @if (step() === 0) {
          <div class="step-content anim-fade-in">
            <aa-icon name="sparkles" [size]="40" class="step-icon-svg"/>
            <h2>Welcome to AutoApply AI</h2>
            <p>Let's set up your automated job hunt in under 2 minutes. We'll do all the heavy lifting from here.</p>
            <div class="feature-list">
              @for (f of welcomeFeatures; track f) {
                <div class="feature-row"><aa-icon name="check" [size]="14"/> {{ f }}</div>
              }
            </div>
          </div>
        }

        <!-- Step 1: Resume -->
        @if (step() === 1) {
          <div class="step-content anim-fade-in">
            <aa-icon name="resume" [size]="40" class="step-icon-svg"/>
            <h2>Upload Your Resume</h2>
            <p>AI will parse, structure, and optimize it automatically.</p>
            <div class="upload-zone neo-inset" (click)="fileInput.click()" [class.has-file]="uploaded()">
              @if (uploading()) {
                <div class="text-muted">Parsing with AI…</div>
              } @else if (!uploaded()) {
                <div><aa-icon name="upload" [size]="20"/> Drop PDF/DOCX or click to upload</div>
                <div class="text-muted text-sm mt-8">Or paste text below</div>
              } @else {
                <div class="text-success fw-700"><aa-icon name="checkCircle" [size]="16"/> Resume parsed &amp; optimised!</div>
              }
            </div>
            <input #fileInput type="file" accept=".pdf,.doc,.docx,.txt" style="display:none" (change)="onFile($event)">
            <textarea class="neo-input mt-16" rows="6" [(ngModel)]="resumeText"
              placeholder="Or paste resume text here…"></textarea>
          </div>
        }

        <!-- Step 2: Preferences -->
        @if (step() === 2) {
          <div class="step-content anim-fade-in">
            <aa-icon name="target" [size]="40" class="step-icon-svg"/>
            <h2>Job Preferences</h2>
            <div class="input-group">
              <label class="input-label">Target Roles</label>
              <input class="neo-input" [(ngModel)]="prefs.titles" placeholder="Full Stack Developer, Node.js Dev">
            </div>
            <div class="input-group">
              <label class="input-label">Locations</label>
              <input class="neo-input" [(ngModel)]="prefs.locations" placeholder="Remote, Bangalore">
            </div>
            <div class="toggle-row-onboard">
              <span>Remote only?</span>
              <label class="mini-toggle-wrap">
                <input type="checkbox" [(ngModel)]="prefs.remote">
                <span class="t-track"><span class="t-thumb"></span></span>
              </label>
            </div>
          </div>
        }

        <!-- Step 3: Notifications -->
        @if (step() === 3) {
          <div class="step-content anim-fade-in">
            <aa-icon name="bell" [size]="40" class="step-icon-svg"/>
            <h2>Stay Updated</h2>
            <p>Get notified for every application — WhatsApp or Email.</p>
            <div class="input-group">
              <label class="input-label">WhatsApp (optional)</label>
              <input class="neo-input" type="tel" [(ngModel)]="notif.whatsapp" placeholder="+91 98765 43210">
            </div>
            <div class="input-group">
              <label class="input-label">Email</label>
              <input class="neo-input" type="email" [(ngModel)]="notif.email" placeholder="you@email.com">
            </div>
          </div>
        }

        <!-- Step 4: Go! -->
        @if (step() === 4) {
          <div class="step-content anim-fade-in" style="text-align:center;">
            <aa-icon name="zap" [size]="40" class="step-icon-svg"/>
            <h2>You're All Set!</h2>
            <p>Automation is ready. Hit activate and let AI do the rest.</p>
            <div class="ready-list">
              <div class="ready-row" [class.checked]="uploaded()">
                <aa-icon [name]="uploaded() ? 'checkCircle' : 'circle'" [size]="14"/> Resume uploaded
              </div>
              <div class="ready-row checked"><aa-icon name="checkCircle" [size]="14"/> Preferences saved</div>
              <div class="ready-row" [class.checked]="notif.email || notif.whatsapp">
                <aa-icon [name]="(notif.email || notif.whatsapp) ? 'checkCircle' : 'circle'" [size]="14"/> Notifications set
              </div>
            </div>
            @if (!uploaded()) {
              <p class="text-warning text-xs mt-16">You skipped resume upload — automation can't apply anywhere until you add one from the Resume page.</p>
            }
          </div>
        }

        <!-- Navigation -->
        <div class="step-nav">
          @if (step() > 0) {
            <aa-button variant="secondary" (clicked)="step.set(step()-1)" icon="chevronLeft">Back</aa-button>
          } @else {
            <div></div>
          }
          @if (step() < steps.length - 1) {
            <aa-button (clicked)="next()" [loading]="loading()" iconRight="chevronRight">
              {{ step() === 1 && !resumeText() ? 'Skip' : 'Next' }}
            </aa-button>
          } @else {
            <aa-button (clicked)="finish()" [loading]="loading()" icon="zap">Activate &amp; Go!</aa-button>
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
    .progress-dot.done   { background:linear-gradient(135deg,var(--accent),#a855f7); box-shadow:none; }
    .step-num { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.8px; margin-bottom:20px; }
    .step-content { margin-bottom:28px; }
    .step-icon-svg { color: var(--accent); margin-bottom:14px; }
    h2 { margin-bottom:8px; }
    p  { margin-bottom:20px; }
    .feature-list { display:flex; flex-direction:column; gap:10px; margin-top:16px; }
    .feature-row  { display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text); }
    .feature-row aa-icon { color:var(--success); flex-shrink:0; }
    .upload-zone { padding:28px; text-align:center; border:2px dashed rgba(108,99,255,.3); border-radius:var(--radius); cursor:pointer; font-size:14px; font-weight:600; color:var(--text-muted); transition:all .2s; }
    .upload-zone:hover,.upload-zone.has-file { border-color:var(--accent); }
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
    input:checked + .t-track { background:linear-gradient(135deg,var(--accent),#a855f7); }
    input:checked + .t-track .t-thumb { transform:translateX(22px); background:#fff; }
    .ready-list { display:flex; flex-direction:column; gap:12px; margin-top:20px; text-align:left; }
    .ready-row  { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; color:var(--text-muted); }
    .ready-row.checked { color:var(--text); }
    .ready-row aa-icon { color: var(--success); }
    .ready-row:not(.checked) aa-icon { color: var(--text-light); }
    .step-nav   { display:flex; justify-content:space-between; align-items:center; }
    .text-warning { color: var(--warning); }
  `]
})
export class OnboardingComponent {
  step    = signal(0);
  loading = signal(false);
  uploading = signal(false);
  uploaded  = signal(false);
  resumeText = signal('');
  steps = [0,1,2,3,4];
  prefs = { titles:'', locations:'', remote:false };
  notif = { whatsapp:'', email:'' };
  welcomeFeatures = ['AI optimizes your resume for ATS','Auto-applies to matched jobs 24/7','WhatsApp + email updates per application','Track every application in one dashboard'];

  private resumeFile: File | null = null;

  constructor(private api: ApiService, private auth: AuthService, private toast: ToastService, private router: Router) {}

  onFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.resumeFile = file;
    this.uploadResume(file);
  }

  private uploadResume(file: File): void {
    this.uploading.set(true);
    const fd = new FormData();
    fd.append('resume', file, file.name);
    this.api.uploadResume(fd).subscribe({
      next: () => { this.uploaded.set(true); this.uploading.set(false); this.resumeText.set(file.name); },
      error: (e: any) => {
        this.uploading.set(false);
        if (e.status === 403) this.toast.info('Verify your email (check your inbox) to upload a resume — you can do this later from the Resume page.');
        else this.toast.error(e.error?.message || 'Resume upload failed');
      },
    });
  }

  next(): void {
    if (this.step() === 1 && this.resumeText() && !this.uploaded() && !this.resumeFile) {
      // pasted text, not a file — upload it as a text resume before advancing
      this.uploading.set(true);
      const blob = new Blob([this.resumeText()], { type: 'text/plain' });
      const fd = new FormData();
      fd.append('resume', blob, 'resume.txt');
      this.api.uploadResume(fd).subscribe({
        next: () => { this.uploaded.set(true); this.uploading.set(false); this.step.set(this.step()+1); },
        error: (e: any) => {
          this.uploading.set(false);
          if (e.status === 403) this.toast.info('Verify your email to parse your resume — you can add it later from the Resume page.');
          else this.toast.error(e.error?.message || 'Resume parse failed');
          this.step.set(this.step()+1);
        },
      });
      return;
    }
    this.step.set(this.step()+1);
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
        this.auth.fetchMe().subscribe({
          next: () => {
            this.api.startAutomation().subscribe({
              next: () => { this.toast.success('Automation activated!'); this.router.navigate(['/dashboard']); },
              error: (e: any) => {
                if (e.status === 403) this.toast.info('Verify your email to activate automation — check your inbox.');
                this.router.navigate(['/dashboard']);
              },
            });
          },
          error: () => this.router.navigate(['/dashboard']),
        });
      },
      error: () => {
        this.toast.error('Could not save preferences — you can update them later from Settings');
        this.router.navigate(['/dashboard']);
      },
    });
  }
}
