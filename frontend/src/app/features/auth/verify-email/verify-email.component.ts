import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NeoButtonComponent } from '../../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card neo anim-fade-in">
        @if (state() === 'checking') {
          <div class="state-block">
            <div class="spinner"></div>
            <p class="text-sm mt-16">Verifying your email…</p>
          </div>
        } @else if (state() === 'success') {
          <div class="state-block">
            <aa-icon name="checkCircle" [size]="40" class="icon-success"/>
            <h1 class="auth-title mt-16">Email Verified</h1>
            <p class="text-sm text-muted">Automation and resume upload are now unlocked.</p>
            <a routerLink="/dashboard"><button class="link-btn">Go to Dashboard</button></a>
          </div>
        } @else {
          <div class="state-block">
            <aa-icon name="alertTriangle" [size]="40" class="icon-warn"/>
            <h1 class="auth-title mt-16">Verification Failed</h1>
            <p class="text-sm text-muted">{{ errorMsg() }}</p>
            <a routerLink="/auth/login"><button class="link-btn">Back to Sign In</button></a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); }
    .auth-card { max-width: 420px; width: 100%; padding: 40px 32px; text-align: center; }
    .state-block { display: flex; flex-direction: column; align-items: center; }
    .icon-success { color: var(--success); }
    .icon-warn    { color: var(--warning); }
    .auth-title   { font-size: 22px; }
    .spinner { width: 32px; height: 32px; border-radius: 50%; border: 3px solid var(--accent-dim); border-top-color: var(--accent); animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .link-btn {
      margin-top: 20px; padding: 10px 22px; border: none; border-radius: var(--radius-pill);
      background: linear-gradient(135deg,var(--accent),#a855f7); color: #fff;
      font-weight: 600; font-size: 13px; cursor: pointer;
    }
  `]
})
export class VerifyEmailComponent implements OnInit {
  state = signal<'checking'|'success'|'error'>('checking');
  errorMsg = signal('The verification link is invalid or has expired.');

  constructor(private route: ActivatedRoute, private auth: AuthService) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) { this.state.set('error'); this.errorMsg.set('No verification token was provided.'); return; }
    this.auth.verifyEmail(token).subscribe({
      next: () => this.state.set('success'),
      error: (e) => {
        this.state.set('error');
        this.errorMsg.set(e.error?.message || 'The verification link is invalid or has expired.');
      },
    });
  }
}
