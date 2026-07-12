import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { NeoButtonComponent } from '../../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthHeaderComponent } from '../../../shared/components/auth-header/auth-header.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'aa-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NeoButtonComponent, IconComponent, AuthHeaderComponent, TranslateModule],
  template: `
    <aa-auth-header/>
    <div class="auth-page">
      <div class="auth-card neo anim-fade-in">

        <div class="auth-header">
          <div class="logo-icon"><aa-icon name="zap" [size]="24"/></div>
          <h1 class="auth-title">{{ 'AUTH.SIGN_IN_TITLE' | translate }}</h1>
          <p class="auth-sub">{{ 'AUTH.SIGN_IN_SUBTITLE' | translate }}</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="input-group">
            <label class="input-label">{{ 'AUTH.EMAIL' | translate }}</label>
            <input class="neo-input" type="email" [(ngModel)]="email" name="email"
              [placeholder]="'AUTH.EMAIL_PLACEHOLDER' | translate" required autocomplete="email">
          </div>

          <div class="input-group">
            <label class="input-label">{{ 'AUTH.PASSWORD' | translate }}</label>
            <div class="password-wrap">
              <input class="neo-input" [type]="showPwd ? 'text' : 'password'"
                [(ngModel)]="password" name="password" placeholder="••••••••"
                required autocomplete="current-password">
              <button type="button" class="pwd-toggle" (click)="showPwd = !showPwd" [attr.aria-label]="(showPwd ? 'AUTH.HIDE_PASSWORD' : 'AUTH.SHOW_PASSWORD') | translate">
                <aa-icon [name]="showPwd ? 'eyeOff' : 'eye'" [size]="16"/>
              </button>
            </div>
            <div class="forgot-link"><a routerLink="/auth/forgot-password" class="link">{{ 'AUTH.FORGOT_PASSWORD' | translate }}</a></div>
          </div>

          <aa-button type="submit" [fullWidth]="true" [loading]="loading()" (clicked)="onSubmit()">
            {{ 'AUTH.SIGN_IN_BTN' | translate }}
          </aa-button>
        </form>

        <div class="auth-footer">
          {{ 'AUTH.NO_ACCOUNT' | translate }}
          <a routerLink="/auth/register" class="link">{{ 'AUTH.CREATE_FREE' | translate }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 96px 20px 20px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border);
    }
    .auth-card   { max-width: 400px; width: 100%; padding: 36px 32px; }
    .auth-header { text-align: center; margin-bottom: 28px; position: relative; }
    .logo-icon   { color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
    .auth-title  { font-size: 24px; margin-bottom: 4px; }
    .auth-sub    { font-size: 13px; color: var(--text-muted); }

    .auth-form   { display: flex; flex-direction: column; gap: 0; }

    .password-wrap { position: relative; }
    .password-wrap .neo-input { padding-right: 44px; }
    .pwd-toggle  { position: absolute; right: 12px; top: 12px; background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; }
    .forgot-link { text-align: right; margin-top: 6px; margin-bottom: 16px; }
    .forgot-link .link { font-size: 12px; }

    .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: var(--text-muted); }
    .link        { color: var(--accent); font-weight: 600; margin-left: 4px; }

    .input-group { margin-bottom: 16px; }
    .input-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px; }
    .neo-input   { width: 100%; padding: 12px 16px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: none;
      border-radius: 10px; box-shadow: var(--neo-inset); font-size: 13px;
      color: var(--text); font-family: var(--font-body); outline: none; box-sizing: border-box; }
    .neo-input:focus { box-shadow: var(--neo-inset), 0 0 0 2px rgba(108,99,255,.2); }
    .neo-input::placeholder { color: var(--text-light); }
  `]
})
export class LoginComponent {
  email    = '';
  password = '';
  showPwd  = false;
  loading  = signal(false);

  constructor(private auth: AuthService, private router: Router, private toast: ToastService, private translate: TranslateService) {}

  onSubmit(): void {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e) => {
        this.toast.error(e.error?.message || this.translate.instant('AUTH.LOGIN_FAILED'));
        this.loading.set(false);
      },
    });
  }
}
