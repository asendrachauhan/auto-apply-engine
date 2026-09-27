require('dotenv').config();
const axios = require('axios');
const key = process.env.GROQ_API_KEY;

async function test() {
  const payload = {
    model: 'qwen/qwen3.8-27b',
    messages: [
      { role: 'system', content: 'You are an expert resume parser. Respond in valid JSON format only.' },
      { role: 'user', content: 'Parse this resume and return JSON:\nName: Asendra Chauhan\nRole: Full Stack Developer\nSkills: React, Node.js, JavaScript, MongoDB\nExperience: 3 years building web applications.' }
    ],
    max_tokens: 600,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    });
    console.log('Choices:', res.data.choices[0].message.content);
    console.log('Remaining tokens:', res.headers['x-ratelimit-remaining-tokens']);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

test();
