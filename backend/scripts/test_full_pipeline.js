'use strict';
require('dotenv').config({ path: 'c:/Users/asend/Downloads/auto-apply-engine-ui-updated/auto-apply-engine/backend/.env' });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = require('../src/models/User');
  const Resume = require('../src/models/Resume');
  const AutomationSession = require('../src/models/AutomationSession');
  const JobApplication = require('../src/models/JobApplication');
  const JobAlert = require('../src/models/JobAlert');
  const { runForUser } = require('../src/services/automation/automationEngine.service');

  const user = await User.findOne({ email: 'asendrachauhan176@gmail.com' });
  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }
  console.log(`User found: ${user.email} (id: ${user._id})`);

  // Ensure automation is active
  user.automationActive = true;
  await user.save();

  const resume = await Resume.findOne({ userId: user._id });
  if (!resume || !resume.parsedData) {
    console.error('Resume not found or not parsed!');
    process.exit(1);
  }
  console.log(`Resume found for ${resume.parsedData.fullName}. Target roles:`, resume.parsedData.targetRoles);

  // Create session
  const session = await AutomationSession.create({
    userId: user._id,
    status: 'running'
  });
  console.log(`Created AutomationSession: ${session._id}`);

  console.log('Starting runForUser...');
  const startTime = Date.now();
  await runForUser(user._id, session._id);
  console.log(`runForUser completed in ${(Date.now() - startTime) / 1000}s`);

  // Inspect session result
  const updatedSession = await AutomationSession.findById(session._id);
  console.log('Session status:', updatedSession.status);
  console.log('Session stats:', updatedSession.stats);
  console.log('Session errorLog:', updatedSession.errorLog);

  // Check applications
  const apps = await JobApplication.find({ userId: user._id }).sort({ appliedAt: -1 }).limit(5);
  console.log(`\n=== Recent Applications (${apps.length}) ===`);
  for (const app of apps) {
    console.log(`\n[Application] ${app.jobTitle} @ ${app.company} (${app.matchScore}%)`);
    console.log(`  Status: ${app.status}`);
    console.log(`  Cover Letter length: ${app.coverLetter?.length || 0} chars`);
    if (app.coverLetter) {
      console.log(`  Cover Letter snippet: "${app.coverLetter.slice(0, 120)}..."`);
    }
  }

  // Check alerts
  const alerts = await JobAlert.find({ userId: user._id }).sort({ createdAt: -1 }).limit(5);
  console.log(`\n=== Recent Job Alerts (${alerts.length}) ===`);
  for (const alert of alerts) {
    console.log(`\n[Alert] ${alert.title} @ ${alert.company} (${alert.matchScore}%)`);
    console.log(`  Status: ${alert.status}`);
    console.log(`  Tailored Resume Summary: "${alert.tailoredResume?.summary?.slice(0, 100)}..."`);
    console.log(`  Prefill fields count: ${alert.prefillFields?.length || 0}`);
    console.log(`  PDF URL: ${alert.tailoredResumePdfUrl || 'N/A'}`);
  }

  await mongoose.disconnect();
  console.log('\nAll done!');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
