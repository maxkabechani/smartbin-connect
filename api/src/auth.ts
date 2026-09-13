import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from './db/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: process.env.AUTH_URL ?? 'http://localhost:8000',
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? 'http://localhost:8000').split(','),
  emailAndPassword: { enabled: true },
  advanced: { database: { joins: true } }
});
