const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

const targetEmail = process.argv[2] || 'asendrachauhan176@gmail.com';

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const user = await User.findOne({ email: targetEmail.toLowerCase().trim() });
  if (!user) {
    console.error(`User with email "${targetEmail}" not found in database.`);
    const anyUsers = await User.find({}).limit(5).select('email role').lean();
    console.log('Existing users in DB:', anyUsers);
    process.exit(1);
  }

  user.role = 'admin';
  await user.save();

  console.log(`SUCCESS: User ${user.email} (ID: ${user._id}) has been promoted to role: "admin"!`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error upgrading user to admin:', err);
  process.exit(1);
});
