import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'aa-theme-toggle',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <button class="theme-toggle" (click)="theme.toggle()" [title]="label" [attr.aria-label]="label">
      <aa-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="18"/>
    </button>
  `,
  styles: [`
    .theme-toggle {
      width: 40px; height: 40px; border-radius: 50%; border: none;
      background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-sm); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-muted); transition: all 0.25s ease;
    }
    .theme-toggle:hover { box-shadow: var(--neo-raised); transform: scale(1.05); color: var(--accent); }
    .theme-toggle:active { box-shadow: var(--neo-inset); transform: scale(0.95); }
  `]
})
export class ThemeToggleComponent {
  constructor(public theme: ThemeService) {}
  get label() { return this.theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; }
}
