import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router }      from '@angular/router';

// Endpoints that must NOT trigger a silent refresh-and-retry: hitting 401 on
// these means the credentials/token supplied in the request itself were
// rejected, not that our access token expired. Anything else under /auth/
// (e.g. /auth/me, /auth/profile, /auth/password) is a normal authenticated
// endpoint and DOES need the refresh flow on 401.
const AUTH_EXCLUDED_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email', '/auth/logout'];

// All requests under /api/ are protected application endpoints that require
// access token refreshing on 401.

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const token  = auth.getAccessToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only treat 401 as "session expired" if:
      // 1. It's NOT in the excluded list (login, register, etc.)
      // 2. It IS from an auth-critical path (only our auth system, not external APIs)
      // This prevents Stripe 401s or other external API failures from logging out the user
      const isExcludedPath = AUTH_EXCLUDED_PATHS.some(p => req.url.includes(p));
      const isApiRequest = req.url.includes('/api/');

      if (err.status === 401 && !isExcludedPath && isApiRequest) {
        return auth.refreshAccessToken().pipe(
          switchMap(r => {
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${r.data.accessToken}` } });
            return next(retried);
          }),
          catchError(() => { auth.logout(); return throwError(() => err); })
        );
      }
      return throwError(() => err);
    })
  );
};
