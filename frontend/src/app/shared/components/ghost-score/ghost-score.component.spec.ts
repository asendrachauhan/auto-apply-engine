import { render, screen, fireEvent } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { GhostScoreComponent } from './ghost-score.component';

describe('GhostScoreComponent', () => {
  test('renders nothing when ghostScore is null/undefined', async () => {
    const { container } = await render(GhostScoreComponent, {
      componentInputs: { ghostScore: null },
    });
    expect(container.querySelector('.ghost-badge')).toBeNull();
  });

  test('shows "Real Job" badge for score >= 70', async () => {
    await render(GhostScoreComponent, { componentInputs: { ghostScore: 85 } });
    expect(screen.getByText('Real Job')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  test('shows "Uncertain" badge for score in the 40-69 band', async () => {
    await render(GhostScoreComponent, { componentInputs: { ghostScore: 55 } });
    expect(screen.getByText('Uncertain')).toBeInTheDocument();
  });

  test('shows "Likely Ghost" badge for score below 40', async () => {
    await render(GhostScoreComponent, { componentInputs: { ghostScore: 15 } });
    expect(screen.getByText('Likely Ghost')).toBeInTheDocument();
  });

  test('regression: badge is a real <button> with aria-expanded (previously a non-focusable, non-keyboard-operable div)', async () => {
    const { container } = await render(GhostScoreComponent, { componentInputs: { ghostScore: 85 } });
    const badge = container.querySelector('button.ghost-badge');
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(badge!);
    expect(badge).toHaveAttribute('aria-expanded', 'true');
  });

  test('expands to show the explanation on click, and collapses on second click', async () => {
    await render(GhostScoreComponent, { componentInputs: { ghostScore: 85 } });
    expect(screen.queryByText(/high confidence this role/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Real Job'));
    expect(await screen.findByText(/high confidence this role/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Real Job'));
    expect(screen.queryByText(/high confidence this role/i)).not.toBeInTheDocument();
  });

  test('boundary: score of exactly 70 is REAL, 69 is UNCERTAIN, 40 is UNCERTAIN, 39 is GHOST', async () => {
    const { rerender } = await render(GhostScoreComponent, { componentInputs: { ghostScore: 70 } });
    expect(screen.getByText('Real Job')).toBeInTheDocument();

    await rerender({ componentInputs: { ghostScore: 69 } });
    expect(screen.getByText('Uncertain')).toBeInTheDocument();

    await rerender({ componentInputs: { ghostScore: 40 } });
    expect(screen.getByText('Uncertain')).toBeInTheDocument();

    await rerender({ componentInputs: { ghostScore: 39 } });
    expect(screen.getByText('Likely Ghost')).toBeInTheDocument();
  });
});
