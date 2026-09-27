/**
 * One-off CLI utility to grant admin access to an existing user by email.
 * Necessary because the Admin Panel itself is gated behind `requireAdmin`
 * — there's no way to create the first admin from inside the app.
 *
 * Usage:
 *   node backend/scripts/promoteAdmin.js someone@example.com
 */
'use strict';
require('dotenv').config();
const mongoose  = require('mongoose');
const connectDB = require('../src/config/database');
const User      = require('../src/models/User');

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node backend/scripts/promoteAdmin.js <email>');
    process.exit(1);
  }

  await connectDB();
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { role: 'admin' },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email "${email}"`);
  } else {
    console.log(`${user.email} is now an admin.`);
  }

  await mongoose.disconnect();
  process.exit(user ? 0 : 1);
})();
