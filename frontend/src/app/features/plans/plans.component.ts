import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { ToastService } from '../../core/services/toast.service';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NeoButtonComponent, IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header" style="text-align:center;">
        <h1 class="page-title">{{ 'PLANS.TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'PLANS.SUBTITLE' | translate }}</p>
      </div>

      @if (featureFlags.loaded() && !featureFlags.paymentsEnabled()) {
        <div class="free-mode-banner neo" style="max-width: 640px; padding: 18px 24px; text-align: center; border: 1px solid var(--success); margin: 0 auto 28px; border-radius: 16px; background: rgba(34, 197, 94, 0.08);">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 15px; font-weight: 800; color: var(--success);">
            <aa-icon name="gift" [size]="20"/>
            <span>{{ 'PLANS.FREE_MODE' | translate }} — All Features 100% Unlocked</span>
          </div>
          <p style="margin: 6px 0 0; font-size: 12px; color: var(--text-muted); font-weight: 500;">
            Subscriptions are currently disabled. You enjoy full access to all AI tailoring, automated applications, and premium sources at no charge.
          </p>
        </div>
      } @else if ((user()?.referralPoints || 0) > 0) {
        <label class="redeem-banner neo-sm">
          <input type="checkbox" [(ngModel)]="redeemPoints">
          <aa-icon name="gift" [size]="15"/>
          <span>{{ 'PLANS.REDEEM_POINTS' | translate: { points: user()?.referralPoints, currency: currencySymbol() } }}</span>
        </label>
      }

      <div class="plans-grid">
        @if (loadingPlans()) {
          @for (_ of [1,2,3,4]; track $index) {
            <div class="skeleton" style="height:340px;border-radius:16px;"></div>
          }
        } @else {
        @for (p of plans(); track p.id) {
          <div class="plan-card neo" [class.popular]="p.popular" [class.current]="isCurrent(p.id)">
            @if (p.popular && featureFlags.paymentsEnabled()) { <div class="popular-tag">{{ 'PLANS.MOST_POPULAR' | translate }}</div> }
            <div class="plan-name">{{ p.name }}</div>
            <div class="plan-price">
              <span class="price-val">
                @if (!featureFlags.paymentsEnabled()) {
                  <span style="color: var(--success);">{{ 'COMMON.FREE' | translate }}</span>
                } @else {
                  {{ p.price === 0 ? ('COMMON.FREE' | translate) : currencySymbol() + p.price }}
                }
              </span>
              @if (p.price > 0 && featureFlags.paymentsEnabled()) { <span class="price-period">/{{ p.period }}</span> }
            </div>
            <ul class="plan-features">
              @for (f of p.features; track f) {
                <li><aa-icon name="check" [size]="13" class="feat-check"/>{{ f }}</li>
              }
            </ul>
            @if (!featureFlags.paymentsEnabled()) {
              <aa-button variant="secondary" [fullWidth]="true" [disabled]="true" icon="check">{{ 'PLANS.UNLOCKED' | translate }}</aa-button>
            } @else if (isCurrent(p.id)) {
              <aa-button variant="secondary" [fullWidth]="true" [disabled]="true">{{ 'PLANS.CURRENT_PLAN' | translate }}</aa-button>
            } @else if (p.id === 'free') {
              <aa-button variant="secondary" [fullWidth]="true" [disabled]="true">{{ 'PLANS.DOWNGRADE' | translate }}</aa-button>
            } @else {
              <aa-button [fullWidth]="true" [loading]="checkingOut() === p.id" (clicked)="upgrade(p.id)" icon="zap">
                {{ p.cta }}
              </aa-button>
            }
          </div>
        }
        }
      </div>

      @if (hasPaidPlan() && featureFlags.paymentsEnabled()) {
        <div class="section-card manage-card">
          <div class="section-title"><aa-icon name="settings" [size]="16"/> {{ 'PLANS.MANAGE_BILLING' | translate }}</div>
          <p class="text-muted text-sm mb-16">{{ 'PLANS.MANAGE_BILLING_DESC' | translate }}</p>
          <aa-button variant="secondary" [loading]="loadingPortal()" (clicked)="openPortal()" iconRight="externalLink">
            {{ 'PLANS.BILLING_PORTAL' | translate }}
          </aa-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .plans-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin-bottom:24px; align-items:stretch; }
    @media (max-width:1100px){ .plans-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:640px){ .plans-grid{ grid-template-columns:1fr; gap:12px; } }
    .redeem-banner { display: flex; align-items: center; gap: 10px; max-width: 480px; margin: 0 auto 24px; padding: 14px 18px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); }
    .redeem-banner input { width: 16px; height: 16px; accent-color: var(--accent); flex-shrink: 0; cursor: pointer; }
    .redeem-banner aa-icon { color: var(--accent); flex-shrink: 0; }
    .free-mode-banner { display: flex; align-items: center; justify-content: center; gap: 10px; max-width: 480px; margin: 0 auto 24px; padding: 14px 18px; font-size: 13px; font-weight: 700; color: var(--success); }
    .free-mode-banner aa-icon { color: var(--success); flex-shrink: 0; }
    .plan-card { padding:24px 20px; position:relative; display:flex; flex-direction:column; min-width:0; border-color:var(--glass-border); transition:transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out); }
    .plan-card:hover { transform:translateY(-3px); border-color:var(--divider-strong); box-shadow:var(--neo-float); }
    .plan-card.popular { box-shadow:0 0 0 1px var(--accent), var(--neo-raised); }
    .plan-card.current { box-shadow:0 0 0 1px var(--success), var(--neo-raised); }
    .popular-tag {
      position: absolute; top: -11px; left: 50%; transform: translateX(-50%);
      background:linear-gradient(135deg,var(--accent),var(--accent-secondary)); color:#fff;
      font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: var(--radius-pill);
    }
    .plan-name  { font-size: 16px; font-weight: 800; color: var(--text); text-align: center; margin-bottom: 10px; }
    .plan-price { text-align: center; margin-bottom: 20px; }
    .price-val  { font-family: var(--font-display); font-size: 32px; font-weight: 800; color: var(--accent); }
    .price-period { font-size: 13px; color: var(--text-muted); }
    .plan-features { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .plan-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text); line-height: 1.5; }
    .feat-check { color: var(--success); flex-shrink: 0; margin-top: 2px; }
    .manage-card { max-width: 480px; margin: 0 auto; }
    .mb-16 { margin-bottom: 16px; }
  `]
})
export class PlansComponent implements OnInit {
  checkingOut  = signal<string | null>(null);
  loadingPortal= signal(false);
  redeemPoints = false;

  user = computed(() => this.auth.currentUser());
  hasPaidPlan = computed(() => ['starter','pro','elite'].includes(this.user()?.plan || 'free'));

  plans = signal<any[]>([]);
  currencySymbol = signal('₹');
  loadingPlans = signal(true);

  private staticPlansFallback = [
    { id: 'free', name: 'Free', price: 0, period: 'forever', popular: false,
      features: ['3 applications/day', 'Remotive + Himalayas', 'Basic AI resume parsing', 'Email notifications'],
      cta: 'Get Started Free' },
    { id: 'starter', name: 'Starter', price: 299, period: 'month', popular: false,
      features: ['15 applications/day', 'Remotive + Himalayas + Adzuna', 'AI resume tailoring per job', 'Email + WhatsApp alerts', '7-day free trial'],
      cta: 'Start Free Trial' },
    { id: 'pro', name: 'Pro', price: 699, period: 'month', popular: true,
      features: ['50 applications/day', 'All legal job boards incl. Arbeitnow', 'Real-time job detection (2 min)', 'AI resume tailoring per job', 'Full notifications', '7-day free trial'],
      cta: 'Go Pro' },
    { id: 'elite', name: 'Elite', price: 1499, period: 'month', popular: false,
      features: ['200 applications/day', 'Real-time detection (1 min)', 'Priority apply queue', 'Advanced analytics', 'Priority support', '7-day free trial'],
      cta: 'Go Elite' },
  ];

  constructor(
    private api: ApiService,
    public  auth: AuthService,
    public  featureFlags: FeatureFlagsService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.featureFlags.load();
    this.api.getPlansConfig().subscribe({
      next: (r: any) => {
        this.currencySymbol.set(r.data?.currencySymbol || '₹');
        this.plans.set(r.data?.plans?.length ? r.data.plans : this.staticPlansFallback);
        this.loadingPlans.set(false);
      },
      error: () => {
        // Backend not reachable — fall back to static copy so the page still renders.
        this.plans.set(this.staticPlansFallback);
        this.loadingPlans.set(false);
      },
    });

    this.route.queryParams.subscribe(q => {
      if (q['success'] === 'true') {
        this.toast.success('Payment successful — your plan is being updated');
        this.auth.fetchMe().subscribe({ error: () => {} }); // best-effort UI refresh — plan change already landed server-side via webhook
        this.router.navigate([], { queryParams: {} });
      } else if (q['cancelled'] === 'true') {
        this.toast.info('Checkout cancelled');
        this.router.navigate([], { queryParams: {} });
      }
    });
  }

  isCurrent(planId: string): boolean { return (this.user()?.plan || 'free') === planId; }

  upgrade(planId: string): void {
    if (!this.featureFlags.paymentsEnabled()) { this.toast.info('Everything is free right now — no purchase needed.'); return; }
    this.checkingOut.set(planId);
    const points = this.redeemPoints ? (this.user()?.referralPoints || 0) : 0;
    this.api.createCheckout(planId, points).subscribe({
      next: (r: any) => {
        if (r.data?.url) window.location.href = r.data.url;
        else { this.toast.error('Checkout unavailable'); this.checkingOut.set(null); }
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || 'Payments not configured yet');
        this.checkingOut.set(null);
      },
    });
  }

  openPortal(): void {
    this.loadingPortal.set(true);
    this.api.getBillingPortal().subscribe({
      next: (r: any) => {
        if (r.data?.url) window.location.href = r.data.url;
        this.loadingPortal.set(false);
      },
      error: (e: any) => { this.toast.error(e.error?.message || 'Portal unavailable'); this.loadingPortal.set(false); },
    });
  }
}
