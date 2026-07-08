import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

/**
 * Settings — account-level actions only. Job-search preferences and
 * notification toggles live on the dedicated Preferences page; profile
 * editing and password/account deletion live on the Profile page. This page
 * covers GDPR data export and quick links to those two.
 */
@Component({
  selector: 'aa-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Data, privacy, and quick links to your other account settings.</p>
      </div>

      <div class="grid-2">
        <a class="settings-link-card neo" [routerLink]="['/preferences']">
          <aa-icon name="target" [size]="22" class="link-icon"/>
          <div>
            <div class="link-title">Job Preferences</div>
            <div class="link-sub text-muted text-sm">Search criteria, EU mode, automation thresholds, notifications</div>
          </div>
          <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
        </a>
        <a class="settings-link-card neo" [routerLink]="['/profile']">
          <aa-icon name="users" [size]="22" class="link-icon"/>
          <div>
            <div class="link-title">Profile &amp; Security</div>
            <div class="link-sub text-muted text-sm">Name, links, password, account deletion</div>
          </div>
          <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
        </a>
      </div>

      <!-- GDPR Data Export -->
      <div class="section-card">
        <div class="section-title"><aa-icon name="shield" [size]="16"/> Your Data (GDPR)</div>
        <p class="text-muted text-sm mb-16">
          Download a copy of your account data — profile, preferences, and application history — as a JSON file.
        </p>
        <aa-button variant="secondary" [loading]="exporting()" (clicked)="exportData()" icon="download">
          Export My Data
        </aa-button>
      </div>
    </div>
  `,
  styles: [`
    .settings-link-card {
      display: flex; align-items: center; gap: 14px; padding: 20px;
      text-decoration: none; cursor: pointer; transition: all .22s;
    }
    .settings-link-card:hover { transform: translateY(-2px); box-shadow: var(--neo-float); }
    .link-icon    { color: var(--accent); flex-shrink: 0; }
    .link-title   { font-size: 14px; font-weight: 700; color: var(--text); }
    .link-sub     { margin-top: 2px; }
    .link-chevron { margin-left: auto; color: var(--text-light); flex-shrink: 0; }
    .mb-16 { margin-bottom: 16px; }
  `]
})
export class SettingsComponent {
  exporting = signal(false);

  constructor(private api: ApiService, private toast: ToastService) {}

  exportData(): void {
    this.exporting.set(true);
    this.api.exportData().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'autoapply-data-export.json';
        a.click();
        window.URL.revokeObjectURL(url);
        this.exporting.set(false);
        this.toast.success('Data export downloaded');
      },
      error: () => { this.toast.error('Export failed'); this.exporting.set(false); },
    });
  }
}
