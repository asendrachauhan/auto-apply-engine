require('dotenv').config();
const axios = require('axios');
const key = process.env.GROQ_API_KEY;

async function test(model, withResponseFormat) {
  console.log(`\nTesting model: ${model} with response_format: ${withResponseFormat}`);
  const payload = {
    model,
    messages: [
      { role: 'system', content: 'You are an AI recruiter. Respond in valid JSON format only.' },
      { role: 'user', content: 'Score this match and return JSON:\n{"matchScore": 85, "shouldApply": true}' }
    ],
    max_tokens: 300,
    temperature: 0.1
  };
  if (withResponseFormat) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    });
    console.log('SUCCESS: Content:', res.data.choices[0].message.content);
    console.log('Headers x-ratelimit-remaining-tokens:', res.headers['x-ratelimit-remaining-tokens']);
  } catch (err) {
    console.error('FAILED:', err.response ? err.response.data : err.message);
  }
}

async function run() {
  await test('openai/gpt-oss-20b', true);
  await test('openai/gpt-oss-20b', false);
  await test('qwen/qwen3.8-27b', true);
  await test('qwen/qwen3.8-27b', false);
}

run();
