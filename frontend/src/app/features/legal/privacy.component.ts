import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'aa-privacy',
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
            what the product technically does (data collected, third parties used,
            retention, GDPR rights) but has not been reviewed by an attorney. Replace
            this notice and have counsel review the full text before relying on it in
            production.
          </div>
        </div>

        <h1>Privacy Policy</h1>
        <p class="updated">Last updated: [DATE — fill in on publish]</p>

        <section>
          <h2>1. Who we are</h2>
          <p>AutoApply AI ("we," "us") provides an AI-assisted job search and application
             tool. This policy explains what personal data we collect, why, and the
             rights you have over it.</p>
        </section>

        <section>
          <h2>2. Data we collect</h2>
          <ul>
            <li><strong>Account data:</strong> name, email, hashed password (bcrypt, never stored in plain text).</li>
            <li><strong>Resume content:</strong> the text and structured data extracted from any résumé you upload or paste, plus the original file if you upload a PDF/DOC/DOCX (stored via Cloudinary).</li>
            <li><strong>Job search preferences:</strong> target roles, locations, salary expectations, and similar settings you provide.</li>
            <li><strong>Application history:</strong> which jobs our automation applied to on your behalf, match scores, and status.</li>
            <li><strong>Payment data:</strong> we do not store your card details — billing is handled entirely by Stripe, our payment processor.</li>
            <li><strong>Technical data:</strong> IP address and browser user-agent, recorded against security-relevant account events (login, password changes) for account-security purposes.</li>
          </ul>
        </section>

        <section>
          <h2>3. How we use it</h2>
          <p>Your résumé and preference data are sent to Groq (our AI processing provider)
             to parse, score, and tailor your résumé and to generate match explanations
             and cover letters. We do not sell your personal data to third parties or use
             it to train third-party AI models beyond the processing needed to deliver
             the product's own features to you.</p>
        </section>

        <section>
          <h2>4. Third parties we use</h2>
          <p>We share the minimum data necessary with the following processors to operate
             the service:</p>
          <ul>
            <li><strong>MongoDB Atlas</strong> — database hosting</li>
            <li><strong>Groq</strong> — AI resume parsing, job matching, and cover-letter generation</li>
            <li><strong>Cloudinary</strong> — résumé PDF file storage</li>
            <li><strong>Stripe</strong> — payment processing (we never see or store your card number)</li>
            <li><strong>Resend</strong> — transactional email (verification, password reset, application notifications)</li>
            <li><strong>Twilio</strong> — WhatsApp notifications, only if you opt in</li>
            <li><strong>Job data sources</strong> (Remotive, Himalayas, Arbeitnow, Adzuna) — we query these for job listings; we do not send your personal data to them</li>
          </ul>
        </section>

        <section>
          <h2>5. Your rights (GDPR)</h2>
          <p>If you are in the EU/EEA (or another jurisdiction with similar protections),
             you have the right to access, correct, export, and delete your personal data:</p>
          <ul>
            <li><strong>Export:</strong> download a copy of your data anytime from Settings.</li>
            <li><strong>Deletion:</strong> request account deletion from Settings.
                Access is revoked immediately. Your data (résumé, application history,
                account details) is then permanently and irreversibly erased within 30
                days — security-relevant records like login history are anonymized rather
                than deleted outright, as permitted under GDPR Art. 17(3), for account-
                security and fraud-prevention purposes.</li>
            <li><strong>Consent withdrawal:</strong> you may withdraw marketing consent at
                any time without affecting the core service.</li>
          </ul>
        </section>

        <section>
          <h2>6. Data retention</h2>
          <p>We retain account and application data for as long as your account is active.
             Deleted accounts are removed per our deletion process. Security-event logs
             (login history, account changes) are retained separately for account-security
             purposes.</p>
        </section>

        <section>
          <h2>7. Security</h2>
          <p>Passwords are hashed with bcrypt and never stored in plain text. Sessions use
             short-lived access tokens with longer-lived, rotated refresh tokens. We apply
             rate limiting, brute-force lockout, and input sanitization across the platform.</p>
        </section>

        <section>
          <h2>8. Contact</h2>
          <p>Questions about this policy or your data: [CONTACT EMAIL — fill in on publish]</p>
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
export class PrivacyComponent {}
