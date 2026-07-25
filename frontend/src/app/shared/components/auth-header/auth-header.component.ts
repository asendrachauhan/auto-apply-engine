import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { LanguageDropdownComponent } from '../language-dropdown/language-dropdown.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Shared top bar for every unauthenticated page (login, register,
 * forgot/reset password, verify email). Gives logged-out visitors a way to
 * switch language and theme before they ever sign in — previously only
 * available from the sidebar, which only exists after login.
 */
@Component({
  selector: 'aa-auth-header',
  standalone: true,
  imports: [CommonModule, RouterModule, ThemeToggleComponent, LanguageDropdownComponent, IconComponent],
  template: `
    <header class="auth-topbar">
      <a routerLink="/auth/login" class="brand">
        <span class="brand-icon"><aa-icon name="zap" [size]="20"/></span>
        <span class="brand-name">AutoApply AI</span>
      </a>
      <div class="topbar-controls">
        <aa-language-dropdown/>
        <aa-theme-toggle/>
      </div>
    </header>
  `,
  styles: [`
    .auth-topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      height: 64px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
    }
    .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); }
    .brand-icon { color: var(--accent); display: flex; }
    .brand-name { font-family: var(--font-display); font-weight: 700; font-size: 15px; }
    .topbar-controls { display: flex; align-items: center; gap: 10px; }

    @media (max-width: 480px) {
      .auth-topbar { padding: 0 14px; }
      .brand-name { display: none; }
    }
  `]
})
export class AuthHeaderComponent {}
