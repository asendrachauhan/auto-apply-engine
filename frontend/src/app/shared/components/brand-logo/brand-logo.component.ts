import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { BrandService } from '../../../core/services/brand.service';

export type BrandLogoVariant =
  | 'horizontal'
  | 'vertical'
  | 'mark'
  | 'icon'
  | 'favicon'
  | 'monochrome'
  | 'social'
  | 'signature'
  | 'tab'
  | 'splash'
  | 'wordmark';

@Component({
  selector: 'aa-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img
      [src]="logoSrc()"
      [alt]="alt"
      [style.height]="cssHeight()"
      [style.width]="cssWidth()"
      [style.max-width]="'100%'"
      class="brand-logo-img"
      loading="eager"
    />
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .brand-logo-img {
      object-fit: contain;
      display: block;
      transition: opacity 0.2s ease;
    }
  `],
})
export class BrandLogoComponent {
  private themeService = inject(ThemeService);
  private brandService = inject(BrandService);

  @Input() variant: BrandLogoVariant = 'horizontal';
  @Input() height?: number | string;
  @Input() width?: number | string;
  @Input() alt = 'AutoApply AI';
  @Input() transparent = false;
  @Input() forceTheme?: 'dark' | 'light';

  readonly isDark = computed(() => {
    if (this.forceTheme) return this.forceTheme === 'dark';
    return this.themeService.theme() === 'dark';
  });

  readonly logoSrc = computed(() => {
    const dark = this.isDark();
    const custom = this.brandService.customLogoUrl();

    // If a custom logo was uploaded by admin and variant is primary or mark, prefer custom logo
    if (custom && (this.variant === 'horizontal' || this.variant === 'mark')) {
      return custom;
    }

    switch (this.variant) {
      case 'horizontal':
        if (this.transparent) {
          return dark
            ? 'assets/logos/03-full-logo-horizontal-transparent.svg'
            : 'assets/logos/02-full-logo-horizontal-light.svg';
        }
        return dark
          ? 'assets/logos/01-full-logo-horizontal-dark.svg'
          : 'assets/logos/02-full-logo-horizontal-light.svg';

      case 'vertical':
        return dark
          ? 'assets/logos/04-logo-vertical-dark.svg'
          : 'assets/logos/05-logo-vertical-light.svg';

      case 'mark':
        return dark
          ? 'assets/logos/06-logo-mark-only.svg'
          : 'assets/logos/15-logo-mark-light-background.svg';

      case 'icon':
        return 'assets/logos/07-app-icon-512.svg';

      case 'favicon':
        return 'assets/logos/08-favicon-32.svg';

      case 'monochrome':
        return dark
          ? 'assets/logos/09-monochrome-white.svg'
          : 'assets/logos/10-monochrome-black.svg';

      case 'social':
        return 'assets/logos/11-social-media-square.svg';

      case 'signature':
        return 'assets/logos/12-email-signature.svg';

      case 'tab':
        return 'assets/logos/13-browser-tab.svg';

      case 'splash':
        return 'assets/logos/14-splash-screen.svg';

      case 'wordmark':
        return dark
          ? 'assets/logos/16-wordmark-only-dark.svg'
          : 'assets/logos/17-wordmark-only-light.svg';

      default:
        return 'assets/logos/01-full-logo-horizontal-dark.svg';
    }
  });

  cssHeight(): string | undefined {
    if (this.height === undefined || this.height === null) {
      switch (this.variant) {
        case 'favicon': return '24px';
        case 'tab': return '28px';
        case 'mark': return '34px';
        case 'icon': return '48px';
        case 'horizontal': return '38px';
        case 'vertical': return '68px';
        case 'signature': return '36px';
        case 'wordmark': return '28px';
        case 'splash': return '120px';
        default: return '36px';
      }
    }
    return typeof this.height === 'number' ? `${this.height}px` : this.height;
  }

  cssWidth(): string | undefined {
    if (this.width === undefined || this.width === null) return undefined;
    return typeof this.width === 'number' ? `${this.width}px` : this.width;
  }
}
