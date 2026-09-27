/**
 * Admin Panel — platform stats, searchable user list, and live-editable
 * plan/system settings (SystemSetting DB-override layer on top of the
 * env-var defaults — see backend/src/config/systemSettings.service.js).
 * Gated by adminGuard on the route + requireAdmin on every API call.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { BrandService } from '../../core/services/brand.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ 'ADMIN.TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'ADMIN.SUBTITLE' | translate }}</p>
      </div>

      <div class="tabs neo-sm">
        @for (t of tabs; track t.id) {
          <button class="tab-btn" [class.active]="activeTab() === t.id" (click)="setTab(t.id)">
            <aa-icon [name]="t.icon" [size]="14"/> {{ t.label | translate }}
          </button>
        }
      </div>

      <!-- ── Overview ─────────────────────────────────────────────── -->
      @if (activeTab() === 'overview') {
        @if (statsLoading()) {
          <div class="stat-grid">
            @for (i of [1,2,3,4,5,6]; track i) { <div class="stat-skeleton neo"></div> }
          </div>
        } @else if (stats()) {
          <div class="stat-grid">
            <div class="stat-card neo"><div class="stat-val">{{ stats().totalUsers }}</div><div class="stat-lbl">{{ 'ADMIN.TOTAL_USERS' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().newUsers7d }}</div><div class="stat-lbl">{{ 'ADMIN.NEW_7D' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().verifiedUsers }}</div><div class="stat-lbl">{{ 'ADMIN.VERIFIED' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().totalApplications }}</div><div class="stat-lbl">{{ 'ADMIN.APPLICATIONS' | translate }}</div></div>
            <div class="stat-card neo"><div class="stat-val">{{ stats().totalAlerts }}</div><div class="stat-lbl">{{ 'ADMIN.ALERTS_SENT' | translate }}</div></div>
            <div class="stat-card neo highlight"><div class="stat-val">{{ stats().currency }} {{ stats().estimatedMrr | number }}</div><div class="stat-lbl">{{ 'ADMIN.EST_MRR' | translate }}</div></div>
          </div>

          <h2 class="section-title">{{ 'ADMIN.PLAN_BREAKDOWN' | translate }}</h2>
          <div class="plan-breakdown">
            @for (p of planEntries(); track p[0]) {
              <div class="plan-row neo-sm">
                <span class="plan-name">{{ p[0] }}</span>
                <div class="plan-bar-track"><div class="plan-bar" [style.width.%]="planPct(p[1])"></div></div>
                <span class="plan-count">{{ p[1] }}</span>
              </div>
            }
          </div>
        }
      }

      <!-- ── Users ────────────────────────────────────────────────── -->
      @if (activeTab() === 'users') {
        <div class="search-row">
          <input class="search-input" [(ngModel)]="searchTerm" (keyup.enter)="searchUsers()" [placeholder]="'ADMIN.SEARCH_PLACEHOLDER' | translate">
          <aa-button variant="secondary" size="sm" icon="search" (clicked)="searchUsers()">{{ 'COMMON.SEARCH' | translate }}</aa-button>
        </div>

        @if (usersLoading()) {
          <div class="skeleton-list">@for (i of [1,2,3,4,5]; track i) { <div class="row-skeleton neo"></div> }</div>
        } @else {
          <div class="user-table neo">
            <div class="user-table-head">
              <span>{{ 'ADMIN.COL_USER' | translate }}</span>
              <span>{{ 'ADMIN.COL_PLAN' | translate }}</span>
              <span>{{ 'ADMIN.COL_APPS' | translate }}</span>
              <span>{{ 'ADMIN.COL_JOINED' | translate }}</span>
              <span></span>
            </div>
            @for (u of users(); track u._id) {
              <button type="button" class="user-row" (click)="openUser(u._id)" [attr.aria-label]="'View details for ' + u.name">
                <span class="user-cell">
                  <span class="user-name">{{ u.name }}</span>
                  <span class="user-email">{{ u.email }}</span>
                </span>
                <span class="plan-chip" [class]="u.plan">{{ u.plan }}</span>
                <span>{{ u.totalApplications || 0 }}</span>
                <span class="user-date">{{ u.createdAt | date:'mediumDate' }}</span>
                <span><aa-icon name="chevronRight" [size]="14"/></span>
              </button>
            }
          </div>
          @if (usersTotal() > users().length) {
            <div class="load-more"><aa-button variant="secondary" (clicked)="loadMoreUsers()">{{ 'COMMON.LOAD_MORE' | translate }}</aa-button></div>
          }
        }
      }

      <!-- ── Settings ─────────────────────────────────────────────── -->
      @if (activeTab() === 'settings') {
        <p class="settings-hint">{{ 'ADMIN.SETTINGS_HINT' | translate }}</p>
        @for (plan of planIds; track plan) {
          <div class="settings-card neo">
            <div class="settings-card-head">{{ plan | uppercase }}</div>
            <div class="settings-field">
              <label>{{ 'ADMIN.PRICE_LABEL' | translate }}</label>
              <input type="number" class="settings-input" [(ngModel)]="editValues[plan + '.price']" [placeholder]="planDefaults()[plan]?.price">
            </div>
            <aa-button size="sm" [loading]="savingKey() === plan + '.price'" (clicked)="saveSetting(plan, 'price')">{{ 'COMMON.SAVE' | translate }}</aa-button>
          </div>
        }
      }

      <!-- ── Features (Session 37) ───────────────────────────────────
           Real, enforced toggles — see backend/src/config/featureFlags
           .service.js. Disabling payments makes every plan-gated feature
           available to everyone; disabling referrals stops new referral
           codes from being applied and hides the referral UI. Neither
           toggle mutates stored user data — fully reversible. -->
      @if (activeTab() === 'features') {
        <p class="settings-hint">{{ 'ADMIN.FEATURES_HINT' | translate }}</p>

        @if (flagsLoading()) {
          <div class="row-skeleton neo" style="height:88px;"></div>
          <div class="row-skeleton neo" style="height:88px; margin-top:10px;"></div>
        } @else {
          <div class="settings-card neo toggle-card">
            <div class="toggle-row">
              <div>
                <div class="settings-card-head">{{ 'ADMIN.PAYMENTS_TOGGLE' | translate }}</div>
                <p class="toggle-desc">{{ 'ADMIN.PAYMENTS_TOGGLE_DESC' | translate }}</p>
              </div>
              <button type="button" class="switch" [class.on]="flags().paymentsEnabled"
                      [attr.aria-pressed]="flags().paymentsEnabled" [attr.aria-label]="'ADMIN.PAYMENTS_TOGGLE' | translate"
                      [disabled]="savingFlag() === 'payments'" (click)="toggleFlag('payments')">
                <span class="switch-knob"></span>
              </button>
            </div>
            @if (!flags().paymentsEnabled) {
              <div class="toggle-warning"><aa-icon name="info" [size]="13"/> {{ 'ADMIN.PAYMENTS_OFF_WARNING' | translate }}</div>
            }
          </div>

          <div class="settings-card neo toggle-card">
            <div class="toggle-row">
              <div>
                <div class="settings-card-head">{{ 'ADMIN.REFERRALS_TOGGLE' | translate }}</div>
                <p class="toggle-desc">{{ 'ADMIN.REFERRALS_TOGGLE_DESC' | translate }}</p>
              </div>
              <button type="button" class="switch" [class.on]="flags().referralsEnabled"
                      [attr.aria-pressed]="flags().referralsEnabled" [attr.aria-label]="'ADMIN.REFERRALS_TOGGLE' | translate"
                      [disabled]="savingFlag() === 'referrals'" (click)="toggleFlag('referrals')">
                <span class="switch-knob"></span>
              </button>
            </div>
          </div>
        }
      }

      <!-- ── Coupons (Session 37) — real Stripe coupons + promotion codes ── -->
      @if (activeTab() === 'coupons') {
        <p class="settings-hint">{{ 'ADMIN.COUPONS_HINT' | translate }}</p>

        <div class="settings-card neo coupon-form">
          <div class="settings-card-head">{{ 'ADMIN.CREATE_COUPON' | translate }}</div>
          <div class="coupon-form-grid">
            <div class="settings-field">
              <label>{{ 'ADMIN.COUPON_CODE' | translate }}</label>
              <input class="settings-input" [(ngModel)]="couponForm.code" placeholder="WELCOME20" (input)="couponForm.code = couponForm.code.toUpperCase()">
            </div>
            <div class="settings-field">
              <label>{{ 'ADMIN.COUPON_TYPE' | translate }}</label>
              <select class="settings-input" [(ngModel)]="couponForm.type">
                <option value="percent">{{ 'ADMIN.COUPON_PERCENT_OFF' | translate }}</option>
                <option value="amount">{{ 'ADMIN.COUPON_AMOUNT_OFF' | translate }}</option>
              </select>
            </div>
            <div class="settings-field">
              <label>{{ (couponForm.type === 'percent' ? 'ADMIN.COUPON_PERCENT_OFF' : 'ADMIN.COUPON_AMOUNT_OFF') | translate }}</label>
              <input type="number" class="settings-input" [(ngModel)]="couponForm.value" [placeholder]="couponForm.type === 'percent' ? '20' : '200'">
            </div>
            <div class="settings-field">
              <label>{{ 'ADMIN.COUPON_DURATION' | translate }}</label>
              <select class="settings-input" [(ngModel)]="couponForm.duration">
                <option value="once">{{ 'ADMIN.COUPON_ONCE' | translate }}</option>
                <option value="repeating">{{ 'ADMIN.COUPON_REPEATING' | translate }}</option>
                <option value="forever">{{ 'ADMIN.COUPON_FOREVER' | translate }}</option>
              </select>
            </div>
            @if (couponForm.duration === 'repeating') {
              <div class="settings-field">
                <label>{{ 'ADMIN.COUPON_MONTHS' | translate }}</label>
                <input type="number" class="settings-input" [(ngModel)]="couponForm.durationInMonths" placeholder="3">
              </div>
            }
            <div class="settings-field">
              <label>{{ 'ADMIN.COUPON_MAX_REDEMPTIONS' | translate }}</label>
              <input type="number" class="settings-input" [(ngModel)]="couponForm.maxRedemptions" [placeholder]="'ADMIN.COUPON_UNLIMITED' | translate">
            </div>
          </div>
          <aa-button size="sm" [loading]="creatingCoupon()" (clicked)="createCoupon()" icon="gift">{{ 'ADMIN.CREATE_COUPON_BTN' | translate }}</aa-button>
        </div>

        @if (couponsLoading()) {
          <div class="skeleton-list" style="margin-top:16px;">@for (i of [1,2,3]; track i) { <div class="row-skeleton neo"></div> }</div>
        } @else if (coupons().length === 0) {
          <div class="empty-state neo" style="margin-top:16px;"><div class="empty-title">{{ 'ADMIN.NO_COUPONS' | translate }}</div></div>
        } @else {
          <div class="coupon-list">
            @for (c of coupons(); track c.id) {
              <div class="coupon-row neo-sm" [class.inactive]="!c.active">
                <div class="coupon-code">{{ c.code }}</div>
                <div class="coupon-discount">
                  {{ c.percentOff ? c.percentOff + '% off' : (currencySymbol + c.amountOff + ' off') }}
                  <span class="coupon-duration">· {{ c.duration }}{{ c.duration === 'repeating' ? ' (' + c.durationInMonths + 'mo)' : '' }}</span>
                </div>
                <div class="coupon-redemptions">{{ c.timesRedeemed }}{{ c.maxRedemptions ? ' / ' + c.maxRedemptions : '' }} {{ 'ADMIN.COUPON_REDEEMED' | translate }}</div>
                @if (c.active) {
                  <aa-button variant="secondary" size="sm" [loading]="deactivatingId() === c.id" (clicked)="deactivateCoupon(c.id)">{{ 'ADMIN.DEACTIVATE' | translate }}</aa-button>
                } @else {
                  <span class="coupon-inactive-tag">{{ 'ADMIN.INACTIVE' | translate }}</span>
                }
              </div>
            }
          </div>
        }
      }

      <!-- ── Brand & Logo Assets ──────────────────────────────────── -->
      @if (activeTab() === 'brand') {
        <div class="brand-panel">
          <!-- Custom Brand Logo Upload Card -->
          <div class="brand-upload-card neo mb-24">
            <div class="upload-header">
              <div>
                <h2 class="section-title mb-4">
                  <aa-icon name="upload" [size]="18" class="text-accent"/>
                  <span>Upload Custom Brand Logo</span>
                </h2>
                <p class="brand-upload-sub">Upload an SVG, PNG, WebP or JPG logo to replace the default brand mark across the platform.</p>
              </div>
              @if (customLogoUrl()) {
                <span class="active-logo-tag">
                  <aa-icon name="checkCircle" [size]="14" class="text-success"/> Active Custom Logo
                </span>
              }
            </div>

            <div class="upload-body">
              <div class="upload-preview-box" [class.has-preview]="logoPreview() || customLogoUrl()">
                @if (logoPreview()) {
                  <img [src]="logoPreview()" alt="Logo Preview" class="preview-img" />
                } @else if (customLogoUrl()) {
                  <img [src]="customLogoUrl()" alt="Active Custom Logo" class="preview-img" />
                } @else {
                  <div class="preview-placeholder">
                    <aa-icon name="image" [size]="32" class="text-muted mb-8"/>
                    <span>No custom logo uploaded (using default)</span>
                  </div>
                }
              </div>

              <div class="upload-controls">
                <div class="file-picker-row">
                  <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg,.png,.jpg,.jpeg,.webp" #fileInput (change)="onLogoFileSelected($event)" class="file-hidden-input" id="adminLogoUpload" />
                  <label for="adminLogoUpload" class="custom-file-label neo-sm">
                    <aa-icon name="fileEdit" [size]="14"/>
                    <span>{{ selectedLogoFile ? selectedLogoFile.name : 'Choose Logo File...' }}</span>
                  </label>
                  <span class="file-hint">SVG recommended, PNG/WebP up to 5MB</span>
                </div>

                <div class="upload-actions">
                  <aa-button size="sm" [loading]="uploadingLogo()" [disabled]="!selectedLogoFile" (clicked)="uploadLogo()" icon="upload">
                    Upload &amp; Activate Logo
                  </aa-button>
                  @if (customLogoUrl() || logoPreview()) {
                    <aa-button variant="ghost" size="sm" (clicked)="resetLogo()" [disabled]="uploadingLogo()" icon="trash">
                      Reset to Default
                    </aa-button>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="brand-hero-card neo mb-24">
            <div class="brand-hero-header">
              <div>
                <h2 class="section-title" style="margin-bottom: 4px;">Official SVG Brand Asset Suite</h2>
                <p class="brand-hero-sub">Complete collection of 17 vector logos, app icons, and marks for AutoApply AI.</p>
              </div>
              <div class="brand-palette">
                <span class="color-chip" style="background:#050B20;" title="Navy: #050B20">#050B20</span>
                <span class="color-chip" style="background:#071433;" title="Ink: #071433">#071433</span>
                <span class="color-chip" style="background:#22E6F2;color:#050b20;" title="Cyan: #22E6F2">#22E6F2</span>
                <span class="color-chip" style="background:#087CF5;" title="Blue: #087CF5">#087CF5</span>
                <span class="color-chip" style="background:#D43DFF;" title="Purple: #D43DFF">#D43DFF</span>
              </div>
            </div>
          </div>

          <div class="brand-grid">
            @for (asset of brandAssets; track asset.id) {
              <div class="brand-card neo">
                <div class="brand-preview" [class.light-surface]="asset.isLightBg">
                  <img [src]="'assets/logos/' + asset.file" [alt]="asset.name" loading="lazy" />
                </div>
                <div class="brand-info">
                  <div class="brand-title-row">
                    <span class="brand-num">{{ asset.id }}</span>
                    <strong class="brand-name">{{ asset.name }}</strong>
                  </div>
                  <p class="brand-desc">{{ asset.description }}</p>
                  <p class="brand-use"><strong>Recommended:</strong> {{ asset.recommendedUse }}</p>
                  <div class="brand-meta">
                    <span class="meta-tag"><aa-icon name="sparkles" [size]="11"/> {{ asset.dimensions }}</span>
                    <a [href]="'assets/logos/' + asset.file" [download]="asset.file" class="btn-download-asset">
                      <aa-icon name="download" [size]="12"/> Download SVG
                    </a>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .tabs { display:flex; gap:2px; padding:4px; margin-bottom:24px; width:fit-content; max-width:100%; overflow-x:auto; background:var(--surface-subtle); border:1px solid var(--glass-border); border-radius:var(--radius-sm); }
    .tab-btn { display:flex; align-items:center; gap:7px; padding:9px 14px; border-radius:8px; border:1px solid transparent; background:transparent; cursor:pointer; font-size:12px; font-weight:700; color:var(--text-muted); transition:color var(--duration-base) var(--ease-out), background var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out); white-space:nowrap; }
    .tab-btn:hover { color:var(--text); background:var(--surface-hover); }
    .tab-btn:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
    .tab-btn.active { background:var(--glass-bg-strong); border-color:var(--glass-border); box-shadow:var(--neo-sm); color:var(--accent); }

    .stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px; }
    @media (max-width:768px){ .stat-grid{ grid-template-columns:repeat(2,1fr);} }
    @media (max-width:640px) {
      .tabs { overflow-x: auto; max-width: 100%; }
      .search-row { flex-direction: column; }
      .user-table-head { display: none; }
      .user-table-head, .user-row { grid-template-columns: 1fr 24px; }
      .user-row .plan-chip, .user-row > span:nth-child(3), .user-row .user-date { display: none; }
      .settings-card { padding: 14px; }
    }
    .stat-skeleton { height:88px; border-radius:var(--radius); }
    .stat-card { padding:18px; }
    .stat-card.highlight { box-shadow: var(--neo-raised), 0 0 0 1px var(--accent-ring) inset; }
    .stat-val { font-family:var(--font-display); font-size:22px; font-weight:800; color:var(--text); }
    .stat-lbl { font-size:11px; color:var(--text-muted); font-weight:600; margin-top:4px; }

    .section-title { font-family:var(--font-display); font-size:14px; font-weight:700; color:var(--text); margin-bottom:12px; }
    .plan-breakdown { display:flex; flex-direction:column; gap:8px; }
    .plan-row { display:flex; align-items:center; gap:12px; padding:10px 14px; }
    .plan-name { width:80px; font-size:12px; font-weight:700; text-transform:capitalize; color:var(--text); }
    .plan-bar-track { flex:1; height:6px; border-radius:999px; background:var(--bg); box-shadow:var(--neo-inset); overflow:hidden; }
    .plan-bar { height:100%; background:var(--accent); border-radius:999px; }
    .plan-count { width:32px; text-align:right; font-size:12px; font-weight:700; color:var(--text-muted); }

    .search-row { display:flex; gap:10px; margin-bottom:20px; }
    .search-input { flex:1; min-width:0; padding:11px 14px; border:1px solid var(--glass-border); border-radius:var(--radius-sm); background:var(--glass-bg-strong); box-shadow:none; font-size:13px; color:var(--text); font-family:var(--font-body); outline:none; transition:border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out); }
    .search-input:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-ring); }

    .skeleton-list { display:flex; flex-direction:column; gap:8px; }
    .row-skeleton { height:56px; border-radius:var(--radius); }

    .user-table { overflow:hidden; }
    .user-table-head, .user-row { display:grid; grid-template-columns:2fr 1fr 0.7fr 1fr 24px; align-items:center; padding:12px 16px; gap:8px; }
    .user-table-head { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted); border-bottom:1px solid var(--glass-border); }
    .user-row { cursor:pointer; border-bottom:1px solid var(--glass-border); transition:background .15s; border-left:none; border-right:none; border-top:none; background:none; font-family:inherit; font-size:inherit; color:inherit; text-align:left; width:100%; }
    .user-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .user-row:last-child { border-bottom:none; }
    .user-row:hover { background:var(--surface-hover); }
    .user-row:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; background:var(--accent-hover); }
    .user-cell { display:flex; flex-direction:column; min-width:0; }
    .user-name { font-size:12px; font-weight:700; color:var(--text); }
    .user-email { font-size:11px; color:var(--text-muted); }
    .user-date { font-size:11px; color:var(--text-muted); }
    .plan-chip { width:fit-content; padding:3px 10px; border-radius:999px; font-size:10px; font-weight:800; text-transform:uppercase; background:var(--accent-dim); color:var(--accent); }

    .load-more { display:flex; justify-content:center; margin-top:16px; }

    .settings-hint { font-size:12px; color:var(--text-muted); margin-bottom:18px; }
    .settings-card { padding:18px; margin-bottom:14px; }
    .settings-card-head { font-family:var(--font-display); font-size:13px; font-weight:800; color:var(--accent); margin-bottom:12px; }
    .settings-field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
    .settings-field label { font-size:11px; font-weight:700; color:var(--text-muted); }
    .settings-input { width:100%; padding:9px 12px; border:1px solid var(--glass-border); border-radius:8px; background:var(--glass-bg-strong); box-shadow:none; font-size:13px; color:var(--text); font-family:var(--font-body); }

    /* Feature toggles */
    .toggle-card { padding: 18px 20px; margin-bottom: 14px; }
    .toggle-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .toggle-desc { font-size: 11px; color: var(--text-muted); margin-top: 4px; max-width: 380px; }
    .switch { position: relative; width: 44px; height: 24px; border-radius: 999px; border: none; background: var(--bg); box-shadow: var(--neo-inset); cursor: pointer; flex-shrink: 0; transition: background .2s; }
    .switch.on { background: var(--accent); box-shadow: none; }
    .switch:disabled { opacity: .6; cursor: wait; }
    .switch-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s; }
    .switch.on .switch-knob { transform: translateX(20px); }
    .toggle-warning { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; background: rgba(245,158,11,.1); color: var(--warning-text); font-size: 11px; font-weight: 600; }

    /* Coupons */
    .coupon-form { margin-bottom: 20px; }
    .coupon-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .coupon-list { display: flex; flex-direction: column; gap: 8px; }
    .coupon-row { display: grid; grid-template-columns: 1fr 1.3fr 1fr auto; align-items: center; gap: 12px; padding: 12px 16px; }
    .coupon-row.inactive { opacity: .55; }
    .coupon-code { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--accent); letter-spacing: .5px; }
    .coupon-discount { font-size: 12px; font-weight: 700; color: var(--text); }
    .coupon-duration { font-weight: 500; color: var(--text-muted); }
    .coupon-redemptions { font-size: 11px; color: var(--text-muted); }
    .coupon-inactive-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--text-light); }
    @media (max-width: 640px) { .coupon-row { grid-template-columns: 1fr; text-align: left; } }

    /* Brand Assets */
    .brand-hero-card { padding: 20px 24px; border-radius: var(--radius); }
    .brand-hero-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
    .brand-hero-sub { font-size: 12px; color: var(--text-muted); margin: 0; }
    .brand-palette { display: flex; gap: 8px; flex-wrap: wrap; }
    .color-chip { padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; color: #fff; font-family: monospace; border: 1px solid rgba(255,255,255,0.1); }
    .brand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .brand-card { display: flex; flex-direction: column; overflow: hidden; border-radius: var(--radius); }
    .brand-preview { height: 140px; display: flex; align-items: center; justify-content: center; padding: 16px; background: #050b20; border-bottom: 1px solid var(--glass-border); }
    .brand-preview.light-surface { background: #f8fafc; }
    .brand-preview img { max-width: 90%; max-height: 90%; object-fit: contain; }
    .brand-info { padding: 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .brand-title-row { display: flex; align-items: center; gap: 8px; }
    .brand-num { font-size: 10px; font-weight: 800; background: var(--surface-subtle); color: var(--accent); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .brand-name { font-size: 13px; font-weight: 700; color: var(--text); }
    .brand-desc { font-size: 11px; color: var(--text-muted); margin: 0; }
    .brand-use { font-size: 11px; color: var(--text-secondary); margin: 0; line-height: 1.4; }
    .brand-meta { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--glass-border); }
    .meta-tag { font-size: 10px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px; }
    .brand-upload-card { padding: 24px; border-left: 4px solid var(--accent); }
    .upload-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .brand-upload-sub { font-size: 13px; color: var(--text-muted); margin: 0; }
    .active-logo-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; background: rgba(74, 222, 128, 0.12); color: var(--success); font-size: 12px; font-weight: 700; border: 1px solid rgba(74, 222, 128, 0.3); }
    .upload-body { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
    .upload-preview-box { width: 220px; height: 110px; border-radius: 12px; border: 2px dashed var(--glass-border); background: var(--bg); display: flex; align-items: center; justify-content: center; padding: 12px; overflow: hidden; text-align: center; }
    .upload-preview-box.has-preview { border-style: solid; border-color: var(--accent); background: var(--surface-subtle); }
    .preview-img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .preview-placeholder { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: var(--text-muted); }
    .upload-controls { flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 14px; }
    .file-picker-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .file-hidden-input { display: none; }
    .custom-file-label { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--glass-border); background: var(--surface-subtle); color: var(--text); font-size: 12px; font-weight: 600; cursor: pointer; transition: all .2s; }
    .custom-file-label:hover { background: var(--surface-hover); color: var(--accent); }
    .file-hint { font-size: 11px; color: var(--text-muted); }
    .upload-actions { display: flex; align-items: center; gap: 10px; }
    .btn-download-asset { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: var(--accent); text-decoration: none; padding: 4px 8px; border-radius: 6px; background: var(--surface-subtle); border: 1px solid var(--glass-border); transition: all .2s; }
    .btn-download-asset:hover { background: var(--accent); color: #fff; }
  `]
})
export class AdminComponent implements OnInit {
  activeTab = signal<'overview' | 'users' | 'settings' | 'features' | 'coupons' | 'brand'>('overview');
  tabs: { id: 'overview' | 'users' | 'settings' | 'features' | 'coupons' | 'brand'; icon: string; label: string }[] = [
    { id: 'overview', icon: 'analytics', label: 'ADMIN.TAB_OVERVIEW' },
    { id: 'users',    icon: 'users',     label: 'ADMIN.TAB_USERS' },
    { id: 'settings', icon: 'settings',  label: 'ADMIN.TAB_SETTINGS' },
    { id: 'features', icon: 'zap',       label: 'ADMIN.TAB_FEATURES' },
    { id: 'coupons',  icon: 'gift',      label: 'ADMIN.TAB_COUPONS' },
    { id: 'brand',    icon: 'sparkles',  label: 'Brand & Logos' },
  ];

  brandAssets = [
    { id: '01', name: 'Full Logo Horizontal (Dark)', file: '01-full-logo-horizontal-dark.svg', description: 'Primary dark UI / website header', recommendedUse: 'Navigation bar, dark backgrounds, high-impact branding', dimensions: '900 × 300' },
    { id: '02', name: 'Full Logo Horizontal (Light)', file: '02-full-logo-horizontal-light.svg', description: 'Light UI / white text on dark surface', recommendedUse: 'Light surface with dark card container', dimensions: '900 × 300' },
    { id: '03', name: 'Full Logo Horizontal (Transparent)', file: '03-full-logo-horizontal-transparent.svg', description: 'Transparent canvas version', recommendedUse: 'Custom background overlays, headers, and flexible surfaces', dimensions: '900 × 300' },
    { id: '04', name: 'Logo Vertical (Dark)', file: '04-logo-vertical-dark.svg', description: 'Hero / splash / centered branding', recommendedUse: 'Centered hero sections, auth portals, presentation slides', dimensions: '600 × 400' },
    { id: '05', name: 'Logo Vertical (Light)', file: '05-logo-vertical-light.svg', description: 'Light background centered branding', recommendedUse: 'Light mode splash, invoices, printed certificates', dimensions: '600 × 400', isLightBg: true },
    { id: '06', name: 'Logo Mark Only', file: '06-logo-mark-only.svg', description: 'Generic mark where space is limited', recommendedUse: 'Collapsed sidebar, tiny headers, app badges', dimensions: '300 × 200' },
    { id: '07', name: 'App Icon (512px)', file: '07-app-icon-512.svg', description: 'PWA / mobile / app icon source', recommendedUse: 'PWA manifest, iOS home screen, Android launcher, app stores', dimensions: '512 × 512' },
    { id: '08', name: 'Favicon (32px)', file: '08-favicon-32.svg', description: 'Browser favicon / tiny icon', recommendedUse: 'Browser tab icon, bookmark bar, URL bar favicon', dimensions: '80 × 80 (32 × 32)' },
    { id: '09', name: 'Monochrome (White)', file: '09-monochrome-white.svg', description: 'One-color dark-surface use', recommendedUse: 'High contrast mode, single-color silk screen, foil stamping', dimensions: '300 × 200' },
    { id: '10', name: 'Monochrome (Black)', file: '10-monochrome-black.svg', description: 'One-color light-surface use', recommendedUse: 'Black and white print, newspaper, thermal receipt, grayscale', dimensions: '300 × 200', isLightBg: true },
    { id: '11', name: 'Social Media Square', file: '11-social-media-square.svg', description: 'Social profiles / square marketing tile', recommendedUse: 'LinkedIn company logo, Twitter avatar, Discord icon', dimensions: '600 × 600' },
    { id: '12', name: 'Email Signature', file: '12-email-signature.svg', description: 'Email signatures / email header', recommendedUse: 'Transactional email footers, team email signatures, newsletter footers', dimensions: '700 × 150', isLightBg: true },
    { id: '13', name: 'Browser Tab Chrome', file: '13-browser-tab.svg', description: 'Compact browser / product chrome', recommendedUse: 'Compact mobile header bar, docked mini tools, browser window mockups', dimensions: '300 × 42' },
    { id: '14', name: 'Splash Screen', file: '14-splash-screen.svg', description: 'App loading / splash screen', recommendedUse: 'Pre-hydration loader, launch screen, initial page transition', dimensions: '900 × 500' },
    { id: '15', name: 'Logo Mark (Light Background)', file: '15-logo-mark-light-background.svg', description: 'Mark on white / light backgrounds', recommendedUse: 'Collapsed sidebar in light theme, white card badges', dimensions: '300 × 200', isLightBg: true },
    { id: '16', name: 'Wordmark Only (Dark)', file: '16-wordmark-only-dark.svg', description: 'Compact dark-background wordmark', recommendedUse: 'Sidebar header next to mark, minimal topbars', dimensions: '400 × 100' },
    { id: '17', name: 'Wordmark Only (Light)', file: '17-wordmark-only-light.svg', description: 'Compact light-background wordmark', recommendedUse: 'Light surface headers, formal documentation', dimensions: '400 × 100', isLightBg: true },
  ];

  setTab(id: 'overview' | 'users' | 'settings' | 'features' | 'coupons' | 'brand'): void {
    this.activeTab.set(id);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: id }, queryParamsHandling: 'merge' });
  }

  // Overview
  statsLoading = signal(true);
  stats = signal<any>(null);

  // Users
  usersLoading = signal(true);
  users = signal<any[]>([]);
  usersTotal = signal(0);
  usersPage = 1;
  searchTerm = '';

  // Settings
  planDefaults = signal<any>({});
  planIds = ['starter', 'pro', 'elite'];
  editValues: Record<string, any> = {};
  savingKey = signal<string | null>(null);

  // Features (Session 37)
  flagsLoading = signal(true);
  flags = signal<{ paymentsEnabled: boolean; referralsEnabled: boolean }>({ paymentsEnabled: true, referralsEnabled: true });
  savingFlag = signal<'payments' | 'referrals' | null>(null);

  // Coupons (Session 37)
  couponsLoading = signal(true);
  coupons = signal<any[]>([]);
  creatingCoupon = signal(false);
  deactivatingId = signal<string | null>(null);
  currencySymbol = '₹';
  couponForm: { code: string; type: 'percent' | 'amount'; value: string; duration: 'once' | 'repeating' | 'forever'; durationInMonths: string; maxRedemptions: string } = {
    code: '', type: 'percent', value: '', duration: 'once', durationInMonths: '', maxRedemptions: '',
  };

  // Brand Logo
  customLogoUrl = signal<string | null>(null);
  logoPreview = signal<string | null>(null);
  selectedLogoFile: File | null = null;
  uploadingLogo = signal(false);

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private featureFlags: FeatureFlagsService,
    private brandService: BrandService
  ) {}

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParams['tab'];
    if (tabParam && ['overview', 'users', 'settings', 'features', 'coupons', 'brand'].includes(tabParam)) {
      this.activeTab.set(tabParam as any);
    }
    this.loadStats();
    this.loadUsers();
    this.loadSettings();
    this.loadFlags();
    this.loadCoupons();
    this.loadBrandLogo();
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.api.getAdminStats().subscribe({
      next: (r: any) => { this.stats.set(r.data); this.statsLoading.set(false); },
      error: () => { this.statsLoading.set(false); this.toast.error('Failed to load stats'); },
    });
  }

  planEntries(): [string, number][] { return Object.entries(this.stats()?.usersByPlan || {}); }
  planPct(count: number): number {
    const max = Math.max(...Object.values(this.stats()?.usersByPlan || { a: 1 }) as number[], 1);
    return Math.max(4, (count / max) * 100);
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.api.getAdminUsers({ page: 1, limit: 20, search: this.searchTerm }).subscribe({
      next: (r: any) => {
        this.users.set(r.data || []);
        this.usersTotal.set(r.meta?.total || 0);
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false),
    });
  }

  onSearch(): void {
    this.usersPage = 1;
    this.loadUsers();
  }

  searchUsers(): void {
    this.onSearch();
  }

  loadMoreUsers(): void {
    this.usersPage++;
    this.api.getAdminUsers({ page: this.usersPage, limit: 20, search: this.searchTerm }).subscribe({
      next: (r: any) => this.users.set([...this.users(), ...(r.data || [])]),
    });
  }

  openUser(id: string): void { this.router.navigate(['/admin/users', id]); }

  loadSettings(): void {
    this.api.getAdminSettings().subscribe({
      next: (r: any) => this.planDefaults.set(r.data?.planDefaults || {}),
      error: () => {},
    });
  }

  saveSetting(plan: string, field: string): void {
    const key = `plan.${plan}.${field}`;
    const val = this.editValues[key];
    if (val === undefined || val === '') return this.toast.error('Enter a value first');
    this.savingKey.set(key);
    this.api.putAdminSetting(`plan.${plan}.${field}`, Number(val), 'plans').subscribe({
      next: () => { this.savingKey.set(null); this.toast.success(`${plan} ${field} updated`); },
      error: () => { this.savingKey.set(null); this.toast.error('Failed to save'); },
    });
  }

  // ── Features (Session 37) ─────────────────────────────────────────────
  loadFlags(): void {
    this.flagsLoading.set(true);
    this.api.getAdminFeatureFlags().subscribe({
      next: (r: any) => { this.flags.set(r.data); this.flagsLoading.set(false); },
      error: () => { this.flagsLoading.set(false); }, // silent — tab isn't necessarily open
    });
  }

  toggleFlag(which: 'payments' | 'referrals'): void {
    const next = which === 'payments' ? !this.flags().paymentsEnabled : !this.flags().referralsEnabled;
    this.savingFlag.set(which);
    const payload = which === 'payments' ? { paymentsEnabled: next } : { referralsEnabled: next };
    this.api.putAdminFeatureFlags(payload).subscribe({
      next: (r: any) => {
        this.flags.set(r.data);
        this.featureFlags.updateFlags(r.data);
        this.savingFlag.set(null);
        this.toast.success(which === 'payments'
          ? (next ? 'Payments re-enabled' : 'Payments disabled — everything is free for all users now')
          : (next ? 'Referral program re-enabled' : 'Referral program disabled'));
      },
      error: () => { this.savingFlag.set(null); this.toast.error('Failed to update — try again'); },
    });
  }

  // ── Coupons (Session 37) ──────────────────────────────────────────────
  loadCoupons(): void {
    this.couponsLoading.set(true);
    this.api.getAdminCoupons().subscribe({
      next: (r: any) => { this.coupons.set(r.data || []); this.couponsLoading.set(false); },
      error: () => { this.couponsLoading.set(false); }, // silent — Stripe may just not be configured yet
    });
  }

  createCoupon(): void {
    const f = this.couponForm;
    if (!f.code.trim()) return this.toast.error('Enter a coupon code');
    if (!f.value || Number(f.value) <= 0) return this.toast.error('Enter a discount value');
    if (f.duration === 'repeating' && (!f.durationInMonths || Number(f.durationInMonths) <= 0)) {
      return this.toast.error('Enter how many months this coupon repeats for');
    }
    this.creatingCoupon.set(true);
    const payload: any = {
      code: f.code.trim(),
      duration: f.duration,
      ...(f.type === 'percent' ? { percentOff: Number(f.value) } : { amountOff: Number(f.value) }),
      ...(f.duration === 'repeating' ? { durationInMonths: Number(f.durationInMonths) } : {}),
      ...(f.maxRedemptions ? { maxRedemptions: Number(f.maxRedemptions) } : {}),
    };
    this.api.createAdminCoupon(payload).subscribe({
      next: () => {
        this.creatingCoupon.set(false);
        this.toast.success(`Coupon ${f.code.toUpperCase()} created`);
        this.couponForm = { code: '', type: 'percent', value: '', duration: 'once', durationInMonths: '', maxRedemptions: '' };
        this.loadCoupons();
      },
      error: (e: any) => { this.creatingCoupon.set(false); this.toast.error(e.error?.message || 'Failed to create coupon'); },
    });
  }

  deactivateCoupon(id: string): void {
    this.deactivatingId.set(id);
    this.api.deactivateAdminCoupon(id).subscribe({
      next: () => { this.deactivatingId.set(null); this.toast.success('Coupon deactivated'); this.loadCoupons(); },
      error: () => { this.deactivatingId.set(null); this.toast.error('Failed to deactivate'); },
    });
  }

  // ── Brand Logo Management ─────────────────────────────────────────────
  loadBrandLogo(): void {
    this.api.getAdminBrandLogo().subscribe({
      next: (res: any) => {
        const url = res?.data?.logoUrl || null;
        this.customLogoUrl.set(url);
        this.brandService.setCustomLogo(url);
      },
      error: () => {
        // Fall back to public config if admin route fails
        this.customLogoUrl.set(this.brandService.customLogoUrl());
      }
    });
  }

  onLogoFileSelected(event: any): void {
    const file = event?.target?.files?.[0];
    if (!file) return;

    // Check size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('Logo file size must be under 5MB');
      return;
    }

    this.selectedLogoFile = file;

    // Generate local preview
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.logoPreview.set(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  uploadLogo(): void {
    if (!this.selectedLogoFile) {
      this.toast.error('Please select an image file first');
      return;
    }

    this.uploadingLogo.set(true);
    const formData = new FormData();
    formData.append('logo', this.selectedLogoFile);

    this.api.uploadAdminBrandLogo(formData).subscribe({
      next: (res: any) => {
        this.uploadingLogo.set(false);
        const newUrl = res?.data?.logoUrl;
        this.customLogoUrl.set(newUrl);
        this.logoPreview.set(null);
        this.selectedLogoFile = null;
        this.brandService.setCustomLogo(newUrl);
        this.toast.success('Brand logo uploaded and activated successfully!');
      },
      error: (err: any) => {
        this.uploadingLogo.set(false);
        this.toast.error(err?.error?.message || 'Failed to upload brand logo');
      }
    });
  }

  resetLogo(): void {
    if (!this.customLogoUrl() && !this.logoPreview()) return;

    if (this.logoPreview() && !this.customLogoUrl()) {
      this.logoPreview.set(null);
      this.selectedLogoFile = null;
      return;
    }

    this.uploadingLogo.set(true);
    this.api.deleteAdminBrandLogo().subscribe({
      next: () => {
        this.uploadingLogo.set(false);
        this.customLogoUrl.set(null);
        this.logoPreview.set(null);
        this.selectedLogoFile = null;
        this.brandService.setCustomLogo(null);
        this.toast.success('Reset to default brand logo');
      },
      error: (err: any) => {
        this.uploadingLogo.set(false);
        this.toast.error(err?.error?.message || 'Failed to reset brand logo');
      }
    });
  }
}
