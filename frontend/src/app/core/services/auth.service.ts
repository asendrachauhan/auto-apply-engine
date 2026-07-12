import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router }     from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  _id: string; name: string; email: string; plan: string;
  emailVerified: boolean; automationActive: boolean; dailyApplyLimit: number;
  onboardingComplete: boolean; preferences: any;
  notificationSettings: any; planLimits: any;
  linkedinUrl?: string; githubUrl?: string; portfolioUrl?: string;
  createdAt?: string;
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
    return this.http.get<any>(`${this.api}/verify-email?token=${token}`);
  }

  logout() {
    this.http.post(`${this.api}/logout`, {}).subscribe();
    this.clearSession();
    this.router.navigate(['/auth']);
  }

  fetchMe() {
    return this.http.get<any>(`${this.api}/me`).pipe(tap(r => this._user.set(r.data)));
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

  refreshAccessToken() {
    const token = localStorage.getItem(REFRESH_KEY);
    if (!token) return throwError(() => new Error('No refresh token'));
    return this.http.post<any>(`${this.api}/refresh`, { refreshToken: token }).pipe(
      tap(r => {
        localStorage.setItem(TOKEN_KEY,   r.data.accessToken);
        localStorage.setItem(REFRESH_KEY, r.data.refreshToken);
      })
    );
  }

  getAccessToken(): string | null { return localStorage.getItem(TOKEN_KEY); }

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
