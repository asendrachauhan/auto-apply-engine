const Groq   = require('groq-sdk');
const logger = require('../utils/logger');

let _client = null;

const getGroqClient = () => {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      logger.warn('GROQ_API_KEY not set — AI features disabled');
      return null;
    }
    // baseURL override lets this point at any OpenAI-compatible endpoint —
    // useful for swapping providers without code changes.
    const opts = { apiKey: process.env.GROQ_API_KEY };
    if (process.env.GROQ_BASE_URL) opts.baseURL = process.env.GROQ_BASE_URL;
    _client = new Groq(opts);
  }
  return _client;
};

const DEFAULT_MODEL       = process.env.GROQ_MODEL || 'llama3-8b-8192';
const DEFAULT_MAX_TOKENS  = Number(process.env.GROQ_MAX_TOKENS) || 1000;
const DEFAULT_TEMPERATURE = process.env.GROQ_TEMPERATURE !== undefined ? Number(process.env.GROQ_TEMPERATURE) : 0.3;
const DEFAULT_RETRIES     = Number(process.env.GROQ_RETRIES) || 2;

/**
 * Chat completion with retry + timeout.
 * Model, token limit, temperature, and retry count all default to env vars
 * (GROQ_MODEL / GROQ_MAX_TOKENS / GROQ_TEMPERATURE / GROQ_RETRIES) so the
 * AI model can be swapped by editing .env only — no code changes needed.
 */
const chat = async (messages, { maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE, retries = DEFAULT_RETRIES, model = DEFAULT_MODEL } = {}) => {
  const client = getGroqClient();
  if (!client) throw new Error('Groq client not initialized — check GROQ_API_KEY');

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens:  maxTokens,
        temperature,
      });
      return completion.choices[0]?.message?.content || '';
    } catch (err) {
      if (attempt > retries) throw err;
      logger.warn(`Groq attempt ${attempt} failed: ${err.message} — retrying…`);
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
};

/**
 * Parse JSON from Groq response — strips any markdown fences.
 */
const parseJSON = (raw) => {
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`Groq JSON parse error: ${err.message}\nRaw: ${raw.slice(0, 200)}`);
    throw new Error('AI response was not valid JSON');
  }
};

module.exports = { getGroqClient, chat, parseJSON };
