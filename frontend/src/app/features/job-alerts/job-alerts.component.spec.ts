import { render, screen, fireEvent } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { of } from 'rxjs';
import { JobAlertsComponent } from './job-alerts.component';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslateModule } from '@ngx-translate/core';

describe('JobAlertsComponent', () => {
  const mockAlerts = [
    {
      _id: 'alert-1',
      title: 'Senior Frontend Engineer',
      company: 'Vercel',
      location: 'Remote',
      matchScore: 92,
      status: 'notified',
      source: 'remotive',
      salary: '$120k - $140k',
      ghostScore: 90,
      matchReasons: ['Expert Angular/TypeScript skills'],
      prefillFields: [{ fieldName: 'Full Name', value: 'Jane Doe' }],
      coverLetter: 'Dear Hiring Team...',
      prefillCard: 'Name: Jane Doe\nRole: Frontend',
    },
    {
      _id: 'alert-2',
      title: 'Full Stack Developer',
      company: 'Linear',
      location: 'Remote',
      matchScore: 85,
      status: 'applied',
      source: 'himalayas',
      salary: '$110k - $130k',
      ghostScore: 88,
      matchReasons: ['Proficiency with modern web apps'],
      prefillFields: [{ fieldName: 'Full Name', value: 'Jane Doe' }],
      coverLetter: 'Dear Linear Team...',
      prefillCard: 'Name: Jane Doe\nRole: Full Stack',
    },
  ];

  let mockApi: any;
  let mockToast: any;

  beforeEach(() => {
    mockApi = {
      getAlerts: jest.fn().mockReturnValue(of({ data: mockAlerts })),
      getAlertStats: jest.fn().mockReturnValue(of({ data: { total: 2, notified: 1, applied: 1, avgMatchScore: 88 } })),
      getAlert: jest.fn().mockImplementation(id => of({ data: mockAlerts.find(a => a._id === id) || mockAlerts[0] })),
      runAlertPipeline: jest.fn().mockReturnValue(of({ success: true })),
    };
    mockToast = {
      success: jest.fn(),
      error: jest.fn(),
    };
  });

  const setup = async (apiOverrides = {}) => {
    return render(JobAlertsComponent, {
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: { ...mockApi, ...apiOverrides } },
        { provide: ToastService, useValue: mockToast },
      ],
    });
  };

  test('renders stats and alerts list', async () => {
    await setup();
    expect(await screen.findByText('Senior Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Vercel')).toBeInTheDocument();
    expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  test('displays how-it-works zero state when no alerts exist', async () => {
    await setup({
      getAlerts: jest.fn().mockReturnValue(of({ data: [] })),
    });
    expect(await screen.findByText(/how it works|ALERTS.HOW_IT_WORKS/i)).toBeInTheDocument();
    expect(screen.getByText(/find matches|ALERTS.FIND_MATCHES/i)).toBeInTheDocument();
  });

  test('filters alerts by status', async () => {
    await setup();
    expect(await screen.findByText('Senior Frontend Engineer')).toBeInTheDocument();

    const appliedFilterBtn = screen.getByRole('button', { name: /applied|ALERTS.FILTER_APPLIED/i });
    fireEvent.click(appliedFilterBtn);

    expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();
    expect(screen.queryByText('Senior Frontend Engineer')).not.toBeInTheDocument();
  });

  test('triggers discovery pipeline on button click', async () => {
    await setup();
    const runBtn = await screen.findByRole('button', { name: /find new jobs|ALERTS.FIND_NEW_JOBS/i });
    fireEvent.click(runBtn);

    expect(mockApi.runAlertPipeline).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Job discovery started'));
  });

  test('opens alert detail slide-out panel on card click', async () => {
    await setup();
    const alertCard = await screen.findByText('Senior Frontend Engineer');
    fireEvent.click(alertCard);

    expect(mockApi.getAlert).toHaveBeenCalledWith('alert-1');
    expect(await screen.findByText(/application packet|ALERTS.TAB_PACKET/i)).toBeInTheDocument();
  });

  test('filters alerts by source platform and resets filters', async () => {
    await setup();
    expect(await screen.findByText('Senior Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();

    const platformSelect = screen.getByLabelText(/filter by source platform/i);
    fireEvent.change(platformSelect, { target: { value: 'himalayas' } });

    expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();
    expect(screen.queryByText('Senior Frontend Engineer')).not.toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText('Senior Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();
  });
});

