/**
 * Theme service — manages dark/light mode with OS preference detection.
 * Stores preference in localStorage. Applies CSS class to document root.
 */
import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    // Apply theme reactively whenever it changes
    effect(() => this.applyTheme(this.theme()));

    // Listen for OS-level changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem('aa_theme')) {
          this.theme.set(e.matches ? 'dark' : 'light');
        }
      });
  }

  toggle(): void {
    const next: Theme = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(next);
    localStorage.setItem('aa_theme', next);
  }

  setTheme(t: Theme): void {
    this.theme.set(t);
    localStorage.setItem('aa_theme', t);
  }

  private getInitialTheme(): Theme {
    const stored = localStorage.getItem('aa_theme') as Theme | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(t: Theme): void {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.classList.toggle('dark-theme', t === 'dark');
  }
}
