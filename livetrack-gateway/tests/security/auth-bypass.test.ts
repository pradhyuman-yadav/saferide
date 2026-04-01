/**
 * Security tests — WebSocket auth bypass
 *
 * Asserts that every connection attempt without a valid token is rejected
 * at the HTTP upgrade level (before the WebSocket handshake completes).
 * The server must respond with HTTP 401 and destroy the socket.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import {
  buildFirebaseMock,
  setTokenValid,
  resetFirebaseMock,
} from '../helpers/firebase-mock';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@saferide/firebase-admin', () => buildFirebaseMock());
vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { httpServer } from '../../src/app';

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let port: number;

beforeAll(async () => {
  resetFirebaseMock();
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  // Force-close any lingering WebSocket connections before closing the server
  httpServer.closeAllConnections?.();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

// ---------------------------------------------------------------------------
// Helper — attempt upgrade, resolve with HTTP status code
// ---------------------------------------------------------------------------

function attemptUpgrade(opts: {
  token?: string;
  queryToken?: string;
} = {}): Promise<number> {
  return new Promise((resolve) => {
    const url = opts.queryToken
      ? `ws://localhost:${port}?token=${opts.queryToken}`
      : `ws://localhost:${port}`;

    const wsOpts = opts.token
      ? { headers: { Authorization: `Bearer ${opts.token}` } }
      : {};

    const ws = new WebSocket(url, wsOpts);
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
    ws.on('error', () => resolve(0));
    ws.on('open', () => { ws.close(); resolve(200); }); // should not happen for rejected connections
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('No token provided', () => {
  it('rejects with 401 when Authorization header is absent', async () => {
    const status = await attemptUpgrade(); // no token
    expect(status).toBe(401);
  });

  it('rejects with 401 when Authorization header is empty', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`, {
      headers: { Authorization: '' },
    });
    const status = await new Promise<number>((resolve) => {
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      ws.on('error', () => resolve(0));
      ws.on('open', () => resolve(200));
    });
    expect(status).toBe(401);
  });
});

describe('Invalid token', () => {
  it('rejects with 401 when the token fails Firebase verification', async () => {
    setTokenValid(false); // firebase mock will throw

    const status = await attemptUpgrade({ token: 'invalid-token' });
    expect(status).toBe(401);

    setTokenValid(true); // restore
  });

  it('rejects with 401 when token is provided via query param but is invalid', async () => {
    setTokenValid(false);

    const status = await attemptUpgrade({ queryToken: 'bad-token' });
    expect(status).toBe(401);

    setTokenValid(true);
  });
});

describe('Valid token — connection succeeds', () => {
  it('accepts a valid token in the Authorization header', async () => {
    const status = await attemptUpgrade({ token: 'valid-token' });
    expect(status).toBe(200); // upgrade succeeded (ws opened)
  });

  it('accepts a valid token in the ?token= query param', async () => {
    const status = await attemptUpgrade({ queryToken: 'valid-token' });
    expect(status).toBe(200);
  });
});
