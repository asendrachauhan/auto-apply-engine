import { render, screen, fireEvent } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { of, throwError } from 'rxjs';
import { LandingComponent } from './landing.component';
import { ApiService } from '../../core/services/api.service';
import { TranslateModule } from '@ngx-translate/core';

const renderLanding = (apiStub: any) =>
  render(LandingComponent, {
    imports: [TranslateModule.forRoot()],
    providers: [{ provide: ApiService, useValue: apiStub }],
  });

describe('LandingComponent', () => {
  test('renders live plan pricing fetched from the backend', async () => {
    const apiStub = {
      getPlansConfig: () => of({
        data: {
          currencySymbol: '₹',
          plans: [{ id: 'pro', name: 'Pro', price: 699, period: 'month', popular: true, features: ['50 apps/day'], cta: 'Go Pro' }],
        },
      }),
    };
    await renderLanding(apiStub);
    expect(await screen.findByText('₹699')).toBeInTheDocument();
    expect(screen.getByText('Go Pro')).toBeInTheDocument();
  });

  test('regression: falls back to static pricing if the backend is unreachable — a marketing page must never show a broken pricing section', async () => {
    const apiStub = { getPlansConfig: () => throwError(() => new Error('Network error')) };
    await renderLanding(apiStub);
    // Static fallback includes the Free tier
    expect((await screen.findAllByText('Free')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Get Started Free').length).toBeGreaterThan(0);
  });

  test('falls back to static pricing when the backend returns an empty plans array', async () => {
    const apiStub = { getPlansConfig: () => of({ data: { currencySymbol: '₹', plans: [] } }) };
    await renderLanding(apiStub);
    expect(await screen.findByText('₹1499')).toBeInTheDocument(); // Elite from the static fallback
  });

  test('FAQ items expand on click and collapse on second click, one at a time', async () => {
    const apiStub = { getPlansConfig: () => of({ data: { plans: [] } }) };
    await renderLanding(apiStub);

    const firstQuestion = screen.getByText(/Is this legal/i);
    expect(screen.queryByText(/Remotive, Himalayas, Arbeitnow, Adzuna/i)).not.toBeInTheDocument();

    fireEvent.click(firstQuestion);
    expect(await screen.findByText(/Remotive, Himalayas, Arbeitnow, Adzuna/i)).toBeInTheDocument();

    fireEvent.click(firstQuestion);
    expect(screen.queryByText(/Remotive, Himalayas, Arbeitnow, Adzuna/i)).not.toBeInTheDocument();
  });

  test('opening a second FAQ item closes the first (accordion behavior, not multiple open at once)', async () => {
    const apiStub = { getPlansConfig: () => of({ data: { plans: [] } }) };
    await renderLanding(apiStub);

    fireEvent.click(screen.getByText(/Is this legal/i));
    expect(await screen.findByText(/Remotive, Himalayas, Arbeitnow, Adzuna/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Can I cancel anytime/i));
    expect(screen.queryByText(/Remotive, Himalayas, Arbeitnow, Adzuna/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/no lock-in contracts/i)).toBeInTheDocument();
  });
});
