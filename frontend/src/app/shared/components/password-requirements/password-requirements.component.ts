import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Live password-requirements checklist. Mirrors the EXACT backend rule
 * (see backend/src/controllers/auth.controller.js — registerRules' password
 * .matches() regex, and resetPassword's inline regex: both require
 * `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/`) so the frontend never claims a
 * password is valid when the backend would actually reject it.
 *
 * Usage: <aa-password-requirements [password]="password" />
 * Bind `password` to the same ngModel the form field uses.
 */
@Component({
  selector: 'aa-password-requirements',
  standalone: true,
  imports: [CommonModule, TranslateModule, IconComponent],
  template: `
    @if (password) {
      <ul class="pwd-reqs anim-fade-in" [attr.aria-live]="'polite'">
        <li [class.met]="hasLength()">
          <aa-icon [name]="hasLength() ? 'checkCircle' : 'circle'" [size]="12"/>
          {{ 'AUTH.PWD_REQ_LENGTH' | translate }}
        </li>
        <li [class.met]="hasCase()">
          <aa-icon [name]="hasCase() ? 'checkCircle' : 'circle'" [size]="12"/>
          {{ 'AUTH.PWD_REQ_CASE' | translate }}
        </li>
        <li [class.met]="hasNumber()">
          <aa-icon [name]="hasNumber() ? 'checkCircle' : 'circle'" [size]="12"/>
          {{ 'AUTH.PWD_REQ_NUMBER' | translate }}
        </li>
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }
    .pwd-reqs { list-style: none; padding: 0; margin: 8px 0 12px; display: flex; flex-direction: column; gap: 4px; }
    .pwd-reqs li { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); transition: color var(--duration-fast, .12s) var(--ease-out, ease); }
    .pwd-reqs li aa-icon { color: var(--text-light); flex-shrink: 0; }
    .pwd-reqs li.met { color: var(--success); }
    .pwd-reqs li.met aa-icon { color: var(--success); }
  `],
})
export class PasswordRequirementsComponent {
  private _password = signal('');
  @Input() set password(v: string) { this._password.set(v || ''); }
  get password(): string { return this._password(); }

  hasLength = computed(() => this._password().length >= 8);
  hasCase   = computed(() => /(?=.*[a-z])(?=.*[A-Z])/.test(this._password()));
  hasNumber = computed(() => /\d/.test(this._password()));

  /** True only when every backend-enforced rule is satisfied. */
  isValid = computed(() => this.hasLength() && this.hasCase() && this.hasNumber());
}
