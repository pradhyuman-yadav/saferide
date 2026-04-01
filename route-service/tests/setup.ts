/**
 * Vitest global setup — runs before any test file is collected.
 * Sets the env vars that config.ts validates at import time so tests
 * don't crash with "Invalid environment variables" and process.exit(1).
 */

// Minimal fake service-account JSON that satisfies Zod's .min(1) check.
// Firebase Admin is fully mocked in tests so this value is never parsed.
process.env['FIREBASE_SERVICE_ACCOUNT_JSON'] = JSON.stringify({ type: 'service_account' });
process.env['NODE_ENV'] = 'test';
