import { describe, it, expect } from 'vitest';
import {
  authRateLimiter,
  createAccountRateLimiter,
  adminRateLimiter,
  readRateLimiter,
  gpsRateLimiter,
} from '../src/rate-limit';

describe('rate limiters', () => {
  it('authRateLimiter is an Express middleware function', () => {
    expect(typeof authRateLimiter).toBe('function');
    expect(authRateLimiter.length).toBe(3); // (req, res, next)
  });

  it('createAccountRateLimiter is an Express middleware function', () => {
    expect(typeof createAccountRateLimiter).toBe('function');
    expect(createAccountRateLimiter.length).toBe(3);
  });

  it('adminRateLimiter is an Express middleware function', () => {
    expect(typeof adminRateLimiter).toBe('function');
    expect(adminRateLimiter.length).toBe(3);
  });

  it('readRateLimiter is an Express middleware function', () => {
    expect(typeof readRateLimiter).toBe('function');
    expect(readRateLimiter.length).toBe(3);
  });

  it('gpsRateLimiter is an Express middleware function', () => {
    expect(typeof gpsRateLimiter).toBe('function');
    expect(gpsRateLimiter.length).toBe(3);
  });
});
