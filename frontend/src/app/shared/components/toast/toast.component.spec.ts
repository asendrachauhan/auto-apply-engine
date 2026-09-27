import { render, screen, fireEvent } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { signal } from '@angular/core';
import { ToastComponent } from './toast.component';
import { ToastService } from '../../../core/services/toast.service';

describe('ToastComponent — regression: close button previously did nothing', () => {
  test('clicking the close button calls toast.remove() with the correct id', async () => {
    const toasts = signal([{ id: 't1', type: 'success', message: 'Saved!' }]);
    const remove = jest.fn();

    await render(ToastComponent, {
      providers: [{ provide: ToastService, useValue: { toasts, remove } }],
    });

    const closeBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(closeBtn);
    expect(remove).toHaveBeenCalledWith('t1');
  });

  test('the toast body itself is no longer a click target (deliberate dismiss only, via the button)', async () => {
    const toasts = signal([{ id: 't1', type: 'info', message: 'Heads up' }]);
    const remove = jest.fn();

    const { container } = await render(ToastComponent, {
      providers: [{ provide: ToastService, useValue: { toasts, remove } }],
    });

    const toastBody = container.querySelector('.toast');
    fireEvent.click(toastBody!);
    expect(remove).not.toHaveBeenCalled();
  });

  test('toast has role="status" for screen-reader announcement without requiring interaction', async () => {
    const toasts = signal([{ id: 't1', type: 'error', message: 'Something failed' }]);
    await render(ToastComponent, {
      providers: [{ provide: ToastService, useValue: { toasts, remove: jest.fn() } }],
    });
    expect(screen.getByRole('status')).toHaveTextContent('Something failed');
  });
});
