import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface Toast { id: string; message: string; type: 'success'|'error'|'info'|'warning'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private translate = inject(TranslateService);
  private _toasts = signal<Toast[]>([]);
  toasts = this._toasts.asReadonly();

  private localize(msg: string): string {
    if (!msg || typeof msg !== 'string') return '';
    // Check if directly a key
    const translated = this.translate.instant(msg);
    if (translated && translated !== msg) return translated;

    const lower = msg.toLowerCase().trim();
    if (lower.includes('too many requests')) return this.translate.instant('API_ERRORS.TOO_MANY_REQUESTS');
    if (lower.includes('invalid email or password')) return this.translate.instant('API_ERRORS.INVALID_CREDENTIALS');
    if (lower.includes('already in use') || lower.includes('already registered')) return this.translate.instant('API_ERRORS.EMAIL_IN_USE');
    if (lower.includes('verify your email')) return this.translate.instant('API_ERRORS.VERIFY_EMAIL_REQUIRED');
    if (lower.includes('could not extract text') || lower.includes('extract text from that file')) return this.translate.instant('API_ERRORS.FILE_TEXT_EXTRACTION_FAILED');
    if (lower.includes('content is too short') || lower.includes('too short')) return this.translate.instant('API_ERRORS.RESUME_TOO_SHORT');
    if (lower.includes('upload failed')) return this.translate.instant('API_ERRORS.UPLOAD_FAILED');
    if (lower.includes('parse failed')) return this.translate.instant('API_ERRORS.PARSE_FAILED');
    if (lower.includes('pipeline failed')) return this.translate.instant('API_ERRORS.PIPELINE_FAILED');

    return msg;
  }

  show(message: string, type: Toast['type'] = 'info', duration = 4000) {
    const id = crypto.randomUUID();
    const localizedMessage = this.localize(message);
    this._toasts.update(t => [...t, { id, message: localizedMessage, type }]);
    setTimeout(() => this.remove(id), duration);
  }

  remove(id: string) { this._toasts.update(t => t.filter(x => x.id !== id)); }

  success(message: string, duration = 4000) { this.show(message, 'success', duration); }
  error(message: string, duration = 5000)   { this.show(message, 'error', duration); }
  info(message: string, duration = 4000)    { this.show(message, 'info', duration); }
  warning(message: string, duration = 4500) { this.show(message, 'warning', duration); }
}
