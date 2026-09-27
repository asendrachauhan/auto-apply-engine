import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type BtnSize    = 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'aa-button',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <button
      [class]="classes"
      [disabled]="disabled || loading"
      (click)="!disabled && !loading && clicked.emit($event)"
      [attr.type]="type"
    >
      <span *ngIf="loading" class="spinner"></span>
      <aa-icon *ngIf="icon && !loading" [name]="icon" [size]="iconSize" class="btn-icon-left"/>
      <span class="btn-label"><ng-content /></span>
      <aa-icon *ngIf="iconRight && !loading" [name]="iconRight" [size]="iconSize" class="btn-icon-right"/>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }

    button {
      font-family: var(--font-body); font-weight: 600; border: none;
      border-radius: var(--radius-pill); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px; white-space: nowrap;
      transition: transform var(--duration-fast) var(--ease-out),
                  box-shadow var(--duration-base) var(--ease-out),
                  background var(--duration-base) var(--ease-out),
                  opacity var(--duration-fast) var(--ease-out);
    }
    button:focus-visible {
      outline: 2px solid var(--accent); outline-offset: 2px;
    }
    button.size-xs  { padding: 4px 7px; font-size: 11px; border-radius:8px; }
    button.size-sm  { padding: 7px 16px;  font-size: 12px; }
    button.size-md  { padding: 11px 22px; font-size: 13px; }
    button.size-lg  { padding: 14px 28px; font-size: 15px; }
    button.full     { width: 100%; }

    button.primary  { background: linear-gradient(135deg, var(--accent), var(--accent-secondary)); color: #fff; box-shadow: 4px 4px 12px var(--accent-button-shadow); }
    button.primary:hover:not(:disabled)  { transform: translateY(-1px); box-shadow: 6px 6px 18px var(--accent-button-shadow-hover); }
    button.primary:active:not(:disabled) { transform: translateY(0) scale(.97); box-shadow: 2px 2px 8px var(--accent-ring-strong); }

    button.secondary { background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); color: var(--text); box-shadow: var(--neo-sm); }
    button.secondary:hover:not(:disabled)  { box-shadow: var(--neo-raised); }
    button.secondary:active:not(:disabled) { box-shadow: var(--neo-inset); transform: scale(.97); }

    button.danger  { background: linear-gradient(135deg, var(--danger), var(--danger-secondary)); color: #fff; box-shadow: 4px 4px 12px var(--danger-button-shadow); }
    button.danger:hover:not(:disabled) { transform: translateY(-1px); }
    button.danger:active:not(:disabled) { transform: translateY(0) scale(.97); }

    button.success { background: linear-gradient(135deg, var(--success), var(--success-secondary)); color: #1a2d1a; box-shadow: 4px 4px 12px var(--success-button-shadow); }

    button.ghost { background: transparent; color: var(--accent); box-shadow: none; padding-left: 4px; padding-right: 4px; }
    button.ghost:hover:not(:disabled) { background: var(--accent-dim); }

    button:disabled { opacity: .48; cursor: not-allowed; transform: none !important; }

    .spinner {
      width: 14px; height: 14px; border: 2px solid var(--button-spinner-track);
      border-top-color: currentColor; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class NeoButtonComponent {
  @Input() variant: BtnVariant = 'primary';
  @Input() size:    BtnSize    = 'md';
  @Input() loading = false;
  @Input() disabled = false;
  @Input() icon?: string;
  @Input() iconRight?: string;
  @Input() type: 'button' | 'submit' = 'button';
  @Input() fullWidth = false;

  get iconSize(): number { return this.size === 'lg' ? 18 : this.size === 'md' ? 16 : 14; }

  @Output() clicked = new EventEmitter<MouseEvent>();

  get classes(): string {
    return [this.variant, `size-${this.size}`, this.fullWidth ? 'full' : ''].filter(Boolean).join(' ');
  }
}
