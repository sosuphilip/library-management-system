import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const isTest = env.NODE_ENV === 'test';

/** General API limiter. Disabled in tests so suites aren't throttled. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: isTest ? 10_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' } }
});

/** Stricter limiter for auth endpoints (login, register, token refresh). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please slow down' } }
});
