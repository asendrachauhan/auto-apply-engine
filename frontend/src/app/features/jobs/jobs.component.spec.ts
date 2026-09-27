import { render, screen, fireEvent } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { of } from 'rxjs';
import { JobsComponent } from './jobs.component';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslateModule } from '@ngx-translate/core';

describe('JobsComponent', () => {
  const mockApps = [
    {
      _id: 'app-1',
      jobTitle: 'Senior Frontend Developer',
      company: 'Acme Corp',
      matchScore: 92,
      status: 'applied',
      source: 'remoteok',
      appliedAt: new Date().toISOString(),
      jobUrl: 'https://example.com/job/1',
      ghostScore: { verdict: 'REAL', score: 95 },
    },
    {
      _id: 'app-2',
      jobTitle: 'Backend Engineer',
      company: 'Beta Labs',
      matchScore: 84,
      status: 'interview',
      source: 'himalayas',
      appliedAt: new Date().toISOString(),
      jobUrl: 'https://example.com/job/2',
      ghostScore: { verdict: 'REAL', score: 88 },
    },
  ];

  let mockApi: any;
  let mockToast: any;

  beforeEach(() => {
    mockApi = {
      getApplications: jest.fn().mockReturnValue(of({ data: mockApps, meta: { total: 2, pages: 1, page: 1, limit: 20 } })),
      updateJobStatus: jest.fn().mockReturnValue(of({ data: { ...mockApps[0], status: 'interview' } })),
    };
    mockToast = {
      success: jest.fn(),
      error: jest.fn(),
    };
  });

  const setup = async (apiOverrides = {}) => {
    return render(JobsComponent, {
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: { ...mockApi, ...apiOverrides } },
        { provide: ToastService, useValue: mockToast },
      ],
    });
  };

  test('renders applications list when data is returned', async () => {
    await setup();
    expect(await screen.findByText('Senior Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Beta Labs')).toBeInTheDocument();
  });

  test('displays empty state when no applications exist', async () => {
    await setup({
      getApplications: jest.fn().mockReturnValue(of({ data: [], meta: { total: 0, pages: 1, page: 1, limit: 20 } })),
    });
    expect(await screen.findByText(/no.*found|JOBS.NO_FOUND/i)).toBeInTheDocument();
  });

  test('filters visible jobs client-side when search query is typed', async () => {
    await setup();
    expect(await screen.findByText('Senior Frontend Developer')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search|JOBS.SEARCH_PLACEHOLDER/i);
    fireEvent.input(searchInput, { target: { value: 'Beta Labs' } });

    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Senior Frontend Developer')).not.toBeInTheDocument();
  });

  test('switches filter tab and queries backend with status filter', async () => {
    await setup();
    expect(await screen.findByText('Senior Frontend Developer')).toBeInTheDocument();

    const interviewBtn = screen.getByRole('button', { name: /interview|JOBS.INTERVIEW/i });
    fireEvent.click(interviewBtn);

    expect(mockApi.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'interview', page: 1 })
    );
  });

  test('opens and closes application detail overlay', async () => {
    await setup();
    const card = await screen.findByText('Senior Frontend Developer');
    fireEvent.click(card);

    // Detail panel displays big score
    expect(screen.getByText('92')).toBeInTheDocument();

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Full Packet')).not.toBeInTheDocument();
  });

  test('filters applications by platform and resets filters', async () => {
    await setup();
    expect(await screen.findByText('Senior Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();

    const platformSelect = screen.getByLabelText(/filter applications by platform/i);
    fireEvent.change(platformSelect, { target: { value: 'himalayas' } });

    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Senior Frontend Developer')).not.toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText('Senior Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
  });
});

