import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router }     from '@angular/router';
import { tap, catchError, shareReplay, finalize } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  _id: string; name: string; email: string; plan: string;
  emailVerified: boolean; automationActive: boolean; dailyApplyLimit: number;
  onboardingComplete: boolean; preferences: any;
  notificationSettings: any; planLimits: any;
  linkedinUrl?: string; githubUrl?: string; portfolioUrl?: string;
  createdAt?: string;
  role?: 'user' | 'admin';
  referralCode?: string; referralPoints?: number;
}

const TOKEN_KEY   = 'aa_at';
const REFRESH_KEY = 'aa_rt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private _user  = signal<User | null>(null);

  currentUser = this._user.asReadonly();
  private _sessionReady = signal(false);
  sessionReady = this._sessionReady.asReadonly();

  private get api() { return `${environment.apiUrl}/auth`; }

  /**
   * Resolves the persisted session (if any) before the app finishes
   * bootstrapping. Wired up via APP_INITIALIZER in app.config.ts so route
   * guards never run against a `currentUser` that hasn't loaded yet.
   */
  init(): Promise<void> {
    const token = this.getAccessToken();
    if (!token) { this._sessionReady.set(true); return Promise.resolve(); }
    return new Promise(resolve => {
      this.fetchMe().subscribe({
        next: () => { this._sessionReady.set(true); resolve(); },
        error: () => { this.clearSession(); this._sessionReady.set(true); resolve(); },
      });
    });
  }

  login(email: string, password: string) {
    return this.http.post<any>(`${this.api}/login`, { email, password }).pipe(
      tap(r => this.saveSession(r.data))
    );
  }

  register(payload: any) {
    return this.http.post<any>(`${this.api}/register`, payload).pipe(
      tap(r => this.saveSession(r.data))
    );
  }

  forgotPassword(email: string) {
    return this.http.post<any>(`${this.api}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post<any>(`${this.api}/reset-password`, { token, password });
  }

  verifyEmail(token: string) {
    return this.http.get<any>(`${this.api}/verify-email?token=${token}`).pipe(
      tap(() => {
        if (this.isLoggedIn()) {
          this.patchUser({ emailVerified: true });
        }
      })
    );
  }

  resendVerification() {
    return this.http.post<any>(`${this.api}/resend-verification`, {});
  }

  logout() {
    // Best-effort server-side logout — session is cleared and the user is
    // navigated away regardless of whether this call succeeds, so a failure
    // here should never block logout. Explicit no-op error handler makes
    // that intent clear rather than relying on RxJS's default silent
    // swallow behavior for an un-subscribed error channel.
    // Grab the refresh token BEFORE clearing local storage so the backend
    // knows which device's session entry to remove, leaving any other
    // logged-in devices untouched.
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    this.http.post(`${this.api}/logout`, { refreshToken }).subscribe({ error: () => {} });
    this.clearSession();
    this.router.navigate(['/auth']);
  }

  /** "I lost my phone" — invalidates every device's session, not just this one. */
  logoutAllDevices() {
    this.http.post(`${this.api}/logout-all`, {}).subscribe({ error: () => {} });
    this.clearSession();
    this.router.navigate(['/auth']);
  }

  /**
   * Lists this user's active device sessions. Passes the locally stored
   * refresh token as a query hint purely so the backend can mark which
   * entry is "this device" in the response — never used server-side to
   * look up anyone else's session.
   */
  getSessions() {
    const refreshToken = localStorage.getItem(REFRESH_KEY) || '';
    return this.http.get<any>(`${this.api}/sessions`, { params: { refreshToken } });
  }

  /** Revokes one specific session by id (as returned by getSessions()). */
  revokeSession(id: string) {
    return this.http.delete<any>(`${this.api}/sessions/${id}`);
  }

  fetchMe() {
    return this.http.get<any>(`${this.api}/me`).pipe(tap(r => this._user.set(r.data)));
  }

  /**
   * Optimistically patch the locally-cached user object without a network
   * round trip. For cases where a write we just confirmed succeeded on the
   * backend needs to be reflected locally right away, and a *separate*
   * fetchMe() call to pick it up could itself fail — leaving guards like
   * onboardingGuard reading stale local state even though the backend is
   * already correct (see onboarding.component.ts's finish()).
   */
  patchUser(partial: Partial<User>): void {
    const current = this._user();
    if (current) this._user.set({ ...current, ...partial });
  }

  updateProfile(payload: { name?: string; linkedinUrl?: string; githubUrl?: string; portfolioUrl?: string }) {
    return this.http.patch<any>(`${this.api}/profile`, payload).pipe(tap(r => this._user.set(r.data)));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.patch<any>(`${this.api}/password`, { currentPassword, newPassword });
  }

  deleteAccount(password: string) {
    return this.http.request<any>('delete', `${this.api}/account`, { body: { password } }).pipe(
      tap(() => this.clearSession())
    );
  }

  // Concurrent 401s (e.g. a page firing several API calls right as the
  // access token expires) must NOT each trigger their own refresh call —
  // the backend rotates the refresh token on every successful use, so only
  // the first of several simultaneous refresh requests would succeed; the
  // others would be rejected as reusing an already-rotated token, which
  // would spuriously log the user out even though their session is still
  // valid. This caches the in-flight request so every concurrent caller
  // shares the same one, and clears the cache once it settles so the next,
  // later refresh (a genuinely new expiry) fires fresh.
  private refreshInFlight$: Observable<any> | null = null;

  refreshAccessToken() {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    const token = localStorage.getItem(REFRESH_KEY);
    if (!token) return throwError(() => new Error('No refresh token'));

    this.refreshInFlight$ = this.http.post<any>(`${this.api}/refresh`, { refreshToken: token }).pipe(
      tap(r => {
        localStorage.setItem(TOKEN_KEY,   r.data.accessToken);
        localStorage.setItem(REFRESH_KEY, r.data.refreshToken);
      }),
      shareReplay(1),
      finalize(() => { this.refreshInFlight$ = null; })
    );
    return this.refreshInFlight$;
  }

  getAccessToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
  getToken(): string | null { return this.getAccessToken(); }

  isLoggedIn(): boolean { return !!this.getAccessToken(); }

  private saveSession(data: any) {
    if (data.accessToken)  localStorage.setItem(TOKEN_KEY,   data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    if (data.user)         this._user.set(data.user);
  }

  private clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this._user.set(null);
  }
}
