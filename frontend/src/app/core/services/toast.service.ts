import { Injectable, signal } from '@angular/core';

export interface Toast { id: string; message: string; type: 'success'|'error'|'info'|'warning'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  toasts = this._toasts.asReadonly();

  show(message: string, type: Toast['type'] = 'info', duration = 4000) {
    const id = crypto.randomUUID();
    this._toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.remove(id), duration);
  }
  remove(id: string) { this._toasts.update(t => t.filter(x => x.id !== id)); }

  success(message: string, duration = 4000) { this.show(message, 'success', duration); }
  error(message: string, duration = 5000)   { this.show(message, 'error', duration); }
  info(message: string, duration = 4000)    { this.show(message, 'info', duration); }
  warning(message: string, duration = 4500) { this.show(message, 'warning', duration); }
}
