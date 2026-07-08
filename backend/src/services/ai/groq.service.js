/**
 * Groq AI service.
 * Thin wrapper around Groq's OpenAI-compatible API.
 * All AI prompts flow through here.
 */

const axios = require('axios');
const logger = require('../../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL  = process.env.GROQ_MODEL || 'llama3-8b-8192';
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Send a chat completion request to Groq.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {Promise<string>} raw text content
 */
const chat = async (messages, options = {}) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const payload = {
    model:       options.model       || DEFAULT_MODEL,
    messages,
    max_tokens:  options.maxTokens   || 2048,
    temperature: options.temperature ?? 0.3,
  };

  const response = await axios.post(GROQ_API_URL, payload, {
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return response.data.choices[0].message.content;
};

/**
 * Parse JSON from AI response safely.
 * Strips markdown code fences before parsing.
 * @param {string} rawText
 * @returns {object}
 */
const parseJSON = (rawText) => {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`Groq JSON parse failed. Raw: ${cleaned.slice(0, 200)}`);
    throw new Error('AI returned invalid JSON');
  }
};

module.exports = { chat, parseJSON };
