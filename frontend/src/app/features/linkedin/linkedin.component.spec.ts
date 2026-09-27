import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkedInComponent } from './linkedin.component';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

describe('LinkedInComponent', () => {
  let component: LinkedInComponent;
  let fixture: ComponentFixture<LinkedInComponent>;
  let apiService: { post: jest.Mock };
  let toastService: { show: jest.Mock };
  let translateService: { instant: jest.Mock };

  beforeEach(async () => {
    apiService = { post: jest.fn().mockReturnValue(of({ success: true, data: {} })) };
    toastService = { show: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [LinkedInComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkedInComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Profile Input', () => {
    it('should add a new bullet point', () => {
      component.profileInput().experienceBullets = ['Existing bullet'];
      component.addBullet();
      expect(component.profileInput().experienceBullets.length).toBe(2);
      expect(component.profileInput().experienceBullets[1]).toBe('');
    });

    it('should remove a bullet point by index', () => {
      component.profileInput().experienceBullets = ['Bullet 1', 'Bullet 2', 'Bullet 3'];
      component.removeBullet(1);
      expect(component.profileInput().experienceBullets).toEqual(['Bullet 1', 'Bullet 3']);
    });

    it('should add a target role', () => {
      const input = document.createElement('input');
      input.value = 'Senior Engineer';
      component.addRole(input);
      expect(component.profileInput().targetRoles).toContain('Senior Engineer');
      expect(input.value).toBe('');
    });

    it('should not add duplicate target roles', () => {
      component.profileInput().targetRoles = ['Senior Engineer'];
      const input = document.createElement('input');
      input.value = 'Senior Engineer';
      component.addRole(input);
      expect(component.profileInput().targetRoles?.length).toBe(1);
    });

    it('should remove a target role by index', () => {
      component.profileInput().targetRoles = ['Role 1', 'Role 2', 'Role 3'];
      component.removeRole(1);
      expect(component.profileInput().targetRoles).toEqual(['Role 1', 'Role 3']);
    });
  });

  describe('Optimization', () => {
    it('should reject empty profile', async () => {
      component.profileInput().headline = '';
      component.profileInput().about = '';
      component.profileInput().experienceBullets = [''];

      await component.optimize();

      expect(apiService.post).not.toHaveBeenCalled();
      expect(toastService.show).toHaveBeenCalledWith(
        'LINKEDIN.ERROR_EMPTY',
        'error'
      );
    });

    it('should call API with profile data', async () => {
      component.profileInput().headline = 'My Headline';
      component.profileInput().about = 'My About';
      component.profileInput().experienceBullets = ['Bullet 1'];

      const mockResponse = { data: { headline: 'Optimized', linkedInScore: 75, improvements: [], keywordsAdded: [], tips: [], experienceBullets: [] } };
      apiService.post.mockReturnValue(of(mockResponse));

      await component.optimize();

      expect(apiService.post).toHaveBeenCalledWith(
        '/linkedin/optimize',
        expect.objectContaining({
          headline: 'My Headline',
          about: 'My About',
        })
      );
      expect(component.optimized()).toBeTruthy();
    });

    it('should show error on API failure', async () => {
      component.profileInput().headline = 'My Headline';
      apiService.post.mockReturnValue(throwError(() => ({ error: { message: 'API Error' } })));

      await component.optimize();

      expect(toastService.show).toHaveBeenCalledWith('API Error', 'error');
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy text to clipboard', async () => {
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: jest.fn().mockResolvedValue(undefined) },
          configurable: true,
        });
      } else {
        jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      }
      const text = 'Test text to copy';

      await component.copyToClipboard(text);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
      expect(toastService.show).toHaveBeenCalledWith('COMMON.COPIED', 'success');
    });
  });

  describe('Reset', () => {
    it('should clear profile input and optimized results', () => {
      component.profileInput().headline = 'Some headline';
      component.optimized.set({ headline: 'Optimized', linkedInScore: 75, improvements: [], keywordsAdded: [], tips: [], about: '', experienceBullets: [] });

      component.reset();

      expect(component.profileInput().headline).toBe('');
      expect(component.optimized()).toBeNull();
    });
  });
});
