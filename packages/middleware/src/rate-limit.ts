import rateLimit from 'express-rate-limit';
import type { Options } from 'express-rate-limit';

function makeRateLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message },
    },
  } satisfies Partial<Options>);
}

/** 5 requests per 15 minutes — for auth endpoints */
export const authRateLimiter = makeRateLimiter(
  15 * 60 * 1000,
  5,
  'Too many attempts. Please wait a few minutes before trying again.',
);

/** 3 requests per hour — for account creation */
export const createAccountRateLimiter = makeRateLimiter(
  60 * 60 * 1000,
  3,
  'Too many account creation attempts. Please try again later.',
);

/** 300 requests per minute — for admin endpoints */
export const adminRateLimiter = makeRateLimiter(
  60 * 1000,
  300,
  'Too many requests. Please slow down.',
);

/** 120 requests per minute — for standard read endpoints */
export const readRateLimiter = makeRateLimiter(
  60 * 1000,
  120,
  'Too many requests. Please slow down.',
);

/** 60 requests per minute — for GPS telemetry ingest (one ping per second per device) */
export const gpsRateLimiter = makeRateLimiter(
  60 * 1000,
  60,
  'GPS update rate limit exceeded. The app will retry automatically.',
);
