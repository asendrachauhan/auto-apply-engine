import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  router.navigate(['/auth']);
  return false;
};

export const publicGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return true;
  router.navigate(['/dashboard']);
  return false;
};

export const onboardingGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const user   = auth.currentUser();
  if (!user) return true;
  if (!user.onboardingComplete && route.routeConfig?.path !== 'onboarding') {
    router.navigate(['/onboarding']);
    return false;
  }
  return true;
};
