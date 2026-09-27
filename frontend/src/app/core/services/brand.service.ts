import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private api = inject(ApiService);
  
  readonly customLogoUrl = signal<string | null>(null);
  readonly isLoaded = signal<boolean>(false);

  constructor() {
    this.loadBrandConfig();
  }

  loadBrandConfig(): void {
    if (typeof this.api?.getPublicBrandConfig !== 'function') {
      this.isLoaded.set(true);
      return;
    }
    this.api.getPublicBrandConfig().subscribe({
      next: (res: any) => {
        if (res?.data?.customLogoUrl) {
          this.customLogoUrl.set(res.data.customLogoUrl);
        } else {
          this.customLogoUrl.set(null);
        }
        this.isLoaded.set(true);
      },
      error: () => {
        this.customLogoUrl.set(null);
        this.isLoaded.set(true);
      }
    });
  }

  setCustomLogo(url: string | null): void {
    this.customLogoUrl.set(url);
  }
}
