import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { NeoButtonComponent } from '../../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card neo anim-fade-in">
        <div class="auth-header">
          <div class="logo-icon"><aa-icon name="shield" [size]="24"/></div>
          <h1 class="auth-title">Set New Password</h1>
          <p class="auth-sub">Choose a strong new password for your account</p>
        </div>

        @if (!token) {
          <div class="error-state">
            <aa-icon name="alertTriangle" [size]="32" class="err-icon"/>
            <p class="text-sm">This reset link is missing its token. Request a new one from the sign-in page.</p>
            <a routerLink="/auth/forgot-password" class="link">Request new link</a>
          </div>
        } @else if (!done()) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="input-group">
              <label class="input-label">New Password</label>
              <input class="neo-input" type="password" [(ngModel)]="password" name="password"
                placeholder="Min 8 chars, 1 upper, 1 number" required minlength="8">
            </div>
            <div class="input-group">
              <label class="input-label">Confirm Password</label>
              <input class="neo-input" type="password" [(ngModel)]="confirm" name="confirm" placeholder="Repeat password" required>
            </div>
            <aa-button type="submit" [fullWidth]="true" [loading]="loading()" (clicked)="onSubmit()">Reset Password</aa-button>
          </form>
        } @else {
          <div class="sent-state">
            <aa-icon name="checkCircle" [size]="36" class="sent-icon"/>
            <p class="text-sm">Password reset. You can sign in now.</p>
            <a routerLink="/auth/login" class="link">Go to sign in</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); }
    .auth-card { max-width: 400px; width: 100%; padding: 36px 32px; }
    .auth-header { text-align: center; margin-bottom: 28px; }
    .logo-icon { color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
    .auth-title { font-size: 24px; margin-bottom: 4px; }
    .auth-sub { font-size: 13px; color: var(--text-muted); }
    .input-group { margin-bottom: 16px; }
    .input-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px; }
    .neo-input { width: 100%; padding: 12px 16px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: none; border-radius: 10px; box-shadow: var(--neo-inset); font-size: 13px; color: var(--text); font-family: var(--font-body); outline: none; box-sizing: border-box; }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px rgba(108,99,255,.2); }
    .sent-state, .error-state { text-align: center; padding: 12px 0 8px; }
    .sent-icon { color: var(--success); margin-bottom: 14px; }
    .err-icon  { color: var(--warning); margin-bottom: 14px; }
    .link { color: var(--accent); font-weight: 600; display: inline-block; margin-top: 12px; }
  `]
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = ''; confirm = '';
  loading = signal(false);
  done = signal(false);

  constructor(private route: ActivatedRoute, private auth: AuthService, private toast: ToastService, private router: Router) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  onSubmit(): void {
    if (!this.password || this.password !== this.confirm) {
      this.toast.error('Passwords do not match'); return;
    }
    this.loading.set(true);
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: () => { this.done.set(true); this.loading.set(false); },
      error: (e) => { this.toast.error(e.error?.message || 'Reset failed — the link may have expired'); this.loading.set(false); },
    });
  }
}
