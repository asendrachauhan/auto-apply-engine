'use strict';
require('dotenv').config({ path: 'c:/Users/asend/Downloads/auto-apply-engine-ui-updated/auto-apply-engine/backend/.env' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function checkEndpoints() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../src/models/User');
  const user = await User.findOne({ email: 'asendrachauhan176@gmail.com' });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const authHeaders = { Authorization: `Bearer ${token}` };
  const BASE = 'http://localhost:3000/api';

  console.log('Testing endpoints with auth token for:', user.email);

  // 1. Check automation status
  const autoRes = await axios.get(`${BASE}/automation/status`, { headers: authHeaders });
  console.log('\n1. /api/automation/status:', autoRes.data.data);

  // 2. Check applications
  const appsRes = await axios.get(`${BASE}/jobs/applications`, { headers: authHeaders });
  const apps = appsRes.data.data || [];
  console.log(`\n2. /api/jobs/applications: Total = ${apps.length}, meta =`, appsRes.data.meta);
  if (apps.length) {
    console.log('Latest app:', {
      jobTitle: apps[0].jobTitle,
      company: apps[0].company,
      matchScore: apps[0].matchScore,
      status: apps[0].status,
      hasCoverLetter: !!apps[0].coverLetter
    });
  }

  // 3. Check alerts
  const alertsRes = await axios.get(`${BASE}/alerts`, { headers: authHeaders });
  const alerts = alertsRes.data.data || [];
  console.log(`\n3. /api/alerts: Total = ${alerts.length}, meta =`, alertsRes.data.meta);
  if (alerts.length) {
    console.log('Latest alert:', {
      title: alerts[0].title,
      company: alerts[0].company,
      matchScore: alerts[0].matchScore,
      status: alerts[0].status,
      hasTailoredResume: !!alerts[0].tailoredResume,
    });
  }

  // 4. Check admin coupons endpoint
  const couponRes = await axios.get(`${BASE}/admin/coupons`, { headers: authHeaders });
  console.log('\n4. /api/admin/coupons:', couponRes.data);

  await mongoose.disconnect();
  console.log('\nAll endpoints verified successfully!');
}

checkEndpoints().catch(err => {
  console.error('Check failed:', err.response ? err.response.data : err.message);
  process.exit(1);
});
