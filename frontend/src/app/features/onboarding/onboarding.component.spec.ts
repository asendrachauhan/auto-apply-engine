import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OnboardingComponent } from './onboarding.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';

describe('OnboardingComponent — Email Verification Gate', () => {
  let component: OnboardingComponent;
  let authMock: any;
  let apiMock: any;
  let toastMock: any;
  let routerMock: any;
  let userSignal: any;

  beforeEach(() => {
    userSignal = signal<any>({
      _id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: false,
      onboardingComplete: false,
    });

    authMock = {
      currentUser: userSignal,
      fetchMe: jest.fn().mockReturnValue(of({ data: userSignal() })),
      resendVerification: jest.fn().mockReturnValue(of({ data: true })),
      patchUser: jest.fn().mockImplementation((patch: any) => {
        userSignal.set({ ...userSignal(), ...patch });
      }),
    };

    apiMock = {
      uploadResume: jest.fn().mockReturnValue(of({ data: { parsed: {} } })),
      updatePreferences: jest.fn().mockReturnValue(of({ data: {} })),
      startAutomation: jest.fn().mockReturnValue(of({ data: {} })),
    };

    toastMock = {
      success: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    routerMock = {
      navigate: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [OnboardingComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: ApiService, useValue: apiMock },
        { provide: ToastService, useValue: toastMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    const fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
  });

  test('when user is unverified, steps list includes verify step and starts at welcome', () => {
    expect(component.isEmailVerified()).toBe(false);
    expect(component.steps()).toContain('verify');
    expect(component.currentStep()).toBe('welcome');
  });

  test('clicking next on welcome moves an unverified user to verify step (not resume)', () => {
    component.next();
    expect(component.currentStep()).toBe('verify');
  });

  test('on verify step, calling next() while unverified checks verification and does not advance to resume', () => {
    component.currentStep.set('verify');
    component.next();

    expect(authMock.fetchMe).toHaveBeenCalled();
    expect(component.currentStep()).toBe('verify');
    expect(toastMock.info).toHaveBeenCalled();
  });

  test('when email is verified, checkVerification advances currentStep to resume', () => {
    component.currentStep.set('verify');

    // Simulate backend returning verified user
    authMock.fetchMe.mockImplementation(() => {
      userSignal.set({ ...userSignal(), emailVerified: true });
      return of({ data: userSignal() });
    });

    component.checkVerification(true);

    expect(component.isEmailVerified()).toBe(true);
    expect(component.currentStep()).toBe('resume');
    expect(toastMock.success).toHaveBeenCalled();
  });

  test('uploadResume is blocked and redirects to verify step if user is not verified', () => {
    component.currentStep.set('resume');
    userSignal.set({ ...userSignal(), emailVerified: false });

    const fakeFile = new File(['dummy content'], 'resume.pdf', { type: 'application/pdf' });
    const event = { target: { files: [fakeFile] } } as any;

    component.onFile(event);

    expect(apiMock.uploadResume).not.toHaveBeenCalled();
    expect(component.currentStep()).toBe('verify');
    expect(toastMock.error).toHaveBeenCalled();
  });

  test('when user is already verified from the start, verify step is excluded and next jumps to resume', () => {
    userSignal.set({ ...userSignal(), emailVerified: true });

    expect(component.isEmailVerified()).toBe(true);
    expect(component.steps()).not.toContain('verify');

    component.next();
    expect(component.currentStep()).toBe('resume');

    component.back();
    expect(component.currentStep()).toBe('welcome');
  });

  test('resendVerification calls auth.resendVerification and starts cooldown', () => {
    component.resendVerification();

    expect(authMock.resendVerification).toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalled();
    expect(component.resendCooldown()).toBe(60);
  });
});
