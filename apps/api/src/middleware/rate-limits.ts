import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

const tooMany = (message: string): Partial<Options> => ({
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message } },
});

const emailOf = (req: Request): string =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

const ipOf = (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown');

/** Generic API budget per IP. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: ipOf,
  ...tooMany('Too many requests. Please slow down.'),
});

/** Login: 5 attempts per 15 minutes per IP + email. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `${ipOf(req)}|${emailOf(req)}`,
  skipSuccessfulRequests: true,
  ...tooMany('Too many sign-in attempts. Please wait 15 minutes and try again.'),
});

/** Forgot password: 3 per hour per email. */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => emailOf(req) || ipOf(req),
  ...tooMany('Too many reset requests for this email. Please try again in an hour.'),
});

/** Chat: 20 messages per minute per user. */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user?.id ?? ipOf(req),
  ...tooMany('You are sending messages too quickly. Please wait a moment.'),
});
