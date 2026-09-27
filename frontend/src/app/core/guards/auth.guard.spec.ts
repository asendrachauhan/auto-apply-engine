import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { authGuard, publicGuard, onboardingGuard, adminGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

const runGuard = (guard: any, route: Partial<ActivatedRouteSnapshot> = {}) =>
  TestBed.runInInjectionContext(() => guard(route as ActivatedRouteSnapshot, {} as any));

describe('Route guards', () => {
  let authStub: { isLoggedIn: jest.Mock; currentUser: jest.Mock };
  let routerStub: { navigate: jest.Mock };

  beforeEach(() => {
    authStub = { isLoggedIn: jest.fn(), currentUser: jest.fn() };
    routerStub = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    });
  });

  describe('authGuard', () => {
    test('allows access when logged in', () => {
      authStub.isLoggedIn.mockReturnValue(true);
      expect(runGuard(authGuard)).toBe(true);
      expect(routerStub.navigate).not.toHaveBeenCalled();
    });

    test('redirects to /auth and denies access when logged out', () => {
      authStub.isLoggedIn.mockReturnValue(false);
      expect(runGuard(authGuard)).toBe(false);
      expect(routerStub.navigate).toHaveBeenCalledWith(['/auth']);
    });
  });

  describe('publicGuard', () => {
    test('allows access to auth pages when logged out', () => {
      authStub.isLoggedIn.mockReturnValue(false);
      expect(runGuard(publicGuard)).toBe(true);
    });

    test('redirects an already-logged-in user away from auth pages to /dashboard', () => {
      authStub.isLoggedIn.mockReturnValue(true);
      expect(runGuard(publicGuard)).toBe(false);
      expect(routerStub.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('onboardingGuard', () => {
    test('allows access when there is no user yet (defers to authGuard elsewhere)', () => {
      authStub.currentUser.mockReturnValue(null);
      expect(runGuard(onboardingGuard, { routeConfig: { path: 'dashboard' } } as any)).toBe(true);
    });

    test('redirects to /onboarding when onboarding is incomplete, for any non-onboarding route', () => {
      authStub.currentUser.mockReturnValue({ onboardingComplete: false });
      expect(runGuard(onboardingGuard, { routeConfig: { path: 'dashboard' } } as any)).toBe(false);
      expect(routerStub.navigate).toHaveBeenCalledWith(['/onboarding']);
    });

    test('does not redirect-loop when already navigating to the onboarding route itself', () => {
      authStub.currentUser.mockReturnValue({ onboardingComplete: false });
      expect(runGuard(onboardingGuard, { routeConfig: { path: 'onboarding' } } as any)).toBe(true);
      expect(routerStub.navigate).not.toHaveBeenCalled();
    });

    test('allows access everywhere once onboarding is complete', () => {
      authStub.currentUser.mockReturnValue({ onboardingComplete: true });
      expect(runGuard(onboardingGuard, { routeConfig: { path: 'dashboard' } } as any)).toBe(true);
    });
  });

  describe('adminGuard', () => {
    test('allows access for a user with role "admin"', () => {
      authStub.currentUser.mockReturnValue({ role: 'admin' });
      expect(runGuard(adminGuard)).toBe(true);
    });

    test('denies and redirects to /dashboard for a regular user', () => {
      authStub.currentUser.mockReturnValue({ role: 'user' });
      expect(runGuard(adminGuard)).toBe(false);
      expect(routerStub.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    test('denies access safely when there is no user at all (logged out hitting /admin directly)', () => {
      authStub.currentUser.mockReturnValue(null);
      expect(runGuard(adminGuard)).toBe(false);
    });
  });
});
