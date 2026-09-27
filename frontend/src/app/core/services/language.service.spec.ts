import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LanguageService } from './language.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from './toast.service';

describe('LanguageService — setLang (regression: previously silently did nothing on failure)', () => {
  let service: LanguageService;
  let translateStub: { use: jest.Mock; setDefaultLang: jest.Mock };
  let toastStub: { error: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    translateStub = { use: jest.fn(), setDefaultLang: jest.fn() };
    toastStub = { error: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: translateStub },
        { provide: ToastService, useValue: toastStub },
      ],
    });
    service = TestBed.inject(LanguageService);
  });

  test('successfully applies the new language and persists it', () => {
    translateStub.use.mockReturnValue(of({}));
    service.setLang('fr');
    expect(service.currentLang()).toBe('fr');
    expect(localStorage.getItem('aa_lang')).toBe('fr');
    expect(toastStub.error).not.toHaveBeenCalled();
  });

  test('regression: shows an error toast and does NOT silently no-op when the language fails to load', () => {
    translateStub.use.mockReturnValue(throwError(() => new Error('404 loading fr.json')));
    service.setLang('fr');
    expect(toastStub.error).toHaveBeenCalledWith(expect.stringContaining('Could not switch language'));
    // Current language must NOT have changed to the failed one
    expect(service.currentLang()).not.toBe('fr');
  });

  test('init() still falls back to English on failure and resolves (pre-existing correct behavior, unaffected)', async () => {
    translateStub.use.mockReturnValue(throwError(() => new Error('network error')));
    await service.init();
    expect(service.currentLang()).toBe('en');
  });
});
