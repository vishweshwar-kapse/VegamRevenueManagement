/**
 * Seed script — creates the initial admin user
 * Run with: npx ts-node scripts/seed-user.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import User from '../src/models/User';

async function seed() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('✅ Connected to MongoDB');

  const email = 'vishu@vegam.co';

  // Remove existing record if present so script is re-runnable
  await User.deleteOne({ email });

  const user = await User.create({
    name: 'Vishu',
    email,
    password: 'Vegam123',   // will be hashed by the pre-save hook in User model
    role: 'finance_admin',
    isActive: true,
  });

  console.log('✅ User created:');
  console.log('   Name  :', user.name);
  console.log('   Email :', user.email);
  console.log('   Role  :', user.role);
  console.log('   ID    :', user._id);

  await mongoose.disconnect();
  console.log('✅ Done');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
