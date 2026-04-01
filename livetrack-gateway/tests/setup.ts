/**
 * Vitest global setup — sets env vars before config.ts runs at import time.
 */
process.env['FIREBASE_SERVICE_ACCOUNT_JSON'] = JSON.stringify({ type: 'service_account' });
process.env['NODE_ENV']             = 'test';
process.env['WS_PING_INTERVAL_MS']  = '0';  // disable keepalive ping in tests
process.env['WS_PONG_TIMEOUT_MS']   = '0';
