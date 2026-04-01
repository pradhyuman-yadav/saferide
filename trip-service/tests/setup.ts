/**
 * Vitest global setup — runs before any test file is collected.
 * Sets the env vars that config.ts validates at import time so tests
 * don't crash with "Invalid environment variables" and process.exit(1).
 */
process.env['FIREBASE_SERVICE_ACCOUNT_JSON'] = JSON.stringify({ type: 'service_account' });
process.env['FIREBASE_DATABASE_URL'] = 'https://saferide-test.firebaseio.com';
process.env['NODE_ENV'] = 'test';
