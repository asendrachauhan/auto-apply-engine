import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'aa-toast',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="toast-container">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast anim-slide-in" [class]="t.type" (click)="toast.remove(t.id)">
          <aa-icon class="toast-icon" [name]="icons[t.type]" [size]="18"/>
          <span class="toast-msg">{{ t.message }}</span>
          <button class="toast-close" aria-label="Dismiss"><aa-icon name="close" [size]="12"/></button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px;
      max-width: min(340px, calc(100vw - 32px));
    }
    .toast {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; border-radius: 12px;
      background: var(--bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); box-shadow: var(--neo-float);
      font-size: 13px; font-weight: 600; color: var(--text);
      cursor: pointer; animation: slideIn .3s ease;
      border-left: 4px solid transparent;
    }
    .toast.success { border-left-color: var(--success); }
    .toast.error   { border-left-color: var(--danger);  }
    .toast.info    { border-left-color: var(--accent);  }
    .toast.warning { border-left-color: var(--warning); }
    .toast-icon  { flex-shrink: 0; }
    .toast.success .toast-icon { color: var(--success); }
    .toast.error   .toast-icon { color: var(--danger);  }
    .toast.info    .toast-icon { color: var(--accent);  }
    .toast.warning .toast-icon { color: var(--warning); }
    .toast-msg   { flex: 1; line-height: 1.4; }
    .toast-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; flex-shrink: 0; }
    @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `]
})
export class ToastComponent {
  icons: Record<string, string> = { success:'checkCircle', error:'xCircle', info:'info', warning:'alertTriangle' };
  constructor(public toast: ToastService) {}
}
