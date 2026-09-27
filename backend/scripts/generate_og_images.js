/**
 * Render Ultra-Premium Open Graph & Social Share PNG Images
 * Generates:
 *   1. og-image.png (1200x630) — Standard Open Graph Banner for Facebook, LinkedIn, Twitter/X, WhatsApp Desktop
 *   2. og-square.png (500x500) — Square Logo Preview for WhatsApp Mobile, Telegram, Slack, iMessage
 */
'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generateOgImages() {
  console.log('Starting OG Image generation with Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // ─── 1. Generate 1200x630 OG Landscape Banner ──────────────────────────────
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });

  const htmlBanner = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      background-color: #050b20;
      background-image:
        radial-gradient(circle at 50% 35%, rgba(8, 124, 245, 0.28) 0%, rgba(212, 61, 255, 0.12) 35%, transparent 70%),
        radial-gradient(circle at 15% 15%, rgba(34, 230, 242, 0.15) 0%, transparent 45%),
        radial-gradient(circle at 85% 85%, rgba(8, 124, 245, 0.15) 0%, transparent 50%);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      position: relative;
      overflow: hidden;
    }

    /* Ambient decorative grid */
    .grid {
      position: absolute;
      inset: 0;
      background-size: 40px 40px;
      background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
      -webkit-mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
      pointer-events: none;
    }

    /* Outer glow border */
    .card-border {
      position: absolute;
      inset: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      pointer-events: none;
      box-shadow: inset 0 0 30px rgba(34, 230, 242, 0.04);
    }

    .brand-mark {
      width: 130px;
      height: 130px;
      filter: drop-shadow(0 12px 28px rgba(8, 124, 245, 0.45)) drop-shadow(0 0 40px rgba(34, 230, 242, 0.35));
      margin-bottom: 24px;
    }

    .title-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 12px;
    }

    .title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 64px;
      font-weight: 800;
      letter-spacing: -2px;
      color: #ffffff;
      line-height: 1;
    }

    .title span {
      background: linear-gradient(135deg, #22E6F2 0%, #087CF5 50%, #D43DFF 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      padding-left: 2px;
    }

    .tagline {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #94A3B8;
      margin-bottom: 28px;
    }

    .description {
      font-size: 22px;
      font-weight: 500;
      color: #CBD5E1;
      text-align: center;
      max-width: 820px;
      line-height: 1.45;
      margin-bottom: 38px;
    }

    .description strong {
      color: #FFFFFF;
      font-weight: 700;
    }

    .features-row {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    .pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      padding: 10px 20px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      color: #F1F5F9;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .pill.highlight {
      background: linear-gradient(135deg, rgba(34, 230, 242, 0.15), rgba(8, 124, 245, 0.2));
      border-color: rgba(34, 230, 242, 0.35);
      color: #22E6F2;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22E6F2;
      box-shadow: 0 0 8px #22E6F2;
    }
  </style>
</head>
<body>
  <div class="grid"></div>
  <div class="card-border"></div>

  <!-- Central SVG Brand Icon -->
  <svg class="brand-mark" viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cyanBlue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#22E6F2"/>
        <stop offset="48%" stop-color="#087CF5"/>
        <stop offset="100%" stop-color="#3157FF"/>
      </linearGradient>
      <linearGradient id="bluePurple" x1="15%" y1="0%" x2="90%" y2="100%">
        <stop offset="0%" stop-color="#167BFF"/>
        <stop offset="55%" stop-color="#4A3BFF"/>
        <stop offset="100%" stop-color="#D43DFF"/>
      </linearGradient>
      <linearGradient id="orbit" x1="0%" y1="30%" x2="100%" y2="70%">
        <stop offset="0%" stop-color="#17DDF2"/>
        <stop offset="50%" stop-color="#35CFFF"/>
        <stop offset="100%" stop-color="#66F2FF"/>
      </linearGradient>
    </defs>
    <!-- Abstract A Ribbon -->
    <path d="M34 174 L91 58 C101 38 119 28 140 28 H158 C180 28 198 40 207 60 L260 174 H211 L170 88 C166 79 159 74 149 74 H145 C136 74 128 80 124 89 L83 174 Z" fill="url(#cyanBlue)"/>
    <path d="M153 74 C162 74 169 79 174 89 L211 174 H260 L207 60 C198 40 180 28 158 28 H148 Z" fill="url(#bluePurple)" opacity=".95"/>
    <path d="M96 160 L137 86 C142 77 151 73 160 77 L180 116 L151 163 Z" fill="#071433" opacity=".95"/>
    <!-- Orbit Flight Path -->
    <path d="M29 127 C77 166 178 160 226 108 C240 93 245 79 241 67" fill="none" stroke="url(#orbit)" stroke-width="18" stroke-linecap="round"/>
    <!-- Arrowhead -->
    <path d="M230 49 L274 34 L254 75 Z" fill="#21E5F4"/>
    <path d="M230 49 L274 34 L250 57 Z" fill="#0D79FF"/>
  </svg>

  <div class="title-row">
    <div class="title">AutoApply<span> AI</span></div>
  </div>

  <div class="tagline">Apply Smarter. Not More.</div>

  <div class="description">
    Autonomous AI job applications across <strong>LinkedIn</strong>, <strong>Naukri</strong>, and <strong>Indeed</strong> with genuine <strong>ATS resume tailoring</strong> & <strong>Ghost Job fraud detection</strong>.
  </div>

  <div class="features-row">
    <div class="pill highlight"><span class="dot"></span> Autonomous Auto-Apply</div>
    <div class="pill">⚡ Real ATS Resume Scorer</div>
    <div class="pill">🛡️ Ghost Job Detection</div>
    <div class="pill">💼 LinkedIn & Naukri Scrapers</div>
  </div>
</body>
</html>
  `;

  await page.setContent(htmlBanner, { waitUntil: 'networkidle0' });

  const ogBannerPath = path.resolve(__dirname, '../../frontend/src/assets/og-image.png');
  const ogBannerLogosPath = path.resolve(__dirname, '../../frontend/src/assets/logos/og-image.png');
  const ogPreviewPath = path.resolve(__dirname, '../../frontend/src/assets/og-preview.png');

  const bannerPngBuffer = await page.screenshot({ type: 'png', omitBackground: false });
  const bannerJpgBuffer = await page.screenshot({ type: 'jpeg', quality: 90 });

  fs.writeFileSync(ogBannerPath, bannerPngBuffer);
  fs.writeFileSync(ogBannerLogosPath, bannerPngBuffer);
  fs.writeFileSync(ogPreviewPath, bannerPngBuffer);
  fs.writeFileSync(ogBannerPath.replace(/\.png$/, '.jpg'), bannerJpgBuffer);
  console.log(`Generated: ${ogBannerPath} (${(bannerPngBuffer.length / 1024).toFixed(1)} KB PNG, ${(bannerJpgBuffer.length / 1024).toFixed(1)} KB JPG)`);

  // ─── 2. Generate 500x500 Square Logo for WhatsApp Mobile / Telegram ────────
  await page.setViewport({ width: 500, height: 500, deviceScaleFactor: 1 });

  const htmlSquare = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 500px;
      height: 500px;
      background-color: #050b20;
      background-image:
        radial-gradient(circle at 50% 45%, rgba(8, 124, 245, 0.32) 0%, rgba(212, 61, 255, 0.15) 45%, transparent 75%),
        radial-gradient(circle at 20% 20%, rgba(34, 230, 242, 0.2) 0%, transparent 50%);
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      padding: 32px;
    }

    .brand-mark {
      width: 220px;
      height: 180px;
      filter: drop-shadow(0 14px 30px rgba(8, 124, 245, 0.5)) drop-shadow(0 0 35px rgba(34, 230, 242, 0.4));
      margin-bottom: 24px;
    }

    .title {
      font-size: 46px;
      font-weight: 800;
      letter-spacing: -1.5px;
      color: #ffffff;
      line-height: 1.1;
      margin-bottom: 8px;
    }

    .title span {
      background: linear-gradient(135deg, #22E6F2 0%, #087CF5 50%, #D43DFF 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3.2px;
      color: #94A3B8;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <svg class="brand-mark" viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cyanBlue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#22E6F2"/>
        <stop offset="48%" stop-color="#087CF5"/>
        <stop offset="100%" stop-color="#3157FF"/>
      </linearGradient>
      <linearGradient id="bluePurple" x1="15%" y1="0%" x2="90%" y2="100%">
        <stop offset="0%" stop-color="#167BFF"/>
        <stop offset="55%" stop-color="#4A3BFF"/>
        <stop offset="100%" stop-color="#D43DFF"/>
      </linearGradient>
      <linearGradient id="orbit" x1="0%" y1="30%" x2="100%" y2="70%">
        <stop offset="0%" stop-color="#17DDF2"/>
        <stop offset="50%" stop-color="#35CFFF"/>
        <stop offset="100%" stop-color="#66F2FF"/>
      </linearGradient>
    </defs>
    <path d="M34 174 L91 58 C101 38 119 28 140 28 H158 C180 28 198 40 207 60 L260 174 H211 L170 88 C166 79 159 74 149 74 H145 C136 74 128 80 124 89 L83 174 Z" fill="url(#cyanBlue)"/>
    <path d="M153 74 C162 74 169 79 174 89 L211 174 H260 L207 60 C198 40 180 28 158 28 H148 Z" fill="url(#bluePurple)" opacity=".95"/>
    <path d="M96 160 L137 86 C142 77 151 73 160 77 L180 116 L151 163 Z" fill="#071433" opacity=".95"/>
    <path d="M29 127 C77 166 178 160 226 108 C240 93 245 79 241 67" fill="none" stroke="url(#orbit)" stroke-width="18" stroke-linecap="round"/>
    <path d="M230 49 L274 34 L254 75 Z" fill="#21E5F4"/>
    <path d="M230 49 L274 34 L250 57 Z" fill="#0D79FF"/>
  </svg>

  <div class="title">AutoApply<span> AI</span></div>
  <div class="subtitle">APPLY SMARTER. NOT MORE.</div>
</body>
</html>
  `;

  await page.setContent(htmlSquare, { waitUntil: 'networkidle0' });

  const ogSquarePath = path.resolve(__dirname, '../../frontend/src/assets/og-square.png');
  const ogSquareLogosPath = path.resolve(__dirname, '../../frontend/src/assets/logos/11-social-media-square.png');

  const squarePngBuffer = await page.screenshot({ type: 'png', omitBackground: false });
  const squareJpgBuffer = await page.screenshot({ type: 'jpeg', quality: 90 });

  fs.writeFileSync(ogSquarePath, squarePngBuffer);
  fs.writeFileSync(ogSquareLogosPath, squarePngBuffer);
  fs.writeFileSync(ogSquarePath.replace(/\.png$/, '.jpg'), squareJpgBuffer);
  console.log(`Generated: ${ogSquarePath} (${(squarePngBuffer.length / 1024).toFixed(1)} KB PNG, ${(squareJpgBuffer.length / 1024).toFixed(1)} KB JPG)`);

  await browser.close();
  console.log('All OG images generated successfully!');
}

generateOgImages().catch(err => {
  console.error('Failed to generate OG images:', err);
  process.exit(1);
});
