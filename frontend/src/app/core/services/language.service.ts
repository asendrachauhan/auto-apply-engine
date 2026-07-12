import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface LanguageOption { code: string; label: string; name: string; }

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'zh', label: '中', name: '中文' },
  { code: 'hi', label: 'हि', name: 'हिंदी' },
  { code: 'ar', label: 'ع',  name: 'العربية' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'ru', label: 'РУ', name: 'Русский' },
  { code: 'ja', label: '日', name: '日本語' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
];

const LANG_KEY = 'aa_lang';

/**
 * Single source of truth for the active UI language. Initialized once via
 * APP_INITIALIZER (app.config.ts) so it's already active before ANY route —
 * including the auth/login pages — renders. Previously this lived only
 * inside SidebarComponent, which meant the saved language was never applied
 * pre-login and auth pages had no way to switch language at all.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  languages = LANGUAGES;
  private _currentLang = signal('en');
  currentLang = this._currentLang.asReadonly();

  constructor(private translate: TranslateService) {}

  init(): Promise<void> {
    const saved = localStorage.getItem(LANG_KEY) || this.detectBrowserLang() || 'en';
    this.translate.setDefaultLang('en');
    return new Promise(resolve => {
      this.translate.use(saved).subscribe({
        next: () => { this.applyLang(saved); resolve(); },
        error: () => { this.applyLang('en'); resolve(); },
      });
    });
  }

  setLang(code: string): void {
    this.translate.use(code).subscribe(() => this.applyLang(code));
  }

  private applyLang(code: string): void {
    this._currentLang.set(code);
    localStorage.setItem(LANG_KEY, code);
    document.documentElement.setAttribute('lang', code);
    document.documentElement.setAttribute('dir', code === 'ar' ? 'rtl' : 'ltr');
  }

  private detectBrowserLang(): string | null {
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    return this.languages.some(l => l.code === nav) ? nav : null;
  }
}
