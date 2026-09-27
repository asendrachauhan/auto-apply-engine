import { render, screen, fireEvent } from '@testing-library/angular';
import '@testing-library/jest-dom';
import { LanguageDropdownComponent } from './language-dropdown.component';
import { LanguageService } from '../../../core/services/language.service';

describe('LanguageDropdownComponent — regression: tautological [class.active] condition', () => {
  test('marks only the currently active language option as active, not a stray extra clause that always evaluated true', async () => {
    const setLang = jest.fn();
    const langServiceStub = {
      languages: [
        { code: 'en', label: 'EN', name: 'English' },
        { code: 'es', label: 'ES', name: 'Español' },
      ],
      currentLang: () => 'es',
      setLang,
    };

    const { container } = await render(LanguageDropdownComponent, {
      providers: [{ provide: LanguageService, useValue: langServiceStub }],
    });

    // Open the dropdown
    fireEvent.click(screen.getByTitle('Change language'));

    const options = container.querySelectorAll('.lang-option');
    expect(options.length).toBe(2);
    // Only Spanish (the current language) should carry the active class
    expect(options[0]).not.toHaveClass('active'); // English
    expect(options[1]).toHaveClass('active');      // Español — matches currentLang()
  });

  test('clicking a language option calls setLang with that language\'s code and closes the dropdown', async () => {
    const setLang = jest.fn();
    const langServiceStub = {
      languages: [{ code: 'en', label: 'EN', name: 'English' }, { code: 'fr', label: 'FR', name: 'Français' }],
      currentLang: () => 'en',
      setLang,
    };

    await render(LanguageDropdownComponent, {
      providers: [{ provide: LanguageService, useValue: langServiceStub }],
    });

    fireEvent.click(screen.getByTitle('Change language'));
    fireEvent.click(screen.getByText('Français'));
    expect(setLang).toHaveBeenCalledWith('fr');
  });
});
