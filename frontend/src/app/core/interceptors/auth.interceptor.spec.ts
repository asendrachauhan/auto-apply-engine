import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

const run = (req: HttpRequest<any>, next: HttpHandlerFn) =>
  TestBed.runInInjectionContext(() => authInterceptor(req, next));

describe('authInterceptor', () => {
  let authStub: any;
  let routerStub: { navigate: jest.Mock };

  beforeEach(() => {
    authStub = {
      getAccessToken: jest.fn().mockReturnValue('current-token'),
      refreshAccessToken: jest.fn(),
      logout: jest.fn(),
    };
    routerStub = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    });
  });

  test('attaches the Authorization header when a token exists', (done) => {
    const req = new HttpRequest('GET', '/api/jobs');
    const next: HttpHandlerFn = (r) => {
      expect(r.headers.get('Authorization')).toBe('Bearer current-token');
      done();
      return of(new HttpResponse({ status: 200 }));
    };
    run(req, next).subscribe();
  });

  test('does not attach a header when there is no token', (done) => {
    authStub.getAccessToken.mockReturnValue(null);
    const req = new HttpRequest('GET', '/api/jobs');
    const next: HttpHandlerFn = (r) => {
      expect(r.headers.has('Authorization')).toBe(false);
      done();
      return of(new HttpResponse({ status: 200 }));
    };
    run(req, next).subscribe();
  });

  test('on a 401 from an auth-critical endpoint (/api/auth/me), refreshes the token and retries the request', (done) => {
    authStub.refreshAccessToken.mockReturnValue(of({ data: { accessToken: 'new-token' } }));
    let callCount = 0;
    const req = new HttpRequest('GET', '/api/auth/me');
    const next: HttpHandlerFn = (r) => {
      callCount++;
      if (callCount === 1) return throwError(() => new HttpErrorResponse({ status: 401 }));
      expect(r.headers.get('Authorization')).toBe('Bearer new-token');
      return of(new HttpResponse({ status: 200 }));
    };

    run(req, next).subscribe({
      next: () => {
        expect(callCount).toBe(2);
        expect(authStub.logout).not.toHaveBeenCalled();
        done();
      },
    });
  });

  test('refreshes token on 401 from protected /api/ endpoints like /api/notifications/unread-count', (done) => {
    authStub.refreshAccessToken.mockReturnValue(of({ data: { accessToken: 'new-token' } }));
    let callCount = 0;
    const req = new HttpRequest('GET', '/api/notifications/unread-count');
    const next: HttpHandlerFn = (r) => {
      callCount++;
      if (callCount === 1) return throwError(() => new HttpErrorResponse({ status: 401 }));
      expect(r.headers.get('Authorization')).toBe('Bearer new-token');
      return of(new HttpResponse({ status: 200 }));
    };

    run(req, next).subscribe({
      next: () => {
        expect(callCount).toBe(2);
        expect(authStub.refreshAccessToken).toHaveBeenCalledTimes(1);
        expect(authStub.logout).not.toHaveBeenCalled();
        done();
      },
    });
  });

  test('refreshes token on 401 from /api/resume/my and retries', (done) => {
    authStub.refreshAccessToken.mockReturnValue(of({ data: { accessToken: 'new-token' } }));
    let callCount = 0;
    const req = new HttpRequest('GET', '/api/resume/my');
    const next: HttpHandlerFn = (r) => {
      callCount++;
      if (callCount === 1) return throwError(() => new HttpErrorResponse({ status: 401 }));
      return of(new HttpResponse({ status: 200 }));
    };

    run(req, next).subscribe({
      next: () => {
        expect(callCount).toBe(2);
        expect(authStub.refreshAccessToken).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  test('does NOT attempt a refresh for excluded auth endpoints like /auth/login — a 401 there means bad credentials', (done) => {
    const req = new HttpRequest('POST', '/auth/login', {});
    const next: HttpHandlerFn = () => throwError(() => new HttpErrorResponse({ status: 401 }));

    run(req, next).subscribe({
      error: () => {
        expect(authStub.refreshAccessToken).not.toHaveBeenCalled();
        done();
      },
    });
  });

  test('logs the user out if the refresh attempt itself fails', (done) => {
    authStub.refreshAccessToken.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const req = new HttpRequest('GET', '/api/auth/me');
    const next: HttpHandlerFn = () => throwError(() => new HttpErrorResponse({ status: 401 }));

    run(req, next).subscribe({
      error: () => {
        expect(authStub.logout).toHaveBeenCalled();
        done();
      },
    });
  });

  test('a non-401 error passes through untouched — no refresh attempt', (done) => {
    const req = new HttpRequest('GET', '/api/jobs');
    const next: HttpHandlerFn = () => throwError(() => new HttpErrorResponse({ status: 500 }));

    run(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(500);
        expect(authStub.refreshAccessToken).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
