import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerMock: { navigate: jest.Mock };

  beforeEach(() => {
    routerMock = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerMock },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  test('isLoggedIn() is false with no stored token', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  test('login() persists access/refresh tokens and user on success', () => {
    service.login('user@example.com', 'password123').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({
      data: {
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
        user: { _id: '1', name: 'Test User', email: 'user@example.com', plan: 'free' },
      },
    });

    expect(service.getAccessToken()).toBe('access-token-abc');
    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()?.email).toBe('user@example.com');
  });

  test('logout() sends the stored refresh token (so the backend removes only this device\'s session), clears session and navigates to /auth', () => {
    localStorage.setItem('aa_at', 'some-token');
    localStorage.setItem('aa_rt', 'some-refresh');

    service.logout();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'some-refresh' });
    req.flush({});

    expect(service.getAccessToken()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/auth']);
  });

  test('logoutAllDevices() hits /logout-all, clears session and navigates to /auth', () => {
    localStorage.setItem('aa_at', 'some-token');
    localStorage.setItem('aa_rt', 'some-refresh');

    service.logoutAllDevices();
    httpMock.expectOne(`${environment.apiUrl}/auth/logout-all`).flush({});

    expect(service.getAccessToken()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/auth']);
  });

  test('refreshAccessToken() errors immediately (no HTTP call) when no refresh token is stored', (done) => {
    service.refreshAccessToken().subscribe({
      error: (err) => {
        expect(err.message).toBe('No refresh token');
        done();
      },
    });
    httpMock.expectNone(`${environment.apiUrl}/auth/refresh`);
  });

  test('refreshAccessToken() stores new tokens on success', () => {
    localStorage.setItem('aa_rt', 'old-refresh-token');
    service.refreshAccessToken().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'old-refresh-token' });
    req.flush({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } });

    expect(localStorage.getItem('aa_at')).toBe('new-access');
    expect(localStorage.getItem('aa_rt')).toBe('new-refresh');
  });

  test('regression: concurrent refreshAccessToken() calls share ONE HTTP request, not one each (backend rotates the refresh token, so N separate calls would spuriously fail/logout)', () => {
    localStorage.setItem('aa_rt', 'shared-old-token');

    let resultA: any, resultB: any, resultC: any;
    service.refreshAccessToken().subscribe(r => resultA = r);
    service.refreshAccessToken().subscribe(r => resultB = r);
    service.refreshAccessToken().subscribe(r => resultC = r);

    // Only ONE request should have gone out despite 3 concurrent callers
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    req.flush({ data: { accessToken: 'shared-new-access', refreshToken: 'shared-new-refresh' } });

    expect(resultA.data.accessToken).toBe('shared-new-access');
    expect(resultB.data.accessToken).toBe('shared-new-access');
    expect(resultC.data.accessToken).toBe('shared-new-access');
  });

  test('regression: a LATER refresh call (after the in-flight one settles) fires a genuinely new request', () => {
    localStorage.setItem('aa_rt', 'token-1');
    service.refreshAccessToken().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ data: { accessToken: 'a1', refreshToken: 'token-2' } });

    // A second, later refresh (e.g. the NEXT time the token expires) must
    // fire its own new request — the shared cache should have cleared.
    service.refreshAccessToken().subscribe();
    const secondReq = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(secondReq.request.body).toEqual({ refreshToken: 'token-2' });
    secondReq.flush({ data: { accessToken: 'a2', refreshToken: 'token-3' } });
  });

  test('init() resolves without a session-ready flip requiring a network call when no token exists', async () => {
    await service.init();
    expect(service.sessionReady()).toBe(true);
    httpMock.expectNone(`${environment.apiUrl}/auth/me`);
  });

  test('init() clears session if the stored token is rejected by /me', async () => {
    localStorage.setItem('aa_at', 'stale-token');
    const initPromise = service.init();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    await initPromise;
    expect(service.sessionReady()).toBe(true);
    expect(service.getAccessToken()).toBeNull();
  });

  describe('patchUser (regression: onboarding-guard bounce-back bug)', () => {
    test('merges a partial update into the existing cached user without a network call', () => {
      service.login('user@example.com', 'password123').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
        data: { accessToken: 'a', refreshToken: 'r', user: { _id: '1', name: 'Jane', email: 'jane@x.com', plan: 'free', onboardingComplete: false } },
      });

      service.patchUser({ onboardingComplete: true });

      expect(service.currentUser()?.onboardingComplete).toBe(true);
      expect(service.currentUser()?.name).toBe('Jane'); // untouched fields preserved
      httpMock.verify(); // confirms no extra HTTP request was made by patchUser itself
    });

    test('is a safe no-op when there is no cached user yet', () => {
      expect(() => service.patchUser({ onboardingComplete: true })).not.toThrow();
      expect(service.currentUser()).toBeNull();
    });
  });
});
