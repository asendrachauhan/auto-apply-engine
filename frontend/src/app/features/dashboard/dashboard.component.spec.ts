import { render, screen } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

import { TranslateModule } from '@ngx-translate/core';

const baseApi = {
  getApplications: (): any => of({ data: [] as any[], meta: { total: 0 } }),
  getAutoStatus:   (): any => of({ data: { active: false } }),
  getMyResume:     (): any => of({ data: { atsScore: null as number | null } }),
};

const renderDashboard = (apiOverrides: Partial<typeof baseApi> = {}) =>
  render(DashboardComponent, {
    imports: [TranslateModule.forRoot()],
    providers: [
      { provide: ApiService, useValue: { ...baseApi, ...apiOverrides } },
      { provide: AuthService, useValue: { currentUser: () => ({ name: 'Jane', plan: 'free', dailyApplyLimit: 20 }) } },
      { provide: ToastService, useValue: { error: jest.fn(), success: jest.fn() } },
    ],
  });

describe('DashboardComponent — contextual empty state (regression: was one static message for every cause)', () => {
  test('no resume uploaded → prompts to upload resume', async () => {
    await renderDashboard({ getMyResume: () => of({ data: { atsScore: null } }) });
    expect(await screen.findByText(/upload resume|DASHBOARD.UPLOAD_RESUME/i)).toBeInTheDocument();
  });

  test('resume ready but automation off → prompts to activate automation, NOT to re-upload', async () => {
    await renderDashboard({
      getMyResume:   () => of({ data: { atsScore: 88 } }),
      getAutoStatus: () => of({ data: { active: false } }),
    });
    expect(await screen.findByText(/activate automation|DASHBOARD.ACTIVATE_AUTOMATION/i)).toBeInTheDocument();
    expect(screen.queryByText(/^upload resume$|DASHBOARD.UPLOAD_RESUME/i)).not.toBeInTheDocument();
  });

  test('automation active, zero apps yet → shows "running" state with a Run Now option, not an upload prompt', async () => {
    await renderDashboard({
      getMyResume:   () => of({ data: { atsScore: 88 } }),
      getAutoStatus: () => of({ data: { active: true } }),
    });
    expect(await screen.findByText(/automation.*running.*title|DASHBOARD.AUTOMATION_RUNNING_TITLE/i)).toBeInTheDocument();
    expect(screen.queryByText(/upload resume|DASHBOARD.UPLOAD_RESUME/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activate automation|DASHBOARD.ACTIVATE_AUTOMATION/i)).not.toBeInTheDocument();
  });

  test('applications exist → shows the list, not any empty state', async () => {
    await renderDashboard({
      getApplications: () => of({ data: [{ _id: 'a1', company: 'Acme', jobTitle: 'Engineer', source: 'remotive', matchScore: 85, status: 'applied' }], meta: { total: 1 } }),
    });
    expect(await screen.findByText(/Acme/i)).toBeInTheDocument();
    expect(screen.queryByText(/no applications yet|DASHBOARD.NO_APPS_YET/i)).not.toBeInTheDocument();
  });
});
