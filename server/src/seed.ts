import dotenv from 'dotenv';
import path from 'path';

// Load env vars before anything else
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from './config/db';
import User from './models/User';

/**
 * Bootstraps the first finance_admin user so the app is usable after deploy.
 * Credentials come from env vars (fall back to defaults for a quick start —
 * CHANGE THE PASSWORD after first login):
 *   SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 *
 * Safe to run repeatedly — it skips creation if the email already exists.
 */
const seed = async () => {
  const name = process.env.SEED_ADMIN_NAME || 'Admin';
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@vegam.co').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`ℹ️  User "${email}" already exists — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  await User.create({ name, email, password, role: 'finance_admin', isActive: true });
  console.log(`✅ Created finance_admin: ${email}`);
  console.log('⚠️  Log in and change this password immediately.');

  await mongoose.disconnect();
};

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
