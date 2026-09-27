import { render, screen, fireEvent } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { of } from 'rxjs';
import { ResumeComponent } from './resume.component';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslateModule } from '@ngx-translate/core';

const apiStub = {
  getMyResume: () => of({ data: null }), // no existing resume — shows the upload view
};
const toastStub = { success: jest.fn(), error: jest.fn() };

const renderResume = () =>
  render(ResumeComponent, {
    imports: [TranslateModule.forRoot()],
    providers: [{ provide: ApiService, useValue: apiStub }, { provide: ToastService, useValue: toastStub }],
  });

describe('ResumeComponent — upload zone (regression: was a non-keyboard-operable div)', () => {
  test('the drop zone is a focusable element with role="button" and an accessible name', async () => {
    const { container } = await renderResume();
    const zone = container.querySelector('.upload-zone');
    expect(zone).toHaveAttribute('role', 'button');
    expect(zone).toHaveAttribute('tabindex', '0');
    expect(zone?.hasAttribute('aria-label')).toBe(true);
  });

  test('pressing Enter on the focused drop zone triggers the hidden file input', async () => {
    const { container } = await renderResume();
    const zone = container.querySelector('.upload-zone') as HTMLElement;
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

    fireEvent.keyDown(zone, { key: 'Enter', code: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });

  test('pressing Space on the focused drop zone triggers the file input without scrolling the page', async () => {
    const { container } = await renderResume();
    const zone = container.querySelector('.upload-zone') as HTMLElement;
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

    const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    zone.dispatchEvent(event);

    expect(clickSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
