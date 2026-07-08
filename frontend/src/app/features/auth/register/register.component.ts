import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { NeoButtonComponent } from '../../../shared/components/neo-button/neo-button.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NeoButtonComponent, ThemeToggleComponent, IconComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card neo anim-fade-in">
        <div class="auth-header">
          <div class="logo-icon"><aa-icon name="zap" [size]="24"/></div>
          <h1 class="auth-title">Create Account</h1>
          <p class="auth-sub">Start automating your job hunt — free forever</p>
          <div class="theme-wrap"><aa-theme-toggle/></div>
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="input-group">
            <label class="input-label">Full Name</label>
            <input class="neo-input" type="text" [(ngModel)]="name" name="name" placeholder="Your Name" required>
          </div>
          <div class="input-group">
            <label class="input-label">Email</label>
            <input class="neo-input" type="email" [(ngModel)]="email" name="email" placeholder="you@email.com" required>
          </div>
          <div class="input-group">
            <label class="input-label">Password</label>
            <div class="password-wrap">
              <input class="neo-input" [type]="showPwd ? 'text' : 'password'" [(ngModel)]="password" name="password"
                placeholder="Min 8 chars, 1 upper, 1 number" required minlength="8">
              <button type="button" class="pwd-toggle" (click)="showPwd = !showPwd" [attr.aria-label]="showPwd ? 'Hide password' : 'Show password'">
                <aa-icon [name]="showPwd ? 'eyeOff' : 'eye'" [size]="16"/>
              </button>
            </div>
          </div>

          <label class="consent-row">
            <input type="checkbox" [(ngModel)]="gdprConsent" name="gdprConsent" required>
            <span class="text-xs">
              I agree to the <a href="#" (click)="$event.preventDefault()">Terms</a> and
              <a href="#" (click)="$event.preventDefault()">Privacy Policy</a>, and consent to processing of my data (GDPR).
            </span>
          </label>
          <label class="consent-row">
            <input type="checkbox" [(ngModel)]="marketingConsent" name="marketingConsent">
            <span class="text-xs">Send me occasional product updates (optional)</span>
          </label>

          <aa-button type="submit" [fullWidth]="true" [loading]="loading()" [disabled]="!gdprConsent" (clicked)="onSubmit()">
            Create Free Account
          </aa-button>
        </form>

        <div class="auth-footer">
          Already have an account? <a routerLink="/auth/login" class="link">Sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); }
    .auth-card { max-width: 420px; width: 100%; padding: 36px 32px; }
    .auth-header { text-align: center; margin-bottom: 28px; position: relative; }
    .logo-icon { color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
    .auth-title { font-size: 24px; margin-bottom: 4px; }
    .auth-sub { font-size: 13px; color: var(--text-muted); }
    .theme-wrap { position: absolute; top: 0; right: 0; }
    .auth-form { display: flex; flex-direction: column; gap: 0; }
    .input-group { margin-bottom: 14px; }
    .input-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px; }
    .neo-input { width: 100%; padding: 12px 16px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: none; border-radius: 10px; box-shadow: var(--neo-inset); font-size: 13px; color: var(--text); font-family: var(--font-body); outline: none; box-sizing: border-box; }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px rgba(108,99,255,.2); }
    .neo-input::placeholder { color: var(--text-light); }
    .password-wrap { position: relative; }
    .password-wrap .neo-input { padding-right: 44px; }
    .pwd-toggle  { position: absolute; right: 12px; top: 12px; background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; }
    .consent-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; cursor: pointer; }
    .consent-row input { margin-top: 3px; flex-shrink: 0; }
    .consent-row a { color: var(--accent); }
    .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: var(--text-muted); }
    .link { color: var(--accent); font-weight: 600; margin-left: 4px; }
  `]
})
export class RegisterComponent {
  name = ''; email = ''; password = '';
  gdprConsent = false; marketingConsent = false;
  showPwd = false;
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router, private toast: ToastService) {}

  onSubmit(): void {
    if (!this.name || !this.email || !this.password) return;
    if (!this.gdprConsent) { this.toast.error('Please accept the terms to continue'); return; }
    this.loading.set(true);
    this.auth.register({
      name: this.name, email: this.email, password: this.password,
      gdprConsent: this.gdprConsent, marketingConsent: this.marketingConsent,
    }).subscribe({
      next: () => this.router.navigate(['/onboarding']),
      error: (e) => {
        this.toast.error(e.error?.message || (e.error?.errors?.[0]) || 'Registration failed');
        this.loading.set(false);
      },
    });
  }
}
