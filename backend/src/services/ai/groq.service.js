/**
 * Groq AI service.
 * Thin wrapper around Groq's OpenAI-compatible API.
 * All AI prompts flow through here.
 */

const axios = require('axios');
const logger = require('../../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL  = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const REQUEST_TIMEOUT_MS = 45_000;

// Retry config for 429/5xx — configurable via env so plan tiers with higher
// Groq quotas (or a paid Groq plan) can tune this without a code change.
const MAX_RETRIES        = Number(process.env.GROQ_MAX_RETRIES ?? process.env.GROQ_RETRIES) || 1;
const BASE_RETRY_DELAY_MS = Number(process.env.GROQ_BASE_RETRY_DELAY_MS) || 1200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract a sensible retry delay from a 429 response.
 * Groq (like OpenAI) sends `retry-after` in seconds. Falls back to
 * exponential backoff with jitter when no header is present.
 */
const getRetryDelayMs = (err, attempt) => {
  const retryAfterHeader = err.response?.headers?.['retry-after'];
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds <= 3) return seconds * 1000;
  }
  const exp = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 200;
  return exp + jitter;
};

const isRetryable = (err) => {
  const status = err.response?.status;
  if (status === 429) {
    const retryAfter = Number(err.response?.headers?.['retry-after']);
    // If rate-limited and cooldown is > 3s, fail fast so heuristic fallback handles it
    if (Number.isFinite(retryAfter) && retryAfter > 3) return false;
    return true;
  }
  return status >= 500 && status < 600;
};

/**
 * Send a chat completion request to Groq.
 * Retries on 429 (rate limit) and 5xx with exponential backoff, honoring
 * the `retry-after` header when Groq provides one, instead of failing the
 * job-score/cover-letter call outright on the first rate-limit hit.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {Promise<string>} raw text content
 */
const chat = async (messages, options = {}) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const primaryModel = options.model || DEFAULT_MODEL;
  const secondaryModel = primaryModel.includes('qwen') ? 'openai/gpt-oss-20b' : 'qwen/qwen3.8-27b';

  const payload = {
    model:       primaryModel,
    messages,
    max_tokens:  options.maxTokens   || 2048,
    temperature: options.temperature ?? 0.3,
  };

  if (options.responseFormat || options.json) {
    const hasJson = messages.some(m => /json/i.test(m.content || ''));
    if (!hasJson && messages.length > 0) {
      messages[messages.length - 1].content += '\nReturn response in JSON format.';
    }
    if (!payload.model.includes('compound') && !payload.model.includes('gpt-oss')) {
      payload.response_format = options.responseFormat || { type: 'json_object' };
    }
  }

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(GROQ_API_URL, payload, {
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      });
      return response.data.choices[0].message.content;
    } catch (err) {
      lastErr = err;
      if (err.response?.status === 429) {
        lastErr.statusCode = 429;
        lastErr.isRateLimit = true;
      }
      if (!isRetryable(err) || attempt === MAX_RETRIES) {
        if (err.response?.data) {
          logger.warn(`[Groq ${err.response?.status || 'Error'}]: ${JSON.stringify(err.response.data)}`);
        }
        break;
      }
      const delayMs = getRetryDelayMs(err, attempt);
      logger.warn(`Groq ${err.response?.status || err.message} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delayMs)}ms`);
      await sleep(delayMs);
    }
  }

  // Automatic cross-model failover if primary model hit rate limits
  const allowFailover = options.failover ?? (process.env.NODE_ENV !== 'test');
  if (lastErr?.response?.status === 429 && !options._isFallback && allowFailover) {
    logger.info(`[Groq] Primary model ${primaryModel} rate limited — attempting secondary model ${secondaryModel}`);
    try {
      const fallbackTokens = secondaryModel.includes('gpt-oss') ? Math.max(options.maxTokens || 200, 450) : options.maxTokens;
      return await chat(messages, { ...options, model: secondaryModel, maxTokens: fallbackTokens, _isFallback: true });
    } catch (fallbackErr) {
      logger.warn(`[Groq] Secondary model ${secondaryModel} also hit limit: ${fallbackErr.message}`);
    }
  }

  throw lastErr;
};

/**
 * Parse JSON from AI response safely.
 * Strips think tags, markdown code fences, and extracts JSON objects.
 * @param {string} rawText
 * @returns {object}
 */
const parseJSON = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI returned empty response');
  }

  // Strip reasoning blocks like <think>...</think> or unclosed <think>...
  let cleaned = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // Strip markdown code fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (directErr) {
    // If direct parse fails, isolate the outermost {...} or [...]
    const startObj = cleaned.indexOf('{');
    const endObj = cleaned.lastIndexOf('}');
    if (startObj !== -1 && endObj > startObj) {
      const candidate = cleaned.slice(startObj, endObj + 1)
        .replace(/,\s*([\]}])/g, '$1'); // clean trailing commas
      try {
        return JSON.parse(candidate);
      } catch (_) {}
    }

    const startArr = cleaned.indexOf('[');
    const endArr = cleaned.lastIndexOf(']');
    if (startArr !== -1 && endArr > startArr) {
      const candidate = cleaned.slice(startArr, endArr + 1)
        .replace(/,\s*([\]}])/g, '$1');
      try {
        return JSON.parse(candidate);
      } catch (_) {}
    }

    logger.warn(`Groq JSON parse failed. Raw: ${cleaned.slice(0, 250)}`);
    throw new Error('AI returned invalid JSON');
  }
};

module.exports = { chat, parseJSON };
