/**
 * Feature Flags Service (Session 37).
 *
 * Fetches the real, admin-controlled payments/referrals toggle state from
 * GET /api/config/features once, and exposes it as signals. This mirrors
 * the actual backend enforcement (see backend/src/config/featureFlags
 * .service.js) — the frontend hiding paid/referral UI here is a UX
 * courtesy on top of real backend gating, not the only line of defense.
 *
 * Unauthenticated endpoint, so this can be called before login too (the
 * register page needs `referralsEnabled` to decide whether to show the
 * referral-code field).
 */
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  private http = inject(HttpClient);

  private _paymentsEnabled  = signal(true); // fail-open default, same as the backend's own fail-open behavior
  private _referralsEnabled = signal(true);
  private _loaded = signal(false);

  paymentsEnabled  = this._paymentsEnabled.asReadonly();
  referralsEnabled = this._referralsEnabled.asReadonly();
  loaded = this._loaded.asReadonly();

  /** Call once at app/component init. Safe to call multiple times — cheap GET, no side effects. */
  load(): void {
    this.http.get<{ data: { paymentsEnabled: boolean; referralsEnabled: boolean } }>(
      `${environment.apiUrl}/config/features`
    ).subscribe({
      next: (r) => {
        this._paymentsEnabled.set(r.data?.paymentsEnabled ?? true);
        this._referralsEnabled.set(r.data?.referralsEnabled ?? true);
        this._loaded.set(true);
      },
      error: () => {
        // Fail open — same reasoning as the backend: a flags-fetch failure
        // should never itself hide/break payment or referral functionality.
        this._loaded.set(true);
      },
    });
  }

  /** Update flags dynamically (e.g. from admin toggles) so UI reacts immediately without page refresh */
  updateFlags(flags: { paymentsEnabled?: boolean; referralsEnabled?: boolean }): void {
    if (flags.paymentsEnabled !== undefined) this._paymentsEnabled.set(flags.paymentsEnabled);
    if (flags.referralsEnabled !== undefined) this._referralsEnabled.set(flags.referralsEnabled);
  }
}
