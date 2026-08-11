import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env (and .env.test when NODE_ENV=test). dotenv doesn't override
// variables already set in the environment, so real env wins.
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  APP_BASE_URL: z.string().url().default('http://localhost:4000'),
  PASSWORD_RESET_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(60),

  MAIL_TRANSPORT: z.enum(['json', 'smtp']).default('json'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('Library <noreply@library.local>'),

  DEFAULT_LOAN_PERIOD_DAYS: z.coerce.number().int().positive().default(14),
  MAX_RENEWALS: z.coerce.number().int().nonnegative().default(2),
  FINE_RATE_PER_DAY: z.coerce.number().nonnegative().default(0.5),
  OVERDUE_FREE_GRACE_DAYS: z.coerce.number().int().nonnegative().default(0),
  MAX_OVERDUE_ITEMS_BEFORE_SUSPEND: z.coerce.number().int().nonnegative().default(2),
  MAX_UNPAID_FINE_BEFORE_SUSPEND: z.coerce.number().nonnegative().default(10),
  SUSPENSION_DAYS: z.coerce.number().int().positive().default(14),
  HOLD_AVAILABLE_GRACE_DAYS: z.coerce.number().int().positive().default(3)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

export type Env = typeof env;
