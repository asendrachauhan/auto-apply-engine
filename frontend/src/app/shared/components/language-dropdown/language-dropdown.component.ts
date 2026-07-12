import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../core/services/language.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Shared language switcher — a compact dropdown so it fits in a top header
 * bar (used on auth pages pre-login and in the main app header post-login).
 * Backed by LanguageService, the single source of truth for the active lang.
 */
@Component({
  selector: 'aa-language-dropdown',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="lang-dropdown">
      <button class="lang-trigger" (click)="open.set(!open())" [attr.aria-expanded]="open()" title="Change language">
        <aa-icon name="globe" [size]="16"/>
        <span class="lang-current">{{ current()?.label }}</span>
        <aa-icon name="chevronDown" [size]="12" class="chevron" [class.flipped]="open()"/>
      </button>
      @if (open()) {
        <div class="lang-menu">
          @for (lang of lang.languages; track lang.code) {
            <button class="lang-option" [class.active]="lang.code === lang.code && lang.code === current()?.code"
              (click)="select(lang.code)">
              <span class="opt-label">{{ lang.label }}</span>
              <span class="opt-name">{{ lang.name }}</span>
              @if (lang.code === current()?.code) { <aa-icon name="check" [size]="14" class="check"/> }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .lang-dropdown { position: relative; }
    .lang-trigger {
      display: flex; align-items: center; gap: 6px;
      height: 40px; padding: 0 12px; border-radius: 20px;
      background: var(--glass-bg-strong); border: 1px solid var(--glass-border);
      box-shadow: var(--neo-sm); cursor: pointer;
      color: var(--text-muted); font-size: 12px; font-weight: 700;
      transition: all .2s;
    }
    .lang-trigger:hover { color: var(--accent); box-shadow: var(--neo-raised); }
    .chevron { transition: transform .2s; }
    .chevron.flipped { transform: rotate(180deg); }

    .lang-menu {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 300;
      width: 200px; max-height: 320px; overflow-y: auto;
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: 12px; box-shadow: var(--neo-raised), 0 12px 32px rgba(0,0,0,.35);
      padding: 6px; display: flex; flex-direction: column; gap: 2px;
      animation: menuIn .15s ease;
    }
    @keyframes menuIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    .lang-option {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 8px; border: none; background: none;
      cursor: pointer; text-align: left; color: var(--text);
      font-size: 13px; transition: background .15s;
    }
    .lang-option:hover { background: rgba(108,99,255,.08); }
    .lang-option.active { color: var(--accent); background: rgba(108,99,255,.1); }
    .opt-label { font-weight: 800; font-size: 11px; width: 22px; flex-shrink: 0; color: var(--text-muted); }
    .opt-name  { flex: 1; }
    .check     { color: var(--accent); flex-shrink: 0; }
  `]
})
export class LanguageDropdownComponent {
  lang = inject(LanguageService);
  open = signal(false);

  current() { return this.lang.languages.find(l => l.code === this.lang.currentLang()); }

  select(code: string) {
    this.lang.setLang(code);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!(ev.target as HTMLElement).closest('.lang-dropdown')) this.open.set(false);
  }
}
