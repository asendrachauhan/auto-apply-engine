# AutoApply AI — UI Change Changelog

This file is a durable, chronological record of UI-only changes made during the current audit. Keep appending; do not delete historical entries.

## 2026-09-28 — Job Posting Date Visibility, Real-Time Relative Timestamps & 1-Hour Ultra-Fresh Filtering

### Job Alerts & Applications Posting Date Display
- **Card-Level Posting Date**: Added prominent `.meta-tag.date` badge with clock icon on every job alert card in `job-alerts.component.ts` and `.posting-date-badge` on `jobs.component.ts`. Displays relative time (`Posted Just now`, `Posted 1m ago`, `Posted 15m ago`, `Posted 2h ago`, `Posted 1d ago`).
- **Freshness Highlighting**: Jobs posted within the past 24 hours automatically receive `.fresh` styling (emerald green glow with subtle background accent) to immediately draw candidate attention to fresh postings.
- **Detailed Timestamp Tooltip & Modal**: Hovering on any posting date shows the exact localized timestamp (`formatFullDate`: month, day, year, hour, minute). The Alert Detail Panel and Application Detail view feature dedicated header badges displaying both relative and exact timestamps.
- **Ultra-Recent (<60m) Filtering**: Added a `Last 1 Hour (<60m)` recency filter option to both Job Alerts and Jobs filter bars, enabling users to isolate jobs posted minutes before.
- **Recency-First Sorting**: Alerts and applications are sorted by `postedAt` descending so that postings published 1 minute ago are automatically placed at the top of the feed.

## 2026-09-27 — PDF Watermark/Padding, Scraping Platform Ingestion, Breadcrumbs, Notifications & Filters Overhaul

### Resume PDF Download & Margin Normalization
- **Removed Tailored Banner**: Completely removed `.tailored` banner (`Tailored for: ... ATS optimised to match job requirements`) from downloaded PDFs to prevent candidates from submitting internal meta-banners to employers.
- **Margin & Padding Elimination**: Removed double page margins in `pdfGenerator.service.js` by standardizing CSS `@page { size: A4; margin: 0; }` and zeroing body padding, relying on Puppeteer's native 12mm / 14mm margins for clean ATS-compliant full-width layout.

### Multi-Platform Filtering on Job Alerts & Applications
- **Job Alerts Page**: Added interactive Source Platform filter (`Indeed`, `LinkedIn`, `Naukri`, `Adzuna`, `Himalayas`, `Remotive`, `Other`) and Date Recency filter (`Last 24 Hours`, `Last 3 Days`, `Last 7 Days`, `Last 14 Days`, `Last 30 Days`), along with real-time match counter (`Showing X of Y`) and a one-click Reset Filters action.
- **Applications Page**: Added Source Platform filter, Date Recency filter, status filter, and live client-side search alongside a filter reset button and match counter with responsive wrapping for mobile viewports.

### Multi-Board Ingestion & Priority (LinkedIn, Naukri, Indeed)
- **Apify Scraper Normalization**: Fixed `normalizeApifyJob` in `apify.scraper.js` so `sourcePlatform` reflects `'linkedin'`, `'naukri'`, or `'indeed'` rather than generic `'apify'`.
- **Alert Engine Bucket Priority**: Added `getPlatformKey(j)` in `jobAlertEngine.service.js` so LinkedIn, Naukri, and Indeed jobs enter top-priority platform buckets and are never crowded out.
- **Groq Model Resolution**: Updated `GROQ_MODEL=openai/gpt-oss-120b` in `.env` to prevent 404 model not found errors on Groq.

### Breadcrumb Navigation & Admin 404 Bug
- **Contextual Parent Traversal**: Fixed `seg.length > 18 ? 'User Details' : seg` bug in `breadcrumb.component.ts`. Navigating to `/alerts/:id` now outputs `Alert Details`, `/jobs/:id` outputs `Application Details`, and only `/users/:id` outputs `User Details`.
- **Query Parameter Separation**: Separated query params from routes (`[routerLink]="crumb.route" [queryParams]="crumb.queryParams"`) so navigating through `/admin?tab=users` does not URI-encode the query string into a 404 wildcard route. Added fallback route in `app.routes.ts`.

### Ghost Score Tooltip Reasons
- **Transparent Signal Insights**: Updated `ghost-score.component.ts` to explain the verdict based on salary transparency, posting recency (>30-45 days), repetitive vacancies, or verified hiring requirements.

### Push Notifications & Relative Timestamps
- **Header Spacing**: Added 24px margin gap between header and background push notification banner.
- **Sanitized Push Error Handling**: Cleaned error reporting in `push-notification.service.ts` to show clear instructions instead of raw HTTP errors. Generated VAPID keys in `backend/.env`.
- **Dynamic Relative Timestamps**: Rewrote `timeAgo` to show minutes (`Xm ago`) and added a 30s reactive interval ticker for live timestamp updates without page refresh.

## 2026-09-21 — Onboarding Email Verification Gate & ATS Overhaul


### Onboarding Flow & Email Verification Enforced
- **Email Verification Gating Step**: Added mandatory `'verify'` step between Welcome and Resume Upload. Unverified users can no longer access or trigger resume upload, preventing `403 Forbidden` API errors (`Please verify your email address to continue`).
- **Interactive Verification Card**: Glassmorphism badge displaying user's email, "Pending Verification" status pill, "I've Verified My Email — Continue" action (`auth.fetchMe()`), and "Resend Verification Email" action with a 60-second cooldown timer.
- **Tab Focus Auto-Detection**: Added `@HostListener('window:focus')` to automatically detect when a user returns after clicking the verification link in their email client or another browser tab, advancing them to Resume Upload without manual clicking.
- **Dynamic Step Dots**: Step indicator shows 6 steps for unverified candidates (`Welcome` -> `Verify Email` -> `Resume` -> `Preferences` -> `Notifications` -> `All Set`) and 5 steps for already verified candidates (`Welcome` -> `Resume` -> `Preferences` -> `Notifications` -> `All Set`).
- **Dev & Sandbox Link Visibility**: Backend `auth.controller.js` outputs `[Email Verification URL]: ...` directly to logger in development and testing modes for frictionless local verification.
- **Internationalization**: Added complete translation keys across languages (`en.json`, `hi.json`, `es.json`, `de.json`).

### Resume Engine & PDF Generation
- **ATS Semantic Restructure**: Replaced legacy pill-tag skill badges with single-column, standard plain text categorized skill headers (`Skills: ...`, `Core Strengths: ...`, `Languages: ...`) matching top applicant tracking system rubrics (Workday, Taleo, Greenhouse, Lever).
- **Page Overflow & Break Guards**: Added `@page` margins, `page-break-inside: avoid;`, and `break-inside: avoid;` to prevent jobs, achievements, or contact sections from truncating mid-sentence across page splits.
- **Removed Fake Banners**: Eliminated "Tailored for: undefined at Tailored Candidate" from standard resume downloads; only rendered when an explicit job target with title and company is provided.
- **Full Link Detection**: Rendered full URLs in contact header so ATS parsers and automated test suites parse LinkedIn, GitHub, and portfolio links without protocol truncation.
- **Parser & Optimizer Retention**: Expanded resume text parsing window to 20,000 characters and implemented safety merges to guarantee projects, education, and credentials are never dropped. Integrated genuine 5-metric ATS scoring algorithm.

### Navigation, Breadcrumbs & Referral Link
- **Sidebar Desktop Collapse**: Moved sidebar toggle button inside the sidebar logo row; removed the floating `<` topbar button on desktop (`*ngIf="isMobile()"`).
- **Dual Active Nav Fix**: Corrected active route determination so `/referral`, `/notifications`, and `/plans` do not trigger active state on `/settings`.
- **Breadcrumb Translation**: Fixed raw translation key rendering (`NAV.REFERRAL`, `NAV.APPLICATIONS`) by properly feeding route keys through `TranslatePipe`.
- **Referral Code Lazy Generation**: Added automatic referral code creation for existing/legacy users and stripped trailing slashes to eliminate `http://localhost:4200//auth/register?ref=undefined`.
- **Status Badges & HTML Entities**: Integrated internationalized translations for status badges (`JOBS.APPLIED`) and cleaned HTML entities like `&#x2f;` in job cards.

### Smart Auto-Apply Safety & "Uncertain" Gate
- **Legitimacy Gate**: Prevented auto-applying to any job with Ghost Score < 70 or verdict `'uncertain'` / `'ghost'`.
- **Seniority & Skill Mismatch Gate**: Excluded Senior/Lead roles when candidate is Junior/Mid; enforced minimum 2 skill overlaps and 65%+ match score.

### ClickUp-Style Landing Page & SEO
- **Showcase Tabs**: Added interactive product showcase with live ATS resume simulator, 8-signal Ghost Job scanner, autonomous smart application tracker, and EU Blue Card pathways.
- **Platform Matrix**: Showcased all 8 legal job boards (Remotive, Himalayas, Jobicy, Adzuna, Arbeitnow, Indeed RSS, Naukri, Google Jobs).
- **ATS Truth Rubric**: Interactive comparison of genuine ATS formatting vs broken multi-column pill templates.
- **SEO & Social Graph**: Added OpenGraph metadata (`og:title`, `og:image`, `og:description`), Twitter cards, search keywords, and Schema.org JSON-LD to `index.html`.

## 2026-09-17 — Session 46 UI Audit Continuation

### Theme/design-system
- Added semantic CSS custom properties for both dark and light themes: surface hover/subtle states, accent states/rings, dividers, overlays, button shadows, status text/background/glow values.
- Added explicit `color-scheme` handling for dark/light themes.
- Added global reduced-motion behavior and form/button font inheritance.
- Improved mobile section-card sizing and global focus behavior.

### Shared components
- `neo-button.component.ts`: added supported `xs` size because the LinkedIn page already requested `size="xs"`; corrected icon sizing and theme-tokenized button shadows.
- `status-badge.component.ts`: replaced hard-coded status palette with semantic theme tokens.
- `ghost-score.component.ts`: replaced hard-coded verdict palette with semantic theme tokens.
- `sidebar.component.ts`: theme-tokenized success glow/hover colors.
- `app-header.component.ts`: theme-tokenized notification unread background.

### Pages
- **Admin**: compact segmented tabs, hover/focus states, fixed undefined `--neo-raised-sm`, improved search/settings inputs and user-row focus behavior.
- **Plans**: responsive 4/2/1-column pricing grid, restrained hover treatment, reduced excessive border emphasis.
- **Profile / Active Sessions**: improved row spacing, wrapping, hover state, and mobile-safe skeleton.
- **LinkedIn Optimizer**: fixed obsolete `--color-*` namespace, fixed signal template reads (`profileInput()`), added missing responsive/focus/hover polish.
- **Jobs**: fixed narrow-screen grid overflow by allowing the minimum card width to shrink to available width; added filter/close-button focus and hover states.
- **Job Alerts**: fixed narrow-screen grid overflow; added filter/tab/close-button hover and focus states.
- **Notifications**: theme-tokenized referral notification background; added filter/action focus and hover states.
- **Analytics**: added single-column mobile breakpoint for metric/loading grids.
- **Automation**: theme-tokenized status/error colors and added clickable-row hover.
- **Resume**: preserved the intended dashed upload-zone border instead of overriding it with a solid border; theme-tokenized drag-hover background.
- **Referral**: theme-tokenized negative transaction colors.
- **Dashboard**: theme-tokenized automation success glows and toggle inset shadow.
- **Preferences**: added check-chip hover/focus states.
- **EU Careers**: added keyboard focus state to pathway cards.
- **Admin User Detail**: added keyboard focus state to back link.
- Auth/legal/landing/shared styles also received semantic token substitutions where existing hard-coded theme colors were found.

### Verification performed
- `var(--color-...)` references: 0 remaining.
- `--neo-raised-sm` references: 0 remaining.
- Custom theme-variable reference audit: no unresolved theme variables found.
- Button size audit: used sizes are `xs`, `sm`; both are now supported.
- Basic delimiter-balance audit across frontend source: no unbalanced braces/parentheses/brackets reported.
- Targeted TypeScript compiler/parser check: no syntax/parser errors reported in changed target files; dependency-resolution errors remain because dependencies are not installed.
- `npm install --offline` was attempted and failed because required package tarballs are not cached.
- `ng serve`, Angular build, Jest suite, and live browser interaction remain NOT VERIFIED in this environment.

### Important honesty rule
Do not describe this UI work as browser-verified. It is statically audited/fixed from the owner-uploaded GitHub-main snapshot until a runnable dependency environment is available.

---

## 2026-09-20 — Session 47: Live Execution, Full Test Suite 100% Pass, Real Browser Verification & Bug Fixes

### Frontend Bug Fixes & Compiler Corrections
- `src/app/features/linkedin/linkedin.component.ts`:
  - Resolved 26 TypeScript compiler errors preventing production builds:
    - Fixed signal reading in template from property read `profileInput.property` to invocation `profileInput().property`.
    - Added missing `NeoButtonComponent` and `IconComponent` to imports array.
    - Fixed signal `.set()` calls to preserve typed object structure.
  - Resolved mobile horizontal overflow on viewport width <= 390px (iPhone 14 / iPhone SE / Android 360px):
    - Added `flex-wrap: wrap;` to `.d-flex` utility class to allow action button groups to wrap cleanly on compact displays.
    - Added `@media (max-width: 700px)` overrides for `.page-container { padding: 16px 0; }` and `.section-card { padding: 16px; }` to eliminate compound padding overflow.
- `src/app/features/linkedin/linkedin.component.spec.ts`:
  - Refactored test suite to use Jest `jest.spyOn()` / `jest.fn()` instead of Jasmine spies.
  - Added `TranslateModule.forRoot()` to testing module imports.
- `src/app/features/dashboard/dashboard.component.spec.ts`:
  - Added `TranslateModule.forRoot()` to testing module imports.
  - Updated regex expectations for translation keys rendered in test environment.
- `src/app/features/resume/resume.component.spec.ts`:
  - Added `TranslateModule.forRoot()` to testing module imports.
- `src/app/features/landing/landing.component.spec.ts`:
  - Added `TranslateModule.forRoot()` to testing module imports.
  - Converted single element lookups to `findAllByText` to match multiple hero and CTA references cleanly.
- `frontend/setup-jest.ts`:
  - Added `window.matchMedia` mock polyfill for `ThemeService` dark mode auto-detection during Jest runs.

### Backend Bug Fixes & Test Suite Corrections
- `tests/unit/middleware/auth.middleware.test.js`:
  - Fixed relative path import depth (`../../../src/middleware/auth.middleware`).
- `tests/unit/middleware/errorHandler.middleware.test.js`:
  - Removed TypeScript type annotations (`: Request`, `: Response`, `: NextFunction`) from JavaScript test file.
- `tests/setup.js`:
  - Added global Jest mock for `isomorphic-dompurify` to prevent `@exodus/bytes` ESM parsing errors under Node test runner.
- `tests/unit/routes/subscription.checkout.test.js` & `tests/unit/routes/subscription.routes.test.js`:
  - Fixed Jest module caching trap: required mock models and Stripe config inside `buildApp()` after `jest.resetModules()`.
  - Configured mock price environment variables (`STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_ELITE_MONTHLY`).
- `src/services/intelligence/linkedInOptimizer.service.js`:
  - Fixed falsy check bug where empty array `experienceBullets: []` was evaluated as truthy (`![] === false`), allowing empty profiles to bypass validation.
- `src/services/intelligence/resumeOptimizer.service.js` & its test:
  - Adjusted truncation test boundary threshold to reflect expanded system prompt length (1,746 chars template + 5,000 chars user text).
- `src/services/scrapers/serpapi.scraper.js`:
  - Wrapped `SERPAPI_CACHE_TTL_SECONDS` evaluation in a dynamic helper (`getCacheTtlMs()`) so that test environment variable overrides take effect at runtime rather than module load time.

### Real Browser Verification Performed
- **Live Angular Dev Server**: Started and running on port 4200.
- **Real Browser Driver**: Microsoft Edge headless automation via Puppeteer (`scratch/auth_shell_verifier.js` & `scratch/ui_verifier.js`).
- **All 8 Public Routes Verified**: Desktop 1440px and Mobile 390px — 100% clean layouts, zero horizontal overflow, HTTP 200.
- **Route Guard Testing**: All 15 protected routes verified to redirect to `/auth/login` when unauthenticated.
- **Theme Switching**: Tested live DOM `data-theme="dark"` / `data-theme="light"` toggle.
- **All 15 Protected Routes Verified**: Desktop 1440px and Mobile 390px — 100% clean layouts, zero horizontal overflow, sidebars and headers functional.
- **Production Build**: `npx ng build --configuration production` succeeded with exit code 0.
- **Test Suites**:
  - Backend: 32 passed, 32 total / 309 passed, 309 total (100%).
  - Frontend: 14 passed, 14 total / 85 passed, 85 total (100%).

---

## Session 48 (2026-09-20) — AI Model Alignment, Rate Limit Relaxation, UI Overlap & Transparency Fixes, i18n Localization & LinkedIn URL Fetcher

### Root Cause Fixes
1. **Groq Model 404 Resolution**:
   - `backend/.env` updated to `GROQ_MODEL=openai/gpt-oss-120b` (decommissioned `llama-3.3-70b-versatile` / `llama3-8b-8192` replaced).
   - `backend/src/services/ai/groq.service.js` updated default model fallback to `openai/gpt-oss-120b`.
   - Resolves HTTP 404 on job scoring, cover letter generation, and resume parse uploads.
2. **Rate Limit 429 Lockout Relaxation**:
   - `backend/src/utils/constants.js`: Updated `RATE_LIMITS.AUTOMATION` to 10 requests per 15 min window (configurable via `process.env.AUTOMATION_RATE_LIMIT_MAX`).
   - `backend/src/middleware/rateLimit.middleware.js`: Added user-aware key generation (`req.user._id || req.ip`) and standardized `code: 'TOO_MANY_REQUESTS'`.
3. **Password Validation UI Overlap**:
   - `frontend/src/app/shared/components/password-requirements/password-requirements.component.ts`: Added `:host { display: block; }` and replaced negative margin `-8px 0 14px` with positive `margin: 8px 0 12px;`.
4. **Dropdown Transparency & Low Contrast**:
   - `frontend/src/assets/styles/_themes.scss`: Introduced `--glass-overlay-bg: rgba(18,20,32,0.96)` for dark mode and `rgba(255,255,255,0.98)` for light mode.
   - `frontend/src/app/shared/components/language-dropdown/language-dropdown.component.ts`: Applied `--glass-overlay-bg` to `.lang-menu`.
   - `frontend/src/app/shared/components/app-header/app-header.component.ts`: Applied `--glass-overlay-bg` to `.notif-panel` and `.user-menu-panel`.
5. **Sidebar Collapse Main Margin Sync**:
   - `frontend/src/app/core/services/ui.service.ts`: Added `sidebarCollapsed` signal with `localStorage` persistence and toggle methods.
   - `frontend/src/app/shared/components/sidebar/sidebar.component.ts`: Connected collapse state to `ui.sidebarCollapsed`.
   - `frontend/src/app/app-shell.component.ts`: Added `.app-shell.sidebar-collapsed .shell-body { margin-left: 68px; }` with smooth cubic-bezier transition.
6. **Missing Translation Keys & Backend Error Localization**:
   - Added `NAV.LINKEDIN` ("LinkedIn Optimizer" / localized) and full `LINKEDIN` dictionary across all 10 language files (`en`, `es`, `fr`, `de`, `hi`, `zh`, `ja`, `pt`, `ru`, `ar`).
   - `frontend/src/app/core/services/toast.service.ts`: Added automatic localization mapping for English backend messages and translation keys.
7. **LinkedIn Profile URL Auto-Fetch & 1-Click Copy**:
   - `backend/src/services/linkedin/linkedInFetcher.service.js`: Added service to fetch public profile URL HTML and parse via Groq AI into `{ headline, about, experienceBullets, currentRole, industry, targetRoles }`.
   - `backend/src/routes/linkedin.routes.js`: Added `POST /api/linkedin/fetch` and `GET /api/linkedin/from-resume`.
   - `frontend/src/app/features/linkedin/linkedin.component.ts`: Redesigned with URL fetch input, "Auto-fill from Resume", and structured 1-click copy-paste blocks for headline, about, and experience bullets.

