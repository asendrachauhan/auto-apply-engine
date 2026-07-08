import { Routes } from '@angular/router';
import { authGuard, publicGuard, onboardingGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'auth', canActivate: [publicGuard],
    loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login',    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent), title: 'Sign In — AutoApply AI' },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent), title: 'Create Account — AutoApply AI' },
      { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent), title: 'Reset Password — AutoApply AI' },
    ]
  },
  { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent), title: 'Reset Password — AutoApply AI' },
  { path: 'verify-email',   loadComponent: () => import('./features/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent), title: 'Verify Email — AutoApply AI' },
  { path: 'onboarding', canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent) },
  { path: '', canActivate: [authGuard, onboardingGuard],
    loadComponent: () => import('./app-shell.component').then(m => m.AppShellComponent),
    children: [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard',   loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),   title: 'Dashboard — AutoApply AI' },
    { path: 'resume',      loadComponent: () => import('./features/resume/resume.component').then(m => m.ResumeComponent),             title: 'Resume — AutoApply AI' },
    { path: 'alerts',      loadComponent: () => import('./features/job-alerts/job-alerts.component').then(m => m.JobAlertsComponent),  title: 'Job Alerts — AutoApply AI' },
    { path: 'jobs',        loadComponent: () => import('./features/jobs/jobs.component').then(m => m.JobsComponent),                   title: 'Applications — AutoApply AI' },
    { path: 'automation',  loadComponent: () => import('./features/automation/automation.component').then(m => m.AutomationComponent), title: 'Automation — AutoApply AI' },
    { path: 'eu',          loadComponent: () => import('./features/eu/eu-careers.component').then(m => m.EuCareersComponent),          title: 'EU Careers — AutoApply AI' },
    { path: 'analytics',   loadComponent: () => import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),   title: 'Analytics — AutoApply AI' },
    { path: 'preferences', loadComponent: () => import('./features/preferences/preferences.component').then(m => m.PreferencesComponent), title: 'Preferences — AutoApply AI' },
    { path: 'plans',       loadComponent: () => import('./features/plans/plans.component').then(m => m.PlansComponent),               title: 'Plans — AutoApply AI' },
    { path: 'settings',    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),       title: 'Settings — AutoApply AI' },
    { path: 'profile',     loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),         title: 'Profile — AutoApply AI' },
  ]},
  { path: '**', loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent) },
];
