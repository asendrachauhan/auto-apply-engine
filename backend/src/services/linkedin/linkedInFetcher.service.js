'use strict';

const axios = require('axios');
const { ApifyClient } = require('apify-client');
const groq = require('../ai/groq.service');
const logger = require('../../utils/logger');

const LINKEDIN_PARSE_PROMPT = `You are an expert LinkedIn profile analyst. 
Analyze the provided public profile text and metadata extracted from LinkedIn, and convert it into a structured candidate profile.

RAW PROFILE DATA:
PROFILE_DATA

Return ONLY valid JSON matching this schema exactly (no markdown, no extra commentary):
{
  "fullName": "Candidate full name if found, else empty string",
  "headline": "Professional headline (up to 120 characters)",
  "about": "Compelling professional summary or about statement based on their profile",
  "experienceBullets": [
    "Key achievement or responsibility 1",
    "Key achievement or responsibility 2",
    "Key achievement or responsibility 3"
  ],
  "currentRole": "Most recent title/role",
  "industry": "Industry or field",
  "targetRoles": ["Target Role 1", "Target Role 2"]
}

Guidelines:
- Ensure experienceBullets has 3 to 6 impactful, action-oriented bullet points reflecting their experience.
- Headline should be crisp, professional, and within 120 characters.
- If certain fields cannot be determined, provide professional sensible inferences based on their available experience.`;

// Headers that mimic a real browser to reduce bot detection
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Attempt to extract a minimal readable name from the LinkedIn username slug.
 * e.g. "john-doe-410344221" → "John Doe"
 */
function deriveName(usernameSlug) {
  return usernameSlug
    .replace(/-\d+$/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Fetch LinkedIn profile via Apify Actor (cookieless proxy pool).
 * Bypasses LinkedIn 999 and bot walls.
 */
async function fetchViaApify(sanitizedUrl) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  try {
    logger.info(`[LinkedInFetcher] Running Apify profile actor for ${sanitizedUrl}...`);
    const client = new ApifyClient({ token });
    const run = await client.actor('harvestapi/linkedin-profile-scraper').call({
      queries: [sanitizedUrl],
      profileScraperMode: 'Profile details no email ($4 per 1k)'
    }, { waitSecs: 35 });

    if (!run || !run.defaultDatasetId) {
      logger.warn('[LinkedInFetcher] Apify run finished without dataset ID');
      return null;
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
    if (items && items.length > 0) {
      logger.info(`[LinkedInFetcher] Apify profile actor succeeded for ${sanitizedUrl}`);
      return items[0];
    }
  } catch (err) {
    logger.warn(`[LinkedInFetcher] Apify profile actor failed: ${err.message}`);
  }
  return null;
}

/**
 * Attempt to fetch the LinkedIn page HTML using several strategies.
 * Returns the HTML string, or null if all strategies fail.
 */
async function attemptFetch(sanitizedUrl) {
  // Strategy 1: Direct page fetch with full browser headers
  try {
    const response = await axios.get(sanitizedUrl, {
      headers: BROWSER_HEADERS,
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    const html = response.data || '';
    // Confirm we got real profile content (not a login redirect)
    if (html.length > 2000 && !html.includes('authwall') && !html.includes('login') && !html.includes('Sign in')) {
      logger.info('[LinkedInFetcher] Strategy 1 (direct) succeeded');
      return html;
    }
    logger.warn('[LinkedInFetcher] Strategy 1 returned login/authwall page');
  } catch (err) {
    logger.warn(`[LinkedInFetcher] Strategy 1 failed: ${err.message}`);
  }

  // Strategy 2: Use LinkedIn's public voyager-style /pulse endpoint sometimes available
  // (returns JSON LD embedded in meta tags for some profiles)
  try {
    const mobileUrl = sanitizedUrl.replace('www.linkedin.com', 'm.linkedin.com');
    const response = await axios.get(mobileUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    const html = response.data || '';
    if (html.length > 2000 && !html.includes('authwall') && !html.includes('Sign in')) {
      logger.info('[LinkedInFetcher] Strategy 2 (mobile UA) succeeded');
      return html;
    }
    logger.warn('[LinkedInFetcher] Strategy 2 returned login/authwall page');
  } catch (err) {
    logger.warn(`[LinkedInFetcher] Strategy 2 failed: ${err.message}`);
  }

  // Strategy 3: Search Engine Bot User-Agent (LinkedIn serves public SSR JSON-LD for search spiders)
  try {
    const response = await axios.get(sanitizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    const html = response.data || '';
    if (html.length > 1500 && (html.includes('application/ld+json') || html.includes('property="og:title"'))) {
      logger.info('[LinkedInFetcher] Strategy 3 (search crawler SSR) succeeded');
      return html;
    }
    logger.warn('[LinkedInFetcher] Strategy 3 returned insufficient content');
  } catch (err) {
    logger.warn(`[LinkedInFetcher] Strategy 3 failed: ${err.message}`);
  }

  return null;
}

/**
 * Extract all useful metadata from HTML content.
 */
function extractMetadata(html) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/i);
  const descMatch = html.match(/name="description"\s+content="([^"]+)"/i)
    || html.match(/property="og:description"\s+content="([^"]+)"/i);
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);

  let jsonLdText = '';
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      jsonLdText = JSON.stringify(ld).slice(0, 2000);
    } catch (_) { /* ignore */ }
  }

  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);

  return [
    titleMatch ? `Title: ${titleMatch[1]}` : '',
    ogTitleMatch ? `OG Title: ${ogTitleMatch[1]}` : '',
    descMatch ? `Description: ${descMatch[1]}` : '',
    jsonLdText ? `Structured Data: ${jsonLdText}` : '',
    `Page Text Snippet: ${textContent}`,
  ].filter(Boolean).join('\n\n');
}

/**
 * Fetch public profile details from a LinkedIn profile URL and structure via Groq AI.
 * Falls back gracefully if LinkedIn blocks the scrape.
 *
 * @param {string} url - LinkedIn profile URL
 * @returns {Promise<object>} Structured profile (may be partial if scraping was blocked)
 */
const fetchLinkedInProfile = async (url) => {
  if (!url || typeof url !== 'string') {
    throw new Error('A valid LinkedIn profile URL is required.');
  }

  const sanitizedUrl = url.trim().split('?')[0].replace(/\/+$/, '');
  const linkedinRegex = /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/([a-zA-Z0-9_\-%]+)/i;
  const match = sanitizedUrl.match(linkedinRegex);

  if (!match) {
    throw new Error('Invalid LinkedIn URL. Please provide a link in the format: https://www.linkedin.com/in/username');
  }

  const usernameSlug = match[1];
  const derivedName = deriveName(usernameSlug);

  logger.info(`[LinkedInFetcher] Fetching public profile for ${sanitizedUrl}`);

  // Strategy 0: Apify managed cookieless scraper with rotating residential proxies
  const apifyData = await fetchViaApify(sanitizedUrl);
  if (apifyData) {
    const fullName = apifyData.name || apifyData.fullName || `${apifyData.firstName || ''} ${apifyData.lastName || ''}`.trim() || derivedName;
    const headline = apifyData.headline || '';
    const about = apifyData.about || apifyData.summary || '';

    // Extract experience bullets from positions
    let bullets = [];
    if (Array.isArray(apifyData.experience) && apifyData.experience.length > 0) {
      bullets = apifyData.experience.slice(0, 5).map(e => {
        const title = e.title || e.position || '';
        const comp = e.companyName || e.company || '';
        const desc = e.description ? `: ${e.description.slice(0, 160)}` : '';
        return title ? `${title} at ${comp}${desc}` : '';
      }).filter(Boolean);
    }

    const rawTargetRoles = [
      headline.split('|')[0]?.trim(),
      headline.split('•')[0]?.trim(),
      apifyData.currentPosition,
    ].filter(t => t && t.length > 2 && t.length < 50);

    let structured = {
      headline,
      about,
      experienceBullets: bullets.length ? bullets : [''],
      currentRole: apifyData.currentPosition || (apifyData.experience?.[0]?.title) || '',
      industry: apifyData.industry || '',
      targetRoles: [...new Set(rawTargetRoles)],
      fullName,
      sourceUrl: sanitizedUrl,
      fetchBlocked: false,
    };

    // If Groq is available, refine bullets & structure for maximum ATS score
    try {
      const summaryText = JSON.stringify({
        fullName,
        headline,
        about: about.slice(0, 600),
        experience: apifyData.experience?.slice(0, 4),
        skills: (apifyData.skills || apifyData.topSkills || []).slice(0, 15),
      });
      const prompt = LINKEDIN_PARSE_PROMPT.replace('PROFILE_DATA', summaryText);
      const aiResponse = await groq.chat([{ role: 'user', content: prompt }], { maxTokens: 1000, temperature: 0.2 });
      const parsed = groq.parseJSON(aiResponse);
      if (parsed) {
        if (parsed.headline) structured.headline = parsed.headline;
        if (parsed.about) structured.about = parsed.about;
        if (Array.isArray(parsed.experienceBullets) && parsed.experienceBullets.length > 0) {
          structured.experienceBullets = parsed.experienceBullets;
        }
        if (parsed.currentRole) structured.currentRole = parsed.currentRole;
        if (parsed.industry) structured.industry = parsed.industry;
        if (Array.isArray(parsed.targetRoles) && parsed.targetRoles.length > 0) {
          structured.targetRoles = parsed.targetRoles;
        }
      }
    } catch (e) {
      logger.info(`[LinkedInFetcher] Groq refine skipped, using direct profile fields: ${e.message}`);
    }

    return structured;
  }

  // --- Fallback to direct HTTP scraping ---
  const html = await attemptFetch(sanitizedUrl);

  if (!html) {
    // Graceful degradation: LinkedIn is blocking us.
    // Return a skeleton profile so the user can fill in details rather than seeing a hard error.
    logger.warn('[LinkedInFetcher] All fetch strategies blocked by LinkedIn. Returning skeleton profile.');
    return {
      headline: '',
      about: '',
      experienceBullets: [''],
      currentRole: '',
      industry: '',
      targetRoles: [],
      fullName: derivedName,
      sourceUrl: sanitizedUrl,
      fetchBlocked: true,
      fetchBlockedMessage: `LinkedIn is blocking automated access to this profile. We've pre-filled your name from the URL. Please fill in your details manually below, or use "Auto-fill from Resume" instead.`,
    };
  }

  const rawData = extractMetadata(html);

  if (rawData.length < 50) {
    logger.warn('[LinkedInFetcher] Insufficient data extracted from page. Returning skeleton profile.');
    return {
      headline: '',
      about: '',
      experienceBullets: [''],
      currentRole: '',
      industry: '',
      targetRoles: [],
      fullName: derivedName,
      sourceUrl: sanitizedUrl,
      fetchBlocked: true,
      fetchBlockedMessage: `Could not extract enough information from this LinkedIn profile. Please fill in your details manually below, or use "Auto-fill from Resume" instead.`,
    };
  }

  logger.info(`[LinkedInFetcher] Sending extracted data (${rawData.length} chars) to Groq AI for structuring...`);

  const prompt = LINKEDIN_PARSE_PROMPT.replace('PROFILE_DATA', rawData);
  let parsed = {};
  try {
    const aiResponse = await groq.chat([
      { role: 'user', content: prompt }
    ], { maxTokens: 1000, temperature: 0.2 });
    parsed = groq.parseJSON(aiResponse) || {};
  } catch (aiErr) {
    logger.warn(`[LinkedInFetcher] AI parse unavailable (${aiErr.message}), structuring from extracted text`);
    parsed = {
      headline: `${derivedName} | Professional Profile`,
      about: rawData.slice(0, 400).replace(/\s+/g, ' ').trim(),
      experienceBullets: [],
      fullName: derivedName,
    };
  }

  return {
    headline: parsed.headline || '',
    about: parsed.about || '',
    experienceBullets: Array.isArray(parsed.experienceBullets) ? parsed.experienceBullets : [''],
    currentRole: parsed.currentRole || '',
    industry: parsed.industry || '',
    targetRoles: Array.isArray(parsed.targetRoles) ? parsed.targetRoles : [],
    fullName: parsed.fullName || derivedName || '',
    sourceUrl: sanitizedUrl,
    fetchBlocked: false,
  };
};

module.exports = { fetchLinkedInProfile };
