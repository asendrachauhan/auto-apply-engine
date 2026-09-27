import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-terms',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  template: `
    <div class="legal-page">
      <div class="legal-inner">
        <a routerLink="/" class="back-link"><aa-icon name="chevronLeft" [size]="14"/> Back to home</a>

        <div class="draft-banner">
          <aa-icon name="alertTriangle" [size]="18"/>
          <div>
            <strong>Draft — not legal advice.</strong> This page accurately describes
            what the product technically does, but has not been reviewed by an attorney.
            Replace this notice and have counsel review the full text before relying on
            it in production.
          </div>
        </div>

        <h1>Terms of Service</h1>
        <p class="updated">Last updated: [DATE — fill in on publish]</p>

        <section>
          <h2>1. What this service does</h2>
          <p>AutoApply AI parses your résumé, scores and filters job listings for
             legitimacy and fit, and — only for jobs you've enabled automation for and
             within your plan's daily limit — submits applications on your behalf using
             the résumé and cover letter it generates.</p>
        </section>

        <section>
          <h2>2. Job sources and legality</h2>
          <p>We only pull listings from sources that explicitly permit it: Remotive,
             Himalayas, Arbeitnow, and Adzuna. We do not scrape LinkedIn, Naukri, Indeed,
             or any platform whose Terms of Service prohibit automated access. For roles
             on those platforms, we notify you so you can apply manually yourself.</p>
        </section>

        <section>
          <h2>3. Your account</h2>
          <ul>
            <li>You must provide accurate information and are responsible for activity
                under your account.</li>
            <li>You must be legally eligible to work in the jurisdictions you apply to —
                we provide visa-pathway information as a convenience, not immigration advice.</li>
            <li>Accounts may be locked after repeated failed login attempts as a security
                measure.</li>
          </ul>
        </section>

        <section>
          <h2>4. Automation and accuracy</h2>
          <p>Match scores, ghost-job legitimacy scores, and ATS scores are AI-generated
             estimates, not guarantees. Automated applications are submitted using
             AI-generated content (parsed résumé data, tailored cover letters); review
             what's being sent before enabling automation. We are not liable for
             application outcomes, interview results, or employment decisions made by
             third-party employers.</p>
        </section>

        <section>
          <h2>5. Subscriptions and billing</h2>
          <p>Paid plans are billed via Stripe on a recurring basis per the plan you select.
             You can cancel anytime from Billing; you retain access through the end of the
             current billing period. Referral points may be redeemed toward a subscription
             at checkout, subject to your available balance.</p>
        </section>

        <section>
          <h2>6. Acceptable use</h2>
          <p>You may not use this service to submit fraudulent applications, misrepresent
             your qualifications, or attempt to circumvent job sources' own Terms of
             Service. We reserve the right to suspend accounts that misuse the platform.</p>
        </section>

        <section>
          <h2>7. Termination</h2>
          <p>You may delete your account at any time from Settings. We may suspend or
             terminate accounts that violate these terms.</p>
        </section>

        <section>
          <h2>8. Changes to these terms</h2>
          <p>We may update these terms from time to time. Continued use of the service
             after changes take effect constitutes acceptance.</p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>Questions about these terms: [CONTACT EMAIL — fill in on publish]</p>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .legal-page { min-height: 100vh; background: var(--bg); color: var(--text); padding: 40px 24px 80px; }
    .legal-inner { max-width: 720px; margin: 0 auto; }
    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted); text-decoration: none; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
    .back-link:hover { color: var(--text); }
    .draft-banner { display: flex; gap: 12px; align-items: flex-start; background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.35); border-radius: var(--radius); padding: 16px 18px; margin-bottom: 32px; font-size: 13px; line-height: 1.6; color: var(--text); }
    .draft-banner aa-icon { color: var(--warning-text); flex-shrink: 0; margin-top: 2px; }
    h1 { font-family: var(--font-display); font-size: 32px; font-weight: 800; margin: 0 0 6px; }
    .updated { font-size: 12px; color: var(--text-muted); margin: 0 0 32px; }
    h2 { font-size: 17px; font-weight: 800; margin: 28px 0 10px; }
    p, li { font-size: 14px; line-height: 1.7; color: var(--text-muted); }
    ul { padding-left: 20px; margin: 8px 0; }
    li { margin-bottom: 6px; }
  `],
})
export class TermsComponent {}
