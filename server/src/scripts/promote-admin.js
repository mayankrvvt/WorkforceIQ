import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/user.model.js';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !zodEmailIsValid(email)) {
  console.error('Usage: npm run promote-admin -- existing-account@example.com');
  process.exitCode = 1;
} else {
  try {
    await connectDatabase();
    const user = await User.findOneAndUpdate(
      { email, status: 'active', softDeletedAt: null },
      { $set: { role: 'admin' } },
      { new: true, runValidators: true },
    );

    if (!user) {
      throw new Error('No active account exists for the provided email');
    }

    console.log('Administrator access granted to the existing account.');
  } catch (error) {
    console.error(`Administrator setup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

function zodEmailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
