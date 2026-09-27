import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, NeoButtonComponent, IconComponent, TranslateModule],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">{{ 'NAV.SETTINGS' | translate }}</h1>
        <p class="page-subtitle">Manage your account preferences, security, subscriptions, and data privacy.</p>
      </div>

      <!-- Account Summary Card -->
      <div class="account-card neo mb-24">
        <div class="account-left">
          <div class="account-avatar">{{ initials() }}</div>
          <div class="account-info">
            <div class="account-name-row">
              <h2 class="account-name">{{ user()?.name || 'User Account' }}</h2>
              <span class="badge plan-badge" [class.pro]="user()?.plan === 'pro'" [class.elite]="user()?.plan === 'elite'">
                {{ planLabel() }}
              </span>
              @if (user()?.role === 'admin') {
                <span class="badge admin-badge">
                  <aa-icon name="shield" [size]="12"/> Admin
                </span>
              }
            </div>
            <p class="account-email">{{ user()?.email }}</p>
          </div>
        </div>
        <div class="account-actions">
          <a class="btn-profile-link" [routerLink]="['/profile']">
            <aa-icon name="fileEdit" [size]="15"/> Edit Profile
          </a>
        </div>
      </div>

      <!-- Quick Navigation Grid -->
      <div class="section-label">ACCOUNT &amp; PREFERENCES</div>
      <div class="settings-grid mb-24">
        <a class="settings-link-card neo" [routerLink]="['/preferences']">
          <div class="icon-bubble purple">
            <aa-icon name="target" [size]="20"/>
          </div>
          <div class="link-content">
            <div class="link-title">Job Preferences</div>
            <div class="link-sub">Search criteria, EU career modes, thresholds, and filters</div>
          </div>
          <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
        </a>

        <a class="settings-link-card neo" [routerLink]="['/profile']">
          <div class="icon-bubble blue">
            <aa-icon name="users" [size]="20"/>
          </div>
          <div class="link-content">
            <div class="link-title">Profile &amp; Security</div>
            <div class="link-sub">Personal details, password change, and security settings</div>
          </div>
          <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
        </a>

        <a class="settings-link-card neo" [routerLink]="['/plans']">
          <div class="icon-bubble amber">
            <aa-icon name="plans" [size]="20"/>
          </div>
          <div class="link-content">
            <div class="link-title">Plans &amp; Billing</div>
            <div class="link-sub">Manage subscription tier, quotas, and premium features</div>
          </div>
          <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
        </a>

        <a class="settings-link-card neo" [routerLink]="['/linkedin']">
          <div class="icon-bubble cyan">
            <aa-icon name="linkedin" [size]="20"/>
          </div>
          <div class="link-content">
            <div class="link-title">LinkedIn Optimizer</div>
            <div class="link-sub">AI-powered profile headline, summary, and experience boost</div>
          </div>
          <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
        </a>

        <a class="settings-link-card neo" [routerLink]="['/notifications']">
          <div class="icon-bubble pink">
            <aa-icon name="bell" [size]="20"/>
          </div>
          <div class="link-content">
            <div class="link-title">Notification Center</div>
            <div class="link-sub">Review application alerts, system notices, and history</div>
          </div>
          <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
        </a>

        @if (user()?.role === 'admin') {
          <a class="settings-link-card neo admin-card-highlight" [routerLink]="['/admin']">
            <div class="icon-bubble gold">
              <aa-icon name="shield" [size]="20"/>
            </div>
            <div class="link-content">
              <div class="link-title">Admin Management</div>
              <div class="link-sub">System metrics, user directory, coupons, and control</div>
            </div>
            <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
          </a>

          <a class="settings-link-card neo" [routerLink]="['/admin']" [queryParams]="{ tab: 'brand' }">
            <div class="icon-bubble cyan">
              <aa-icon name="sparkles" [size]="20"/>
            </div>
            <div class="link-content">
              <div class="link-title">Brand Assets &amp; Logo Suite</div>
              <div class="link-sub">17 official vector logos, app icons, favicons &amp; media assets</div>
            </div>
            <aa-icon name="chevronRight" [size]="16" class="link-chevron"/>
          </a>
        }
      </div>

      <!-- GDPR & Data Privacy Section -->
      <div class="section-label">PRIVACY &amp; DATA MANAGEMENT</div>
      <div class="section-card gdpr-card neo">
        <div class="gdpr-header">
          <div class="gdpr-title-group">
            <div class="icon-bubble green">
              <aa-icon name="shield" [size]="22"/>
            </div>
            <div>
              <h3 class="gdpr-title">Your Data (GDPR Portability)</h3>
              <p class="gdpr-sub">Download an export of all information linked to your account.</p>
            </div>
          </div>
          <div class="compliance-tags">
            <span class="tag">GDPR Art. 15</span>
            <span class="tag">JSON Format</span>
            <span class="tag">Encrypted</span>
          </div>
        </div>

        <div class="gdpr-body">
          <p class="gdpr-desc">
            Under data protection regulations, you can download a complete archive of your stored data,
            including your parsed profile, job preferences, tailored resume versions, and application history.
          </p>

          <div class="gdpr-footer">
            <aa-button
              variant="secondary"
              [loading]="exporting()"
              (clicked)="exportData()"
              icon="download">
              Export Account Data (JSON)
            </aa-button>
            <span class="export-note text-muted text-xs">
              Exports are generated securely and delivered immediately to your browser.
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mb-24 { margin-bottom: 24px; }
    .section-label {
      font-size: 11px; font-weight: 800; letter-spacing: 0.8px;
      color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase;
    }

    /* ─── Account Card ─────────────────────────────────────── */
    .account-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 22px 24px; gap: 16px; flex-wrap: wrap;
    }
    .account-left { display: flex; align-items: center; gap: 16px; }
    .account-avatar {
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px; flex-shrink: 0;
      box-shadow: 0 4px 16px var(--accent-dim);
    }
    .account-info { display: flex; flex-direction: column; gap: 4px; }
    .account-name-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .account-name { font-size: 18px; font-weight: 700; color: var(--text); margin: 0; }
    .account-email { font-size: 13px; color: var(--text-muted); margin: 0; }

    .badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 50px; font-size: 11px; font-weight: 700;
    }
    .plan-badge {
      background: var(--surface-hover-strong); color: var(--text-muted);
      border: 1px solid var(--glass-border);
    }
    .plan-badge.pro {
      background: rgba(139, 125, 255, 0.16); color: var(--accent);
      border-color: rgba(139, 125, 255, 0.3);
    }
    .plan-badge.elite {
      background: rgba(251, 191, 36, 0.16); color: var(--warning);
      border-color: rgba(251, 191, 36, 0.3);
    }
    .admin-badge {
      background: rgba(56, 249, 215, 0.16); color: var(--success-secondary);
      border: 1px solid rgba(56, 249, 215, 0.3);
    }

    .btn-profile-link {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: var(--radius-sm);
      background: var(--glass-bg-strong); border: 1px solid var(--glass-border);
      color: var(--text); font-size: 13px; font-weight: 600;
      text-decoration: none; transition: all .2s;
    }
    .btn-profile-link:hover {
      background: var(--surface-hover); color: var(--accent);
      border-color: var(--accent-ring);
    }

    /* ─── Settings Grid ────────────────────────────────────── */
    .settings-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
    }
    @media (max-width: 768px) {
      .settings-grid { grid-template-columns: 1fr; }
    }

    .settings-link-card {
      display: flex; align-items: center; gap: 16px; padding: 20px;
      text-decoration: none; cursor: pointer; transition: all .22s ease;
      border-radius: var(--radius); min-height: 84px;
    }
    .settings-link-card:hover {
      transform: translateY(-2px); box-shadow: var(--neo-float);
      border-color: var(--accent-ring);
    }
    .admin-card-highlight {
      border: 1px solid rgba(251, 191, 36, 0.35);
      background: radial-gradient(circle at 100% 0%, rgba(251, 191, 36, 0.08), transparent 60%), var(--bg);
    }

    .icon-bubble {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .icon-bubble.purple { background: rgba(139, 125, 255, 0.15); color: var(--accent); }
    .icon-bubble.blue   { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .icon-bubble.amber  { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .icon-bubble.cyan   { background: rgba(6, 182, 212, 0.15); color: #06b6d4; }
    .icon-bubble.pink   { background: rgba(236, 72, 153, 0.15); color: #ec4899; }
    .icon-bubble.green  { background: rgba(74, 222, 128, 0.15); color: var(--success); }
    .icon-bubble.gold   { background: rgba(251, 191, 36, 0.2); color: var(--gold); }

    .link-content { flex: 1; min-width: 0; }
    .link-title { font-size: 14px; font-weight: 700; color: var(--text); }
    .link-sub { font-size: 12px; color: var(--text-muted); margin-top: 3px; line-height: 1.4; }
    .link-chevron { color: var(--text-muted); transition: transform .2s; }
    .settings-link-card:hover .link-chevron { transform: translateX(3px); color: var(--accent); }

    /* ─── GDPR Card ────────────────────────────────────────── */
    .gdpr-card { padding: 24px; }
    .gdpr-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .gdpr-title-group { display: flex; align-items: center; gap: 14px; }
    .gdpr-title { font-size: 16px; font-weight: 700; color: var(--text); margin: 0; }
    .gdpr-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .compliance-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tag {
      font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
      background: var(--surface-subtle); border: 1px solid var(--glass-border);
      color: var(--text-muted); letter-spacing: 0.4px;
    }

    .gdpr-desc { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 20px; }
    .gdpr-footer { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .export-note { max-width: 400px; line-height: 1.4; }
  `]
})
export class SettingsComponent {
  auth = inject(AuthService);
  api  = inject(ApiService);
  toast= inject(ToastService);

  exporting = signal(false);

  user = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const n = this.auth.currentUser()?.name || '';
    return n.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  });
  planLabel = computed(() => {
    const p = this.user()?.plan || 'free';
    return p === 'free' ? 'Free Plan' : p.charAt(0).toUpperCase() + p.slice(1) + ' Plan';
  });

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
      error: () => {
        this.toast.error('Export failed');
        this.exporting.set(false);
      },
    });
  }
}
