import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { NeoButtonComponent } from '../../shared/components/neo-button/neo-button.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { ApiService } from '../../core/services/api.service';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  popular: boolean;
  features: string[];
  cta: string;
}

@Component({
  selector: 'aa-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, IconComponent, NeoButtonComponent, ThemeToggleComponent, BrandLogoComponent],
  template: `
    <div class="landing">
      <!-- ═══ TOP ANNOUNCEMENT BANNER ═══ -->
      <aside class="top-banner" aria-label="Product announcement">
        <div class="banner-inner">
          <span class="banner-tag">NEW</span>
          <span class="banner-text">Next-Gen ATS Engine 2.0 &amp; Ghost Job Shield are live!</span>
          <a routerLink="/auth/register" class="banner-link">Try Free <aa-icon name="chevronRight" [size]="12"/></a>
        </div>
      </aside>

      <!-- ═══ NAVIGATION ═══ -->
      <header class="nav">
        <div class="nav-inner">
          <a class="brand" routerLink="/" aria-label="AutoApply AI Home">
            <aa-brand-logo variant="horizontal" [transparent]="true" [height]="38"/>
          </a>
          <nav class="nav-links" aria-label="Page sections">
            <a href="#features">Features</a>
            <a href="#ats-engine">ATS Engine</a>
            <a href="#platforms">Platforms</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#calculator">ROI Calculator</a>
            <a href="#comparison">Compare</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div class="nav-actions">
            <aa-theme-toggle class="hide-mobile"/>
            <a routerLink="/auth/login" class="nav-login hide-mobile">Sign in</a>
            <aa-button size="sm" [routerLink]="['/auth/register']">
              <span class="hide-mobile">Get Started Free</span>
              <span class="show-mobile">Sign Up</span>
            </aa-button>
          </div>
        </div>
      </header>

      <!-- ═══ HERO SECTION WITH INTERACTIVE ATS SIMULATOR ═══ -->
      <section class="hero">
        <div class="hero-glow hero-glow-1"></div>
        <div class="hero-glow hero-glow-2"></div>
        <div class="hero-inner">
          <div class="hero-header text-center">
            <div class="eyebrow-pill">
              <span class="live-pulse"></span>
              <aa-brand-logo variant="mark" [height]="16" style="margin-right: 4px;"/>
              <span>Autonomous Job Application &amp; Intelligence Platform</span>
            </div>
            <h1 class="hero-title">
              Land Your Next Job 10x Faster.<br/>
              <span class="gradient-text">Real ATS Score. Zero Ghost Jobs. Autopilot.</span>
            </h1>
            <p class="hero-lead">
              AutoApply AI scores your resume against genuine ATS parsing rubrics, audits every job listing for 
              ghost-job fraud across 8 signals, tailors your credentials with quantified impact, and applies autonomously across 
              top platforms — with human-in-the-loop safety.
            </p>
            <div class="hero-actions">
              <aa-button size="lg" [routerLink]="['/auth/register']" icon="zap">
                Start Free — No Credit Card Required
              </aa-button>
              <a class="secondary-btn" href="#interactive-preview">
                <aa-icon name="checkCircle" [size]="16"/> Explore Interactive Demo
              </a>
            </div>
            <div class="hero-badges">
              <span><aa-icon name="shield" [size]="14"/> 100% GDPR &amp; Portals Compliant</span>
              <span><aa-icon name="checkCircle" [size]="14"/> Verified Real Job Filters</span>
              <span><aa-icon name="sparkles" [size]="14"/> Real 0–100 ATS Scoring</span>
              <span><aa-icon name="users" [size]="14"/> Safe Human-in-the-Loop Apply</span>
            </div>
          </div>

          <!-- ═══ HERO INTERACTIVE WIDGET: LIVE ATS SCORE SIMULATOR ═══ -->
          <div class="hero-simulator-container">
            <div class="simulator-card neo">
              <div class="simulator-header">
                <div class="sim-title-group">
                  <span class="sim-badge">LIVE SIMULATOR</span>
                  <h3>Interactive ATS Resume Health Engine</h3>
                </div>
                <span class="sim-hint">Toggle ATS optimizations below to see real score impact</span>
              </div>

              <div class="simulator-body">
                <!-- Dial & Score Visual -->
                <div class="score-dial-panel">
                  <div class="dial-wrapper">
                    <svg class="dial-svg" viewBox="0 0 160 160">
                      <circle class="dial-bg" cx="80" cy="80" r="68"/>
                      <circle class="dial-fill" cx="80" cy="80" r="68"
                        [style.strokeDashoffset]="427 - (427 * simulatedAtsScore()) / 100"/>
                    </svg>
                    <div class="dial-content">
                      <span class="dial-number">{{ simulatedAtsScore() }}</span>
                      <span class="dial-label">/ 100 ATS</span>
                    </div>
                  </div>
                  <div class="score-status-badge" [class.high]="simulatedAtsScore() >= 85" [class.mid]="simulatedAtsScore() < 85 && simulatedAtsScore() >= 70">
                    {{ simulatedAtsScore() >= 90 ? '★ Elite ATS Ready' : (simulatedAtsScore() >= 80 ? '✓ Recruiter Verified' : '⚠ ATS Review Needed') }}
                  </div>
                  <p class="dial-subtext">Passes Workday, Taleo, Greenhouse &amp; Lever</p>
                </div>

                <!-- Interactive Checklist Toggles -->
                <div class="toggles-panel">
                  <div class="toggle-item" [class.active]="atsToggles().verbsAndMetrics" (click)="toggleAtsOption('verbsAndMetrics')">
                    <div class="toggle-checkbox">
                      <aa-icon [name]="atsToggles().verbsAndMetrics ? 'check' : 'plus'" [size]="14"/>
                    </div>
                    <div class="toggle-info">
                      <strong>Quantified Action Verbs (+18 pts)</strong>
                      <span>Replaces passive phrasing with metric impact (e.g., "Led team", "Scaled 35%")</span>
                    </div>
                  </div>

                  <div class="toggle-item" [class.active]="atsToggles().singleColumn" (click)="toggleAtsOption('singleColumn')">
                    <div class="toggle-checkbox">
                      <aa-icon [name]="atsToggles().singleColumn ? 'check' : 'plus'" [size]="14"/>
                    </div>
                    <div class="toggle-info">
                      <strong>Single-Column Semantic Layout (+12 pts)</strong>
                      <span>Eliminates broken two-column tables &amp; CSS pills that confuse parsers</span>
                    </div>
                  </div>

                  <div class="toggle-item" [class.active]="atsToggles().skillsDensity" (click)="toggleAtsOption('skillsDensity')">
                    <div class="toggle-checkbox">
                      <aa-icon [name]="atsToggles().skillsDensity ? 'check' : 'plus'" [size]="14"/>
                    </div>
                    <div class="toggle-info">
                      <strong>Hard Skill Categorization (+10 pts)</strong>
                      <span>Structures skills into Technical, Tools, and Frameworks for algorithmic parsing</span>
                    </div>
                  </div>

                  <div class="toggle-item" [class.active]="atsToggles().ghostAudit" (click)="toggleAtsOption('ghostAudit')">
                    <div class="toggle-checkbox">
                      <aa-icon [name]="atsToggles().ghostAudit ? 'check' : 'plus'" [size]="14"/>
                    </div>
                    <div class="toggle-info">
                      <strong>8-Signal Anti-Ghost Protection (+4 pts)</strong>
                      <span>Audits application safety against ghost jobs, stale reposts, and fake listings</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ═══ INTERACTIVE PRODUCT SHOWCASE WORKBENCH (CLICKUP STYLE) ═══ -->
          <div class="interactive-showcase" id="interactive-preview">
            <div class="showcase-tabs">
              <button class="tab-btn" [class.active]="activeTab() === 'ats'" (click)="activeTab.set('ats')">
                <aa-icon name="sparkles" [size]="16"/> Real ATS Resume Optimizer
              </button>
              <button class="tab-btn" [class.active]="activeTab() === 'ghost'" (click)="activeTab.set('ghost')">
                <aa-icon name="ghost" [size]="16"/> 8-Signal Ghost Job Shield
              </button>
              <button class="tab-btn" [class.active]="activeTab() === 'auto'" (click)="activeTab.set('auto')">
                <aa-icon name="zap" [size]="16"/> Autonomous Smart Auto-Apply
              </button>
              <button class="tab-btn" [class.active]="activeTab() === 'eu'" (click)="activeTab.set('eu')">
                <aa-icon name="eu" [size]="16"/> Global &amp; EU Career Pathways
              </button>
            </div>

            <div class="showcase-content neo">
              <!-- Tab 1: ATS Resume Optimizer -->
              @if (activeTab() === 'ats') {
                <div class="tab-panel anim-fade-in">
                  <div class="preview-grid">
                    <div class="preview-card">
                      <div class="preview-badge-row">
                        <span class="live-tag">LIVE ATS EVALUATION</span>
                        <span class="score-pill high">94 / 100 Real ATS Score</span>
                      </div>
                      <div class="ats-breakdown">
                        <div class="rubric-bar">
                          <div class="rubric-info"><span>Hard Skills &amp; Categorization</span><strong>38 / 40</strong></div>
                          <div class="bar-track"><div class="bar-fill" style="width: 95%"></div></div>
                        </div>
                        <div class="rubric-bar">
                          <div class="rubric-info"><span>Quantifiable Metric Impact (%, $, scale)</span><strong>23 / 25</strong></div>
                          <div class="bar-track"><div class="bar-fill" style="width: 92%"></div></div>
                        </div>
                        <div class="rubric-bar">
                          <div class="rubric-info"><span>Contact, LinkedIn &amp; Profile Completeness</span><strong>15 / 15</strong></div>
                          <div class="bar-track"><div class="bar-fill" style="width: 100%"></div></div>
                        </div>
                        <div class="rubric-bar">
                          <div class="rubric-info"><span>Clean Single-Column Semantic Hierarchy</span><strong>10 / 10</strong></div>
                          <div class="bar-track"><div class="bar-fill" style="width: 100%"></div></div>
                        </div>
                      </div>
                      <div class="ats-features-list">
                        <div><aa-icon name="checkCircle" [size]="14"/> No broken multi-column tables or CSS colored pills that confuse ATS</div>
                        <div><aa-icon name="checkCircle" [size]="14"/> Action verbs &amp; metric-quantified achievements (Led, Architected, Scaled)</div>
                        <div><aa-icon name="checkCircle" [size]="14"/> Passes Workday, Taleo, Greenhouse, Lever, and Jobscan with 90%+</div>
                      </div>
                    </div>
                    <div class="preview-visual">
                      <div class="resume-sheet">
                        <div class="sheet-header">
                          <div class="sheet-name">ASENDRA CHAUHAN</div>
                          <div class="sheet-title">Lead Full-Stack Engineer | Cloud &amp; AI Architect</div>
                          <div class="sheet-contact">San Francisco, CA • asendra&#64;example.com • linkedin.com/in/asendra • github.com/asendra</div>
                        </div>
                        <div class="sheet-section">
                          <div class="sheet-sec-title">PROFESSIONAL SUMMARY</div>
                          <p class="sheet-text">High-impact Full-Stack Engineer with 5+ years building enterprise SaaS platforms, scaling microservices to 10M+ daily requests, and integrating LLMs and RAG architectures.</p>
                        </div>
                        <div class="sheet-section">
                          <div class="sheet-sec-title">TECHNICAL SKILLS</div>
                          <p class="sheet-text"><strong>Languages:</strong> TypeScript, JavaScript, Python, Go, SQL</p>
                          <p class="sheet-text"><strong>Frontend &amp; Backend:</strong> Angular, React, Node.js, Express, PostgreSQL, MongoDB</p>
                          <p class="sheet-text"><strong>Cloud &amp; DevOps:</strong> AWS, Docker, Kubernetes, CI/CD, Stripe, Redis</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- Tab 2: Ghost Job Shield -->
              @if (activeTab() === 'ghost') {
                <div class="tab-panel anim-fade-in">
                  <div class="preview-grid">
                    <div class="preview-card">
                      <div class="preview-badge-row">
                        <span class="live-tag">8-SIGNAL FRAUD ENGINE</span>
                        <div class="ghost-mode-toggle">
                          <button class="mini-toggle-btn" [class.active]="ghostInspectMode() === 'legit'" (click)="ghostInspectMode.set('legit')">Verified Job</button>
                          <button class="mini-toggle-btn" [class.active]="ghostInspectMode() === 'scam'" (click)="ghostInspectMode.set('scam')">Ghost Scam</button>
                        </div>
                      </div>
                      <h3 class="tab-heading">We Filter Fake Jobs Before You Waste a Single Second</h3>
                      <p class="tab-desc">Over 35% of online job postings are "ghost jobs" posted to harvest resumes, show fake growth, or comply with bureaucratic rules. Our 8-signal AI algorithm detects them immediately.</p>
                      
                      <div class="signals-grid">
                        <div class="signal-item" [class.verified]="ghostInspectMode() === 'legit'" [class.flagged]="ghostInspectMode() === 'scam'">
                          <aa-icon [name]="ghostInspectMode() === 'legit' ? 'check' : 'alertTriangle'" [size]="14"/>
                          Active Recruiter Identity Verified
                        </div>
                        <div class="signal-item" [class.verified]="ghostInspectMode() === 'legit'" [class.flagged]="ghostInspectMode() === 'scam'">
                          <aa-icon [name]="ghostInspectMode() === 'legit' ? 'check' : 'alertTriangle'" [size]="14"/>
                          Transparent Compensation Disclosed
                        </div>
                        <div class="signal-item" [class.verified]="ghostInspectMode() === 'legit'" [class.flagged]="ghostInspectMode() === 'scam'">
                          <aa-icon [name]="ghostInspectMode() === 'legit' ? 'check' : 'alertTriangle'" [size]="14"/>
                          Posted Within Fresh Window (&lt;14 Days)
                        </div>
                        <div class="signal-item" [class.verified]="ghostInspectMode() === 'legit'" [class.flagged]="ghostInspectMode() === 'scam'">
                          <aa-icon [name]="ghostInspectMode() === 'legit' ? 'check' : 'alertTriangle'" [size]="14"/>
                          Concrete Quantifiable Responsibilities
                        </div>
                      </div>
                    </div>
                    <div class="preview-visual">
                      <div class="ghost-compare">
                        @if (ghostInspectMode() === 'legit') {
                          <div class="card-comparison real-card anim-fade-in">
                            <div class="card-status-badge green"><aa-icon name="checkCircle" [size]="13"/> Real Job 94/100</div>
                            <h4>Senior Software Engineer</h4>
                            <div class="co-name">Stripe • Remote (EU / India)</div>
                            <div class="co-meta">Salary: €85,000 - €105,000 • Posted 2d ago</div>
                            <div class="card-verdict">✓ Verified hiring manager • Clear team roadmap • Active interview cycle</div>
                          </div>
                        } @else {
                          <div class="card-comparison fake-card anim-fade-in">
                            <div class="card-status-badge red"><aa-icon name="alertTriangle" [size]="13"/> Ghost Job 21/100</div>
                            <h4>"Rockstar Fullstack Ninja Needed Fast!"</h4>
                            <div class="co-name">Confidential • Location Unspecified</div>
                            <div class="co-meta">Salary: Not disclosed • Reposted for 120+ days</div>
                            <div class="card-verdict red-txt">✗ Vague buzzwords • No real recruiter • Continuous repost loop</div>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- Tab 3: Autonomous Smart Auto-Apply -->
              @if (activeTab() === 'auto') {
                <div class="tab-panel anim-fade-in">
                  <div class="preview-grid">
                    <div class="preview-card">
                      <div class="preview-badge-row">
                        <span class="live-tag">AUTOPILOT WITH SAFETY GATES</span>
                        <span class="score-pill high">Strict Match Protection</span>
                      </div>
                      <h3 class="tab-heading">Never Applies to Mismatched Roles or Uncertain Listings</h3>
                      <p class="tab-desc">Unlike mindless bot extensions that spam companies and get your accounts banned, AutoApply AI uses rigorous multi-dimensional safety gates:</p>
                      <div class="gates-list">
                        <div class="gate-row">
                          <div class="gate-icon"><aa-icon name="shield" [size]="16"/></div>
                          <div><strong>Legitimacy Gate:</strong> Only applies if Ghost Score &ge; 70 (never applies to 'uncertain' jobs).</div>
                        </div>
                        <div class="gate-row">
                          <div class="gate-icon"><aa-icon name="checkCircle" [size]="16"/></div>
                          <div><strong>Seniority &amp; Experience Gate:</strong> Protects you from applying to Senior/Lead roles when junior, or overqualified roles.</div>
                        </div>
                        <div class="gate-row">
                          <div class="gate-icon"><aa-icon name="target" [size]="16"/></div>
                          <div><strong>Skill Overlap Gate:</strong> Requires minimum 2 verified core skill overlaps and 65%+ match score.</div>
                        </div>
                      </div>
                    </div>
                    <div class="preview-visual">
                      <div class="auto-pipeline-card">
                        <div class="pipeline-header">
                          <span>Live Application Engine</span>
                          <span class="active-dot-live">● Active In Background</span>
                        </div>
                        <div class="pipeline-step completed">
                          <span class="p-num">1</span>
                          <div class="p-text"><span>Job Found &amp; Verified:</span> <strong>Full-Stack Angular Engineer at Supabase</strong></div>
                          <span class="p-status">Score: 88%</span>
                        </div>
                        <div class="pipeline-step completed">
                          <span class="p-num">2</span>
                          <div class="p-text"><span>Tailored Resume &amp; Letter Generated:</span> <strong>Single-Column Clean ATS</strong></div>
                          <span class="p-status">Ready</span>
                        </div>
                        <div class="pipeline-step active-step">
                          <span class="p-num">3</span>
                          <div class="p-text"><span>Application Queued with Daily Cap:</span> <strong>Sent to employer portal</strong></div>
                          <span class="p-status in-prog">Logged</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- Tab 4: Global & EU Career Pathways -->
              @if (activeTab() === 'eu') {
                <div class="tab-panel anim-fade-in">
                  <div class="preview-grid">
                    <div class="preview-card">
                      <div class="preview-badge-row">
                        <span class="live-tag">RELOCATION INTELLIGENCE</span>
                        <span class="score-pill eu-pill">India &rarr; Europe Pathway</span>
                      </div>
                      <h3 class="tab-heading">Your Gateway to European &amp; International Tech Hubs</h3>
                      <p class="tab-desc">Everything needed for candidates moving from India to Germany, Netherlands, Ireland, Portugal, and Sweden:</p>
                      <div class="eu-features">
                        <div class="eu-feat-item">
                          <aa-icon name="currency" [size]="16"/>
                          <div><strong>CTC to EUR Salary Converter:</strong> Translates Indian LPA compensation into realistic European gross &amp; net salary expectations.</div>
                        </div>
                        <div class="eu-feat-item">
                          <aa-icon name="mapPin" [size]="16"/>
                          <div><strong>EU Blue Card Visa Checker:</strong> Evaluates your degree, minimum salary thresholds, and sponsorship eligibility by country.</div>
                        </div>
                        <div class="eu-feat-item">
                          <aa-icon name="resume" [size]="16"/>
                          <div><strong>Europass &amp; European Format Guides:</strong> Tailors formatting for European recruiter expectations.</div>
                        </div>
                      </div>
                    </div>
                    <div class="preview-visual">
                      <div class="eu-calculator-preview">
                        <div class="calc-header"><span>Interactive EU Relocation Calculator</span><span>EUR / INR</span></div>
                        <div class="calc-slider-wrap">
                          <div class="calc-label-row">
                            <span>Current Indian CTC:</span>
                            <strong>{{ indianLpa() }} LPA (₹{{ indianLpa() }},00,000)</strong>
                          </div>
                          <input type="range" class="calc-range" min="10" max="60" step="1" [value]="indianLpa()" (input)="onLpaSliderChange($event)" [style.--slider-fill]="(((indianLpa() - 10) / (60 - 10)) * 100) + '%'">
                        </div>
                        <div class="calc-divider"></div>
                        <div class="calc-row highlighted">
                          <span>Recommended EUR Base:</span>
                          <strong>€{{ recommendedEurBase().toLocaleString() }} / yr</strong>
                        </div>
                        <div class="calc-row">
                          <span>EU Blue Card Min Salary:</span>
                          <strong [class.text-success]="isBlueCardEligible()">€45,300 ({{ isBlueCardEligible() ? 'Eligible ✓' : 'Threshold Below' }})</strong>
                        </div>
                        <div class="calc-row">
                          <span>Estimated Net Monthly:</span>
                          <strong>€{{ estimatedNetEurMonthly().toLocaleString() }} / mo</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ SUPPORTED PLATFORMS ═══ -->
      <section class="platforms-section" id="platforms">
        <div class="section-inner text-center">
          <span class="section-eyebrow">ECOSYSTEM COMPATIBILITY</span>
          <h2>Where AutoApply AI Finds &amp; Prepares Applications</h2>
          <p class="section-lead">Autonomous parsing and prefill packages built for the world's most dominant job portals.</p>
          <div class="platforms-grid">
            <div class="platform-card"><div class="plat-icon"><aa-icon name="linkedin" [size]="22"/></div><span>LinkedIn</span><span class="plat-tag">Live / Alerts</span></div>
            <div class="platform-card"><div class="plat-icon"><aa-icon name="briefcase" [size]="22"/></div><span>Indeed</span><span class="plat-tag">Aggregated</span></div>
            <div class="platform-card"><div class="plat-icon"><aa-icon name="target" [size]="22"/></div><span>Naukri</span><span class="plat-tag">India Dedicated</span></div>
            <div class="platform-card"><div class="plat-icon"><aa-icon name="checkCircle" [size]="22"/></div><span>Glassdoor</span><span class="plat-tag">Salaries</span></div>
            <div class="platform-card"><div class="plat-icon"><aa-icon name="zap" [size]="22"/></div><span>Wellfound</span><span class="plat-tag">Startups</span></div>
            <div class="platform-card"><div class="plat-icon"><aa-icon name="mapPin" [size]="22"/></div><span>Remotive</span><span class="plat-tag">Global Remote</span></div>
            <div class="platform-card"><div class="plat-icon"><aa-icon name="sparkles" [size]="22"/></div><span>Himalayas</span><span class="plat-tag">Remote Tech</span></div>
            <div class="platform-card"><div class="plat-icon"><aa-icon name="eu" [size]="22"/></div><span>Arbeitnow</span><span class="plat-tag">EU Visa Sponsored</span></div>
          </div>
        </div>
      </section>

      <!-- ═══ INTERACTIVE ROI & TIME-SAVED CALCULATOR ═══ -->
      <section class="calculator-section" id="calculator">
        <div class="section-inner">
          <div class="text-center">
            <span class="section-eyebrow">QUANTIFIED ROI</span>
            <h2>How Much Time Will AutoApply AI Save You?</h2>
            <p class="section-lead">Adjust the slider below to calculate your time saved, interview boost, and offer timeframe.</p>
          </div>

          <div class="calc-interactive-card neo">
            <div class="calc-slider-box">
              <div class="calc-slider-label">
                <span>Applications You Target Weekly:</span>
                <span class="calc-slider-value">{{ calcAppsPerWeek() }} jobs / week</span>
              </div>
              <input type="range" class="roi-slider" min="10" max="80" step="5" [value]="calcAppsPerWeek()" (input)="onAppsSliderChange($event)" [style.--slider-fill]="(((calcAppsPerWeek() - 10) / (80 - 10)) * 100) + '%'">
              <div class="calc-slider-ticks">
                <span>10 jobs</span>
                <span>40 jobs</span>
                <span>80 jobs</span>
              </div>
            </div>

            <div class="roi-metrics-grid">
              <div class="roi-metric-item">
                <span class="roi-num text-accent">{{ hoursSaved() }} hrs</span>
                <span class="roi-title">Saved Every Week</span>
                <span class="roi-desc">No repetitive form filling or copy-pasting</span>
              </div>
              <div class="roi-metric-item">
                <span class="roi-num text-success">+{{ interviewMultiplier() }}x</span>
                <span class="roi-title">Interview Callback Rate</span>
                <span class="roi-desc">94+ ATS score &amp; tailored action verbs</span>
              </div>
              <div class="roi-metric-item">
                <span class="roi-num text-primary">~{{ daysToOffer() }} Days</span>
                <span class="roi-title">Estimated Time to Offer</span>
                <span class="roi-desc">Vs 90+ days for manual unstructured apply</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ ATS TRUTH & ENGINE BREAKDOWN ═══ -->
      <section class="ats-truth-section" id="ats-engine">
        <div class="section-inner">
          <div class="text-center">
            <span class="section-eyebrow">THE SCIENCE OF HIRING</span>
            <h2>Why 75% of Resumes Fail ATS Scanners (And How We Fix It)</h2>
            <p class="section-lead">Most online resume builders use pretty colored pills, tables, and graphics that ATS parsers completely choke on. Here is what really happens behind the scenes.</p>
          </div>

          <div class="ats-comparison-grid">
            <div class="comparison-box bad-box">
              <div class="box-badge red-badge"><aa-icon name="alertTriangle" [size]="14"/> What Fails ATS Parsers</div>
              <ul>
                <li><strong>Colored CSS pills &amp; badges:</strong> Parsed as isolated tokens, losing category context.</li>
                <li><strong>Two-column tables &amp; sidebars:</strong> Content gets parsed out-of-order, mixing work dates with skill lists.</li>
                <li><strong>Fake score widgets:</strong> Unsubstantiated numbers that don't reflect actual parser requirements.</li>
                <li><strong>Keyword stuffing without metrics:</strong> Discarded by modern LLM-based recruiter filters.</li>
                <li><strong>Header watermarks:</strong> Labels like "Tailored by bot" immediately get flagged.</li>
              </ul>
            </div>
            <div class="comparison-box good-box">
              <div class="box-badge green-badge"><aa-icon name="checkCircle" [size]="14"/> The AutoApply AI Gold Standard</div>
              <ul>
                <li><strong>Clean Single-Column Semantic Text:</strong> 100% linear parseability by Workday, Taleo, Greenhouse, and Lever.</li>
                <li><strong>Explicit Categorized Skills:</strong> Formatted cleanly as <em>Category: Skill1, Skill2, Skill3</em>.</li>
                <li><strong>Quantified Action Verbs:</strong> Every achievement adheres to: <em>[Action Verb] + [Deliverable] + [Measurable Metric]</em>.</li>
                <li><strong>Complete Section Architecture:</strong> Summary, Technical Skills, Experience, Projects, Education, and Contact Links.</li>
                <li><strong>Pristine Candidate Output:</strong> Zero bot watermarks or artificial metadata on your downloaded documents.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ DETAILED FEATURES BENTO GRID ═══ -->
      <section class="features" id="features">
        <div class="section-inner">
          <div class="text-center">
            <span class="section-eyebrow">ALL-IN-ONE CAREER ACCELERATOR</span>
            <h2>Every Feature Built for Production-Grade Results</h2>
            <p class="section-lead">From initial resume audit to final offer tracking, every module works together seamlessly.</p>
          </div>

          <div class="feature-grid">
            <div class="feature-card neo">
              <div class="feature-icon"><aa-icon name="ghost" [size]="24"/></div>
              <h3>Ghost Job &amp; Fraud Detection</h3>
              <p>Scores each listing across 8 signals including company verification, posting age, salary transparency, and stale repost loops. Eliminates scam postings before they reach your inbox.</p>
            </div>
            <div class="feature-card neo">
              <div class="feature-icon"><aa-icon name="sparkles" [size]="24"/></div>
              <h3>Explainable AI Match Scoring</h3>
              <p>Never wonder why you were matched. Receive a transparent 5-dimensional breakdown: Skill Overlap (40%), Experience Level (25%), Domain Alignment (15%), Location Compatibility (10%), and Seniority (10%).</p>
            </div>
            <div class="feature-card neo">
              <div class="feature-icon"><aa-icon name="zap" [size]="24"/></div>
              <h3>Autonomous Apply &amp; Watch Mode</h3>
              <p>Set your daily application cap and career preferences. The engine discovers matching roles 24/7, tailors your credentials, and automatically applies with zero ToS-violating bot scraping.</p>
            </div>
            <div class="feature-card neo">
              <div class="feature-icon"><aa-icon name="linkedin" [size]="24"/></div>
              <h3>LinkedIn Recruiter Optimizer</h3>
              <p>Rewrites your headline, about summary, and experience bullets to match high-frequency recruiter search algorithms, driving organic inbound recruiter outreach.</p>
            </div>
            <div class="feature-card neo">
              <div class="feature-icon"><aa-icon name="document" [size]="24"/></div>
              <h3>Tailored Cover Letter Generator</h3>
              <p>Generates bespoke, company-specific cover letters highlighting quantifiable achievements that directly answer the job listing's primary pain points.</p>
            </div>
            <div class="feature-card neo">
              <div class="feature-icon"><aa-icon name="shield" [size]="24"/></div>
              <h3>GDPR &amp; Portals Compliance</h3>
              <p>Built strictly for compliance. Full data privacy, instant 1-click account erasure, and zero credential storage for third-party platforms.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ COMPARISON TABLE (APPLE STYLE) ═══ -->
      <section class="comparison-section" id="comparison">
        <div class="section-inner">
          <div class="text-center">
            <span class="section-eyebrow">HEAD-TO-HEAD</span>
            <h2>Why Smart Job Seekers Choose AutoApply AI</h2>
            <p class="section-lead">See how our platform compares against manual applying and mindless Chrome extension bots.</p>
          </div>

          <div class="table-wrap neo">
            <table class="compare-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th class="col-highlight">AutoApply AI</th>
                  <th>Spam Chrome Extensions</th>
                  <th>Manual Applying</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Real 0–100 ATS Scoring</td>
                  <td class="col-highlight"><aa-icon name="checkCircle" [size]="16" class="text-success"/> Genuine 5-Factor Rubric</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> None / Fake percentage</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> Guesswork</td>
                </tr>
                <tr>
                  <td>8-Signal Ghost Job Filter</td>
                  <td class="col-highlight"><aa-icon name="checkCircle" [size]="16" class="text-success"/> Filters 35%+ fake postings</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> Blindly spams fake jobs</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> Wastes hours on ghost jobs</td>
                </tr>
                <tr>
                  <td>Account Safety &amp; Compliance</td>
                  <td class="col-highlight"><aa-icon name="checkCircle" [size]="16" class="text-success"/> 100% Compliant &amp; Human-in-Loop</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> Risk of Portal Ban</td>
                  <td><aa-icon name="checkCircle" [size]="16" class="text-success"/> Safe but Exhausting</td>
                </tr>
                <tr>
                  <td>Application Speed</td>
                  <td class="col-highlight"><aa-icon name="checkCircle" [size]="16" class="text-success"/> Up to 200/day on Autopilot</td>
                  <td><aa-icon name="checkCircle" [size]="16" class="text-success"/> Fast (Unchecked)</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> 3–5 applications/day</td>
                </tr>
                <tr>
                  <td>Tailored Resumes per Role</td>
                  <td class="col-highlight"><aa-icon name="checkCircle" [size]="16" class="text-success"/> Automated Impact Verbs</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> Static Generic PDF</td>
                  <td><aa-icon name="close" [size]="16" class="text-danger"/> 45 mins per application</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ═══ PRICING SECTION WITH BILLING TOGGLE ═══ -->
      <section class="pricing" id="pricing">
        <div class="section-inner">
          <div class="text-center">
            <span class="section-eyebrow">TRANSPARENT PRICING</span>
            <h2>Invest in Your Career Acceleration</h2>
            <p class="section-lead">Choose the plan that fits your ambition. Upgrade, downgrade, or cancel anytime.</p>

            <!-- Annual / Monthly Switch -->
            <div class="billing-toggle-container">
              <div class="billing-toggle-pill">
                <button type="button" class="billing-btn" [class.active]="billingCycle() === 'monthly'" (click)="toggleBilling('monthly')">
                  Monthly
                </button>
                <button type="button" class="billing-btn" [class.active]="billingCycle() === 'annual'" (click)="toggleBilling('annual')">
                  Annual <span class="discount-badge">Save 20%</span>
                </button>
              </div>
            </div>
          </div>

          <div class="pricing-grid">
            @for (plan of plans(); track plan.id) {
              <div class="pricing-card neo" [class.popular]="plan.popular">
                @if (plan.popular) {
                  <div class="popular-badge">MOST POPULAR</div>
                }
                <div class="plan-header">
                  <h3 class="plan-name">{{ plan.name }}</h3>
                  <div class="plan-price">
                    <span class="price-val">
                      {{ currencySymbol() }}{{ getDisplayPrice(plan.price) }}
                    </span>
                    <span class="price-period">/ {{ plan.period }}</span>
                  </div>
                  @if (billingCycle() === 'annual' && plan.price > 0) {
                    <span class="annual-savings-text">Billed annually (2 months free)</span>
                  }
                </div>

                <ul class="plan-features">
                  @for (feat of plan.features; track feat) {
                    <li><aa-icon name="check" [size]="14"/> {{ feat }}</li>
                  }
                </ul>

                <div class="plan-cta">
                  <aa-button [variant]="plan.popular ? 'primary' : 'secondary'" [fullWidth]="true" [routerLink]="['/auth/register']">
                    {{ plan.cta }}
                  </aa-button>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ═══ FAQ SECTION ═══ -->
      <section class="faq-section" id="faq">
        <div class="section-inner">
          <div class="text-center">
            <span class="section-eyebrow">FREQUENTLY ASKED QUESTIONS</span>
            <h2>Everything You Need to Know</h2>
            <p class="section-lead">Transparent answers to common questions about our technology and safety.</p>
          </div>

          <div class="faq-list">
            @for (item of faqs; track item.q; let i = $index) {
              <div class="faq-item neo" [class.open]="openFaq() === i" (click)="toggleFaq(i)">
                <div class="faq-q">
                  <span>{{ item.q }}</span>
                  <aa-icon [name]="openFaq() === i ? 'chevronDown' : 'chevronRight'" [size]="18"/>
                </div>
                @if (openFaq() === i) {
                  <div class="faq-a anim-fade-in">
                    <p>{{ item.a }}</p>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ═══ BOTTOM CTA BANNER ═══ -->
      <section class="cta-banner-section">
        <div class="section-inner">
          <div class="cta-banner-box neo">
            <div class="cta-glow"></div>
            <h2>Ready to Land 3x More Interviews?</h2>
            <p>Join thousands of professionals scoring higher on ATS parsers, skipping ghost jobs, and applying on autopilot.</p>
            <div class="cta-actions">
              <aa-button size="lg" [routerLink]="['/auth/register']" icon="zap">
                Get Started Free — Takes 60 Seconds
              </aa-button>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ FOOTER ═══ -->
      <footer class="footer">
        <div class="section-inner footer-inner">
          <div class="footer-left">
            <div class="footer-brand">
              <aa-brand-logo variant="horizontal" [transparent]="true" [height]="32"/>
            </div>
            <p class="footer-tagline">Autonomous job application SaaS engine tailored for Indian and global job seekers across all professions.</p>
          </div>
          <div class="footer-links-group">
            <div class="link-col">
              <strong>Product</strong>
              <a href="#features">Features</a>
              <a href="#ats-engine">ATS Engine</a>
              <a href="#calculator">ROI Calculator</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div class="link-col">
              <strong>Ecosystem</strong>
              <a href="#platforms">Supported Portals</a>
              <a href="#comparison">Compare vs Bots</a>
              <a routerLink="/auth/login">Candidate Login</a>
              <a routerLink="/auth/register">Create Free Account</a>
            </div>
            <div class="link-col">
              <strong>Legal &amp; Trust</strong>
              <a routerLink="/privacy">Privacy Policy</a>
              <a routerLink="/terms">Terms of Service</a>
              <a routerLink="/faq">Knowledge Base</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          © {{ year }} AutoApply AI. All rights reserved. Apply Smarter. Not More.
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .landing { min-height: 100vh; background: transparent; color: var(--text); overflow-x: hidden; }

    /* ── Top Announcement Banner ── */
    .top-banner { background: linear-gradient(90deg, #1e1b4b, #312e81, #1e1b4b); border-bottom: 1px solid rgba(99,102,241,0.25); padding: 8px 16px; font-size: 12.5px; transition: background 0.2s, border-color 0.2s; }
    .banner-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; text-align: center; }
    .banner-tag { background: var(--accent); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; letter-spacing: .5px; }
    .banner-text { color: #e0e7ff; }
    .banner-link { color: #a5b4fc; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: color .15s; }
    .banner-link:hover { color: #fff; }

    /* ── Navigation ── */
    .nav { position: sticky; top: 0; z-index: 100; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); background: var(--glass-bg-strong); border-bottom: 1px solid var(--glass-border); transition: background 0.2s, border-color 0.2s; }
    .nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand { display: flex; align-items: center; text-decoration: none; flex-shrink: 0; }
    .nav-links { display: flex; gap: clamp(8px, 1.3vw, 20px); align-items: center; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 13.5px; font-weight: 500; transition: color .15s ease; white-space: nowrap; }
    .nav-links a:hover { color: var(--text); }
    .nav-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .nav-login { color: var(--text-muted); text-decoration: none; font-size: 13.5px; font-weight: 500; padding: 6px 10px; }
    .nav-login:hover { color: var(--text); }

    /* ── Common Section Structure ── */
    .section-inner { max-width: 1200px; margin: 0 auto; padding: 80px 24px; }
    .section-eyebrow { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
    .section-lead { font-size: 16px; color: var(--text-muted); max-width: 680px; margin: 12px auto 0; line-height: 1.6; }
    .text-center { text-align: center; }

    /* ── Hero Section ── */
    .hero { position: relative; padding: 50px 0 70px; overflow: hidden; }
    .hero-glow { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(110px); z-index: 0; }
    .hero-glow-1 { top: -60px; left: 50%; transform: translateX(-50%); width: 700px; height: 350px; background: radial-gradient(ellipse at center, rgba(34,230,242,0.18), rgba(99,102,241,0.12), transparent); }
    .hero-glow-2 { top: 250px; right: 5%; width: 450px; height: 450px; background: radial-gradient(ellipse at center, rgba(212,61,255,0.08), transparent); }
    .hero-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
    
    .eyebrow-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(34,230,242,0.08); border: 1px solid rgba(34,230,242,0.3); font-size: 12px; font-weight: 600; color: #22e6f2; margin-bottom: 22px; backdrop-filter: blur(8px); }
    .live-pulse { width: 8px; height: 8px; border-radius: 50%; background: #22e6f2; box-shadow: 0 0 10px #22e6f2; animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow { 0% { opacity: 0.4; } 50% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0.4; } }

    .hero-title { font-size: clamp(32px, 5.2vw, 56px); font-weight: 800; line-height: 1.15; margin-bottom: 20px; letter-spacing: -1px; }
    .gradient-text { background: linear-gradient(135deg, #22E6F2 0%, #087CF5 50%, #D43DFF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero-lead { font-size: clamp(15px, 1.8vw, 17.5px); color: var(--text-muted); max-width: 760px; margin: 0 auto 32px; line-height: 1.65; }
    .hero-actions { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-bottom: 28px; }
    .secondary-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 10px; border: 1px solid var(--glass-border); color: var(--text); font-size: 14px; font-weight: 600; text-decoration: none; background: rgba(255,255,255,0.03); backdrop-filter: blur(8px); transition: all .2s; }
    .secondary-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
    .hero-badges { display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-muted); }
    .hero-badges span { display: inline-flex; align-items: center; gap: 6px; }

    /* ── Live ATS Simulator Widget ── */
    .hero-simulator-container { max-width: 860px; margin: 44px auto 0; }
    .simulator-card { padding: 30px; border-radius: 18px; border: 1px solid var(--glass-border-strong); background: rgba(10,16,36,0.78); backdrop-filter: blur(16px); }
    .simulator-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--glass-border); padding-bottom: 16px; margin-bottom: 22px; flex-wrap: wrap; gap: 10px; }
    .sim-title-group { display: flex; align-items: center; gap: 10px; }
    .sim-badge { background: linear-gradient(135deg, #22E6F2, #087CF5); color: #071433; font-size: 9.5px; font-weight: 800; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.8px; }
    .sim-title-group h3 { font-size: 16px; margin: 0; font-weight: 700; color: var(--text); }
    .sim-hint { font-size: 12px; color: var(--text-muted); }

    .simulator-body { display: grid; grid-template-columns: 240px 1fr; gap: 32px; align-items: center; }
    @media (max-width: 768px) { .simulator-body { grid-template-columns: 1fr; } }

    .score-dial-panel { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .dial-wrapper { position: relative; width: 140px; height: 140px; }
    .dial-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .dial-bg { fill: none; stroke: rgba(255,255,255,0.06); stroke-width: 10; }
    .dial-fill { fill: none; stroke: #22E6F2; stroke-width: 10; stroke-linecap: round; stroke-dasharray: 427; transition: stroke-dashoffset 0.6s ease; }
    .dial-content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .dial-number { font-size: 38px; font-weight: 900; line-height: 1; color: var(--text); font-family: var(--font-display); }
    .dial-label { font-size: 10px; color: var(--text-muted); font-weight: 700; margin-top: 4px; text-transform: uppercase; }
    .score-status-badge { margin-top: 14px; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; background: rgba(34,230,242,0.12); color: #22e6f2; border: 1px solid rgba(34,230,242,0.3); }
    .dial-subtext { font-size: 11px; color: var(--text-light); margin-top: 8px; }

    .toggles-panel { display: flex; flex-direction: column; gap: 10px; }
    .toggle-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); cursor: pointer; transition: all .2s; }
    .toggle-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.15); }
    .toggle-item.active { background: rgba(34,230,242,0.06); border-color: rgba(34,230,242,0.35); }
    .toggle-checkbox { width: 20px; height: 20px; border-radius: 5px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); flex-shrink: 0; margin-top: 2px; transition: all .2s; }
    .toggle-item.active .toggle-checkbox { background: var(--accent); color: #fff; border-color: var(--accent); }
    .toggle-info strong { display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .toggle-info span { font-size: 11.5px; color: var(--text-muted); line-height: 1.4; display: block; }

    /* ── ClickUp-Style Feature Tabs ── */
    .interactive-showcase { margin-top: 60px; }
    .showcase-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; margin-bottom: -1px; }
    .tab-btn { background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); color: var(--text-muted); padding: 12px 18px; border-radius: 10px 10px 0 0; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; transition: all .2s; }
    .tab-btn:hover { color: var(--text); background: rgba(255,255,255,0.06); }
    .tab-btn.active { color: var(--text); background: rgba(17,25,54,0.9); border-color: var(--glass-border-strong); border-bottom-color: transparent; }
    .showcase-content { background: rgba(17,25,54,0.9); border: 1px solid var(--glass-border-strong); border-radius: 0 16px 16px 16px; padding: 34px; backdrop-filter: blur(16px); }

    .preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: center; }
    @media (max-width: 900px) { .preview-grid { grid-template-columns: 1fr; } }
    .preview-badge-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .live-tag { font-size: 10px; font-weight: 800; letter-spacing: 1px; color: var(--accent); }
    .score-pill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
    .score-pill.high { background: rgba(74,222,128,0.12); color: #4ade80; border: 1px solid rgba(74,222,128,0.3); }
    .score-pill.eu-pill { background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    
    .ats-breakdown { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
    .rubric-info { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 5px; color: var(--text); }
    .bar-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #22E6F2, #087CF5); border-radius: 3px; }
    .ats-features-list { display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; color: var(--text-muted); }
    .ats-features-list div { display: flex; align-items: center; gap: 8px; }

    .resume-sheet { background: #070d1e; border: 1px solid var(--glass-border); border-radius: 12px; padding: 22px; font-family: 'Segoe UI', Arial, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .sheet-name { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
    .sheet-title { font-size: 12px; font-weight: 600; color: #22E6F2; margin-top: 2px; }
    .sheet-contact { font-size: 10.5px; color: #94A3B8; margin-top: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
    .sheet-sec-title { font-size: 11px; font-weight: 800; color: #E2E8F0; letter-spacing: 0.8px; margin: 12px 0 6px; }
    .sheet-text { font-size: 11px; color: #94A3B8; line-height: 1.5; margin: 0; }

    /* Ghost Tab Toggle */
    .ghost-mode-toggle { display: flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 3px; border-radius: 8px; }
    .mini-toggle-btn { background: transparent; border: none; font-size: 11px; font-weight: 600; color: var(--text-muted); padding: 3px 8px; border-radius: 6px; cursor: pointer; }
    .mini-toggle-btn.active { background: var(--accent); color: #fff; }
    .signals-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; }
    .signal-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); }
    .signal-item.verified { color: #4ade80; border: 1px solid rgba(74,222,128,0.2); }
    .signal-item.flagged { color: #f87171; border: 1px solid rgba(239,68,68,0.25); }

    .card-comparison { border-radius: 12px; padding: 20px; }
    .card-comparison.real-card { background: rgba(34,197,94,0.05); border: 1px solid rgba(74,222,128,0.3); }
    .card-comparison.fake-card { background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.3); }
    .card-status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; margin-bottom: 12px; }
    .card-status-badge.green { background: #166534; color: #bbf7d0; }
    .card-status-badge.red { background: #991b1b; color: #fecaca; }
    .card-comparison h4 { font-size: 15px; margin-bottom: 4px; }
    .co-name { font-size: 12px; color: var(--text); font-weight: 600; }
    .co-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .card-verdict { font-size: 11.5px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); color: #4ade80; }
    .card-verdict.red-txt { color: #f87171; }

    /* Pipeline Step Preview */
    .auto-pipeline-card { background: #070d1e; border: 1px solid var(--glass-border); border-radius: 12px; padding: 20px; }
    .pipeline-header { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    .active-dot-live { color: #22e6f2; }
    .pipeline-step { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; font-size: 12.5px; }
    .pipeline-step.completed { background: rgba(255,255,255,0.02); }
    .pipeline-step.active-step { background: rgba(34,230,242,0.08); border: 1px solid rgba(34,230,242,0.3); }
    .p-num { width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .p-text { flex: 1; }
    .p-text span { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    .p-status { font-size: 11px; font-weight: 700; color: #4ade80; }
    .p-status.in-prog { color: #22e6f2; }

    /* EU Calculator Preview */
    .eu-features { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }
    .eu-feat-item { display: flex; gap: 12px; font-size: 12.5px; line-height: 1.5; }
    .eu-calculator-preview { background: #070d1e; border: 1px solid var(--glass-border); border-radius: 12px; padding: 22px; font-size: 13px; }
    .calc-header { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; }
    .calc-slider-wrap { margin-bottom: 14px; }
    .calc-label-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
    .calc-range { width: 100%; accent-color: var(--accent); cursor: pointer; }
    .calc-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 12px 0; }
    .calc-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12.5px; }
    .calc-row.highlighted { color: #22e6f2; font-size: 14px; font-weight: 700; }

    /* ── Platforms Grid ── */
    .platforms-section { background: rgba(0,0,0,0.25); border-top: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border); padding: 40px 0; }
    .platforms-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 36px; }
    @media (max-width: 860px) { .platforms-grid { grid-template-columns: repeat(2, 1fr); } }
    .platform-card { padding: 18px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 600; font-size: 13.5px; transition: transform .2s ease; }
    .platform-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.15); }
    .plat-icon { color: var(--accent); }
    .plat-tag { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; }

    /* ── ROI Calculator Section ── */
    .calculator-section { padding: 80px 0; }
    .calc-interactive-card { max-width: 860px; margin: 40px auto 0; padding: 36px; border-radius: 20px; background: rgba(17,25,54,0.85); border: 1px solid var(--glass-border-strong); }
    .calc-slider-box { margin-bottom: 36px; }
    .calc-slider-label { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin-bottom: 14px; }
    .calc-slider-value { color: var(--accent); font-size: 18px; }
    .roi-slider { width: 100%; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); outline: none; accent-color: var(--accent); cursor: pointer; }
    .calc-slider-ticks { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px; }
    .roi-metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
    @media (max-width: 700px) { .roi-metrics-grid { grid-template-columns: 1fr; } }
    .roi-metric-item { padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); }
    .roi-num { display: block; font-size: 36px; font-weight: 900; line-height: 1; margin-bottom: 8px; font-family: var(--font-display); }
    .roi-title { font-size: 13px; font-weight: 700; color: var(--text); display: block; }
    .roi-desc { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block; }
    .text-primary { color: #818cf8; }
    .text-success { color: #4ade80; }

    /* ── ATS Truth & Comparison ── */
    .ats-truth-section { padding: 80px 0; background: rgba(0,0,0,0.15); }
    .ats-comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
    @media (max-width: 800px) { .ats-comparison-grid { grid-template-columns: 1fr; } }
    .comparison-box { padding: 28px; border-radius: 16px; border: 1px solid var(--glass-border); }
    .bad-box { background: rgba(239,68,68,0.04); border-color: rgba(239,68,68,0.25); }
    .good-box { background: rgba(34,197,94,0.04); border-color: rgba(74,222,128,0.25); }
    .box-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; margin-bottom: 18px; }
    .red-badge { background: rgba(239,68,68,0.15); color: #f87171; }
    .green-badge { background: rgba(74,222,128,0.15); color: #4ade80; }
    .comparison-box ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
    .comparison-box li { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
    .comparison-box li strong { color: var(--text); }

    /* ── Features Bento Grid ── */
    .features { padding: 80px 0; }
    .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; }
    @media (max-width: 900px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .feature-grid { grid-template-columns: 1fr; } }
    .feature-card { padding: 30px; border-radius: 16px; border: 1px solid var(--glass-border); background: rgba(17,25,54,0.7); backdrop-filter: blur(12px); display: flex; flex-direction: column; gap: 14px; transition: transform .2s ease; }
    .feature-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.2); }
    .feature-icon { width: 44px; height: 44px; border-radius: 10px; background: rgba(34,230,242,0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; }
    .feature-card h3 { font-size: 16px; margin: 0; font-weight: 700; }
    .feature-card p { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0; }

    /* ── Comparison Matrix (Apple Style) ── */
    .comparison-section { padding: 80px 0; background: rgba(0,0,0,0.2); }
    .table-wrap { overflow-x: auto; margin-top: 40px; border-radius: 16px; border: 1px solid var(--glass-border); background: rgba(17,25,54,0.8); }
    .compare-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    .compare-table th, .compare-table td { padding: 18px 22px; border-bottom: 1px solid var(--glass-border); }
    .compare-table th { font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .6px; }
    .compare-table th.col-highlight { color: #22E6F2; font-size: 15px; }
    .compare-table td.col-highlight { background: rgba(34,230,242,0.04); font-weight: 600; color: var(--text); }
    .text-danger { color: #f87171; }

    /* ── Pricing & Billing Toggle ── */
    .pricing { padding: 80px 0; }
    .billing-toggle-container { display: flex; justify-content: center; margin-top: 24px; }
    .billing-toggle-pill { display: inline-flex; align-items: center; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); border-radius: 999px; padding: 4px; gap: 4px; }
    .billing-btn { background: transparent; border: none; font-size: 13px; font-weight: 600; color: var(--text-muted); padding: 8px 18px; border-radius: 999px; cursor: pointer; transition: all .2s; display: inline-flex; align-items: center; gap: 8px; }
    .billing-btn.active { background: var(--accent); color: #fff; }
    .discount-badge { background: #22c55e; color: #052e16; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 999px; }

    .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; }
    @media (max-width: 900px) { .pricing-grid { grid-template-columns: 1fr; max-width: 440px; margin: 40px auto 0; } }
    .pricing-card { position: relative; padding: 36px 30px; border-radius: 18px; border: 1px solid var(--glass-border); background: rgba(17,25,54,0.7); display: flex; flex-direction: column; }
    .pricing-card.popular { border-color: rgba(34,230,242,0.5); background: rgba(17,25,54,0.95); box-shadow: 0 10px 40px rgba(8,124,245,0.18); }
    .popular-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(90deg, #22E6F2, #087CF5); color: #071433; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.8px; }
    .plan-header { margin-bottom: 24px; }
    .plan-name { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
    .plan-price { display: flex; align-items: baseline; gap: 4px; }
    .price-val { font-size: 34px; font-weight: 800; color: var(--text); font-family: var(--font-display); }
    .price-period { font-size: 13px; color: var(--text-muted); }
    .annual-savings-text { display: block; font-size: 11px; color: #4ade80; margin-top: 4px; font-weight: 600; }
    .plan-features { list-style: none; padding: 0; margin: 0 0 32px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
    .plan-features li { font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 10px; }
    .plan-features li aa-icon { color: var(--accent); flex-shrink: 0; }

    /* ── FAQ Section ── */
    .faq-section { padding: 80px 0; background: rgba(0,0,0,0.15); }
    .faq-list { max-width: 800px; margin: 40px auto 0; display: flex; flex-direction: column; gap: 12px; }
    .faq-item { padding: 20px 24px; border-radius: 12px; border: 1px solid var(--glass-border); background: rgba(17,25,54,0.7); cursor: pointer; transition: border-color .15s ease; }
    .faq-item:hover { border-color: rgba(255,255,255,0.2); }
    .faq-q { display: flex; justify-content: space-between; align-items: center; font-size: 14.5px; font-weight: 600; color: var(--text); gap: 16px; }
    .faq-a { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--glass-border); font-size: 13.5px; color: var(--text-muted); line-height: 1.65; }
    .faq-a p { margin: 0; }

    /* ── CTA Banner ── */
    .cta-banner-section { padding: 80px 0; }
    .cta-banner-box { position: relative; overflow: hidden; padding: 60px 40px; border-radius: 24px; text-align: center; border: 1px solid var(--glass-border-strong); background: linear-gradient(135deg, rgba(8,124,245,0.15), rgba(212,61,255,0.1)); }
    .cta-glow { position: absolute; top: -50px; left: 50%; transform: translateX(-50%); width: 400px; height: 200px; background: radial-gradient(ellipse at center, rgba(34,230,242,0.3), transparent); filter: blur(70px); pointer-events: none; }
    .cta-banner-box h2 { font-size: clamp(24px, 4vw, 36px); font-weight: 800; margin-bottom: 12px; }
    .cta-banner-box p { font-size: 15px; color: var(--text-muted); max-width: 600px; margin: 0 auto 28px; line-height: 1.6; }
    .cta-actions { display: flex; justify-content: center; }

    /* ── Footer ── */
    .footer { padding: 60px 0 24px; border-top: 1px solid var(--glass-border); background: var(--bg); }
    .footer-inner { display: grid; grid-template-columns: 1fr 2fr; gap: 40px; margin-bottom: 40px; }
    @media (max-width: 768px) { .footer-inner { grid-template-columns: 1fr; } }
    .footer-left { display: flex; flex-direction: column; gap: 12px; }
    .footer-brand { display: flex; align-items: center; }
    .footer-tagline { font-size: 12.5px; color: var(--text-muted); line-height: 1.6; max-width: 300px; margin: 0; }
    .footer-links-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    @media (max-width: 600px) { .footer-links-group { grid-template-columns: 1fr; } }
    .link-col { display: flex; flex-direction: column; gap: 10px; }
    .link-col strong { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
    .link-col a { color: var(--text-muted); text-decoration: none; font-size: 12.5px; transition: color .15s; }
    .link-col a:hover { color: var(--accent); }
    .footer-bottom { border-top: 1px solid var(--glass-border); padding: 24px 20px; font-size: 12.5px; color: var(--text-light); text-align: center; }

    /* ── Responsive Navigation & Collision Prevention ── */
    @media (max-width: 1160px) {
      .nav-links { gap: 10px; }
      .nav-links a { font-size: 12.5px; }
      .nav-links a:nth-child(3), /* Platforms */
      .nav-links a:nth-child(6)  /* Compare */ { display: none; }
    }
    @media (max-width: 960px) {
      .nav-links a:nth-child(4), /* How It Works */
      .nav-links a:nth-child(5)  /* ROI Calculator */ { display: none; }
    }
    @media (max-width: 860px) {
      .nav-links { display: none; }
      .hide-mobile { display: none !important; }
      .show-mobile { display: inline !important; }
    }
    @media (min-width: 861px) {
      .show-mobile { display: none !important; }
    }

    /* ── Light Mode Semantic Adaptations ── */
    :host-context([data-theme="light"]),
    [data-theme="light"] {
      .top-banner {
        background: linear-gradient(90deg, #eef2ff, #e0e7ff, #eef2ff);
        border-bottom: 1px solid rgba(99,102,241,0.22);
      }
      .banner-text { color: #312e81; font-weight: 500; }
      .banner-link { color: #4338ca; }
      .banner-link:hover { color: #1e1b4b; }
      .hero-glow-1 { opacity: 0.4; }
      .hero-glow-2 { opacity: 0.25; }
      .eyebrow-pill {
        background: rgba(8,124,245,0.08);
        border-color: rgba(8,124,245,0.25);
        color: #087cf5;
      }
      .live-pulse {
        background: #087cf5;
        box-shadow: 0 0 8px #087cf5;
      }
      .simulator-card,
      .showcase-content,
      .feature-card,
      .pricing-card,
      .faq-item,
      .table-wrap,
      .calc-interactive-card {
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 10px 30px rgba(31,38,135,0.07);
        border-color: rgba(99,102,241,0.16);
      }
      .pricing-card.popular {
        background: #ffffff;
        border-color: var(--accent);
        box-shadow: 0 12px 36px rgba(108,99,255,0.16);
      }
      .resume-sheet,
      .auto-pipeline-card,
      .eu-calculator-preview {
        background: #ffffff;
        border-color: rgba(98,108,128,0.2);
        box-shadow: 0 4px 18px rgba(0,0,0,0.06);
      }
      .sheet-name,
      .sheet-sec-title,
      .pipeline-header { color: #0f172a; }
      .sheet-contact,
      .sheet-text { color: #64748b; }
      .tab-btn { background: rgba(35,42,61,0.04); }
      .tab-btn.active {
        background: rgba(255,255,255,0.95);
        border-color: rgba(99,102,241,0.16);
        border-bottom-color: transparent;
      }
      .dial-bg { stroke: rgba(0,0,0,0.07); }
      .toggle-item { background: rgba(35,42,61,0.02); }
      .toggle-item:hover { background: rgba(35,42,61,0.05); }
      .toggle-item.active { background: rgba(8,124,245,0.08); border-color: rgba(8,124,245,0.3); }
      .toggle-checkbox { background: rgba(35,42,61,0.04); }
      .bar-track { background: rgba(0,0,0,0.06); }
      .calc-divider { background: rgba(0,0,0,0.08); }
      .cta-banner-box {
        background: linear-gradient(135deg, rgba(8,124,245,0.08), rgba(212,61,255,0.06));
      }
      .secondary-btn {
        background: rgba(255,255,255,0.7);
        border-color: rgba(98,108,128,0.22);
      }
      .secondary-btn:hover { background: #ffffff; }
      .roi-slider { background: rgba(0,0,0,0.1); }
      .compare-table td.col-highlight { background: rgba(8,124,245,0.05); }
      .platforms-section { background: rgba(241, 245, 249, 0.5); }
      .platform-card { background: #ffffff; border-color: rgba(226, 232, 240, 0.9); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); }
      .platform-card:hover { border-color: rgba(99,102,241,0.4); }
      .plat-tag { background: rgba(15, 23, 42, 0.05); color: #475569; }
      .ats-truth-section { background: rgba(241, 245, 249, 0.6); }
      .comparison-box { background: #ffffff; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); border-color: rgba(226, 232, 240, 0.9); }
      .bad-box { background: #ffffff; border-color: rgba(239,68,68,0.3); box-shadow: 0 4px 20px rgba(239,68,68,0.06); }
      .good-box { background: #ffffff; border-color: rgba(16,185,129,0.35); box-shadow: 0 4px 20px rgba(16,185,129,0.06); }
      .bad-box .box-badge { background: #fee2e2; color: #dc2626; }
      .good-box .box-badge { background: #dcfce7; color: #15803d; }
      .comparison-box li { color: #475569; }
      .comparison-box li strong { color: #0f172a; }
      .comparison-section { background: rgba(241, 245, 249, 0.5); }
      .faq-section { background: transparent; }
      .signal-item { background: #ffffff; }
      .card-comparison.real-card { background: #f0fdf4; border-color: #86efac; }
      .card-comparison.fake-card { background: #fef2f2; border-color: #fca5a5; }
      .card-comparison .co-name { color: #0f172a; }
      .calc-interactive-card { background: #ffffff; border-color: rgba(226, 232, 240, 0.9); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); }
      .roi-metric-item { background: #f8fafc; border-color: rgba(226, 232, 240, 0.8); }
      .billing-toggle-pill { background: rgba(15,23,42,0.06); }
    }
  `]
})
export class LandingComponent implements OnInit {
  year = new Date().getFullYear();
  activeTab = signal<'ats' | 'ghost' | 'auto' | 'eu'>('ats');
  openFaq = signal<number | null>(null);

  // ── Hero ATS Interactive Simulator ──
  atsToggles = signal({
    verbsAndMetrics: true,
    singleColumn: true,
    skillsDensity: false,
    ghostAudit: false,
  });

  simulatedAtsScore = computed(() => {
    let score = 54;
    const t = this.atsToggles();
    if (t.verbsAndMetrics) score += 18;
    if (t.singleColumn) score += 12;
    if (t.skillsDensity) score += 10;
    if (t.ghostAudit) score += 4;
    return score;
  });

  toggleAtsOption(key: 'verbsAndMetrics' | 'singleColumn' | 'skillsDensity' | 'ghostAudit') {
    const cur = this.atsToggles();
    this.atsToggles.set({ ...cur, [key]: !cur[key] });
  }

  // ── Ghost Tab Inspection Toggle ──
  ghostInspectMode = signal<'legit' | 'scam'>('legit');

  // ── EU Relocation Calculator ──
  indianLpa = signal(24);
  recommendedEurBase = computed(() => Math.round(this.indianLpa() * 3100));
  estimatedNetEurMonthly = computed(() => Math.round((this.recommendedEurBase() * 0.58) / 12));
  isBlueCardEligible = computed(() => this.recommendedEurBase() >= 45300);

  onLpaSliderChange(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.indianLpa.set(val);
  }

  // ── ROI / Time Saved Calculator ──
  calcAppsPerWeek = signal(30);
  hoursSaved = computed(() => Math.round(this.calcAppsPerWeek() * 0.75));
  interviewMultiplier = computed(() => (2.2 + (this.calcAppsPerWeek() / 35)).toFixed(1));
  daysToOffer = computed(() => Math.max(14, Math.round(75 - this.calcAppsPerWeek() * 0.7)));

  onAppsSliderChange(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.calcAppsPerWeek.set(val);
  }

  // ── Pricing & Annual Discount Toggle ──
  billingCycle = signal<'monthly' | 'annual'>('monthly');

  toggleBilling(cycle: 'monthly' | 'annual') {
    this.billingCycle.set(cycle);
  }

  getDisplayPrice(baseMonthlyPrice: number): number {
    if (baseMonthlyPrice === 0) return 0;
    if (this.billingCycle() === 'annual') {
      return Math.round(baseMonthlyPrice * 0.8);
    }
    return baseMonthlyPrice;
  }

  toggleFaq(i: number) {
    this.openFaq.set(this.openFaq() === i ? null : i);
  }

  plans = signal<PricingPlan[]>([]);
  currencySymbol = signal('₹');
  loadingPlans = signal(true);

  private staticPlansFallback: PricingPlan[] = [
    {
      id: 'free', name: 'Free', price: 0, period: 'forever', popular: false,
      features: ['3 applications / day', 'Remotive + Himalayas feeds', 'Basic ATS resume scoring', 'Email notifications', 'Ghost job fraud scanner'],
      cta: 'Get Started Free'
    },
    {
      id: 'starter', name: 'Job Hunter', price: 299, period: 'month', popular: false,
      features: ['15 applications / day', '8 platforms aggregated', 'AI resume tailoring per job', 'WhatsApp + Email alerts', 'EU Blue Card checks', '7-day trial'],
      cta: 'Start Free Trial'
    },
    {
      id: 'pro', name: 'Career Pro', price: 699, period: 'month', popular: true,
      features: ['50 applications / day', 'All 8 legal job boards', 'Real-time job detection (2 min)', 'Full ATS resume rewriter', 'WhatsApp priority alerts', '7-day trial'],
      cta: 'Upgrade to Pro'
    },
    {
      id: 'elite', name: 'Executive Autopilot', price: 1499, period: 'month', popular: false,
      features: ['200 applications / day', 'Real-time detection (1 min)', 'Priority apply queue', 'LinkedIn profile rewriter', 'Dedicated support', '7-day trial'],
      cta: 'Go Elite'
    },
  ];

  faqs = [
    {
      q: 'What makes your ATS resume score real compared to generic checkers?',
      a: 'Most online tools check arbitrary keywords or generate colorful pill-tag templates that actual ATS systems (Workday, Taleo, Greenhouse, Lever) choke on. Our ATS engine scores your resume across 5 verifiable criteria: hard skill density, action-verb quantification (%, $, scale metrics), contact completeness, standard section hierarchy, and single-column semantic readability.'
    },
    {
      q: 'Why did the system flag some jobs as "Uncertain"?',
      a: 'The "Uncertain" badge (scores 40–69) indicates our 8-signal anti-fraud engine detected potential red flags — such as an undisclosed salary, vague responsibilities, an unusually stale listing, or unverified recruiter details. Our smart auto-apply safety gate strictly blocks automatic applications to any job under 70 legitimacy score to protect you.'
    },
    {
      q: 'Is this legal and ToS compliant? Does it get accounts banned?',
      a: 'No. We do not use bot-spoofs or third-party credential scraping against authenticated portals. We aggregate jobs through compliant APIs, public RSS feeds, and partnership portals (Remotive, Himalayas, Arbeitnow, Adzuna). For portals requiring direct authentication, we provide 1-click pre-filled packets and real-time WhatsApp alerts for human-in-the-loop application.'
    },
    {
      q: 'How does the auto-apply safety gate prevent bad or mismatched applications?',
      a: 'Our engine applies 3 strict safety gates before queuing any job: (1) Legitimacy Gate (Ghost Score must be >= 70), (2) Seniority Gate (senior/lead roles are excluded if your resume reflects junior/mid experience), and (3) Core Skill Gate (minimum 2 verified skill overlaps and 65%+ match score).'
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes, absolutely. There are no lock-in contracts. You can manage or cancel your subscription anytime directly from your billing settings, retaining access until the end of your billing cycle.'
    },
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getPlansConfig().subscribe({
      next: (r: any) => {
        this.currencySymbol.set(r.data?.currencySymbol || '₹');
        this.plans.set(r.data?.plans?.length ? r.data.plans : this.staticPlansFallback);
        this.loadingPlans.set(false);
      },
      error: () => {
        this.plans.set(this.staticPlansFallback);
        this.loadingPlans.set(false);
      },
    });
  }
}
