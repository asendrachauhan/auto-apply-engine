import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NeoButtonComponent } from '../../../shared/components/neo-button/neo-button.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NeoButtonComponent, ThemeToggleComponent, IconComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card neo anim-fade-in">
        <div class="auth-header">
          <div class="logo-icon"><aa-icon name="shield" [size]="24"/></div>
          <h1 class="auth-title">Reset Password</h1>
          <p class="auth-sub">We'll email you a reset link</p>
          <div class="theme-wrap"><aa-theme-toggle/></div>
        </div>

        @if (!sent()) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="input-group">
              <label class="input-label">Email</label>
              <input class="neo-input" type="email" [(ngModel)]="email" name="email" placeholder="you@email.com" required>
            </div>
            <aa-button type="submit" [fullWidth]="true" [loading]="loading()" (clicked)="onSubmit()">
              Send Reset Link
            </aa-button>
          </form>
        } @else {
          <div class="sent-state">
            <aa-icon name="checkCircle" [size]="36" class="sent-icon"/>
            <p class="text-sm">If an account exists for <strong>{{ email }}</strong>, a reset link is on its way. Check your inbox.</p>
          </div>
        }

        <div class="auth-footer">
          <a routerLink="/auth/login" class="link">Back to sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); }
    .auth-card { max-width: 400px; width: 100%; padding: 36px 32px; }
    .auth-header { text-align: center; margin-bottom: 28px; position: relative; }
    .logo-icon { color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
    .auth-title { font-size: 24px; margin-bottom: 4px; }
    .auth-sub { font-size: 13px; color: var(--text-muted); }
    .theme-wrap { position: absolute; top: 0; right: 0; }
    .input-group { margin-bottom: 16px; }
    .input-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px; }
    .neo-input { width: 100%; padding: 12px 16px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: none; border-radius: 10px; box-shadow: var(--neo-inset); font-size: 13px; color: var(--text); font-family: var(--font-body); outline: none; box-sizing: border-box; }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px rgba(108,99,255,.2); }
    .sent-state { text-align: center; padding: 12px 0 24px; }
    .sent-icon { color: var(--success); margin-bottom: 14px; }
    .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; }
    .link { color: var(--accent); font-weight: 600; }
  `]
})
export class ForgotPasswordComponent {
  email = '';
  loading = signal(false);
  sent = signal(false);

  constructor(private auth: AuthService) {}

  onSubmit(): void {
    if (!this.email) return;
    this.loading.set(true);
    this.auth.forgotPassword(this.email).subscribe({
      next: () => { this.sent.set(true); this.loading.set(false); },
      error: () => { this.sent.set(true); this.loading.set(false); }, // never reveal whether email exists
    });
  }
}
