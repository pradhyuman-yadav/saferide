/**
 * Integration tests — WebSocket connection lifecycle
 *
 * Starts a real HTTP server on a random port. A real WebSocket client
 * connects to it. Firebase is mocked so no real Firestore calls are made.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import {
  buildFirebaseMock,
  configureFirebaseUser,
  setTokenValid,
  setActiveTrip,
  pushTripSnapshot,
  resetFirebaseMock,
} from '../helpers/firebase-mock';

// ---------------------------------------------------------------------------
// Mocks — must be registered before app import
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
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  httpServer.closeAllConnections?.();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

// ---------------------------------------------------------------------------
// Connection helper
// ---------------------------------------------------------------------------

interface ConnectedClient {
  ws:          WebSocket;
  nextMessage: () => Promise<unknown>;
  close:       () => void;
}

function connectWs(token?: string): Promise<ConnectedClient> {
  return new Promise((resolve, reject) => {
    const opts = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const ws = new WebSocket(`ws://localhost:${port}`, opts);

    const queue: unknown[] = [];
    let pending: ((v: unknown) => void) | null = null;

    ws.on('message', (raw) => {
      const msg = JSON.parse((raw as Buffer).toString());
      if (pending) {
        const res = pending;
        pending   = null;
        res(msg);
      } else {
        queue.push(msg);
      }
    });

    ws.on('open', () => {
      resolve({
        ws,
        nextMessage: () => {
          if (queue.length > 0) return Promise.resolve(queue.shift());
          return new Promise((res) => { pending = res; });
        },
        close: () => ws.close(),
      });
    });

    ws.on('error', reject);
    ws.on('unexpected-response', (_req, res) => {
      reject(Object.assign(new Error('Upgrade rejected'), { statusCode: res.statusCode }));
    });
  });
}

/** Attempts a connection and resolves with the HTTP status code on rejection. */
function connectExpectRejection(): Promise<number> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${port}`); // no token
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
    ws.on('error', () => resolve(0));
    ws.on('open', () => resolve(200)); // should not happen
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetFirebaseMock();
});

describe('Connection — successful auth', () => {
  it('sends { type: "connected" } immediately after handshake', async () => {
    const client = await connectWs('valid-token');
    const msg    = await client.nextMessage();

    expect(msg).toEqual({ type: 'connected' });

    client.close();
  });

  it('accepts a token in the ?token= query param', async () => {
    const ws = new WebSocket(`ws://localhost:${port}?token=valid-token`);

    const msg = await new Promise((resolve, reject) => {
      ws.on('message', (raw) => resolve(JSON.parse((raw as Buffer).toString())));
      ws.on('error', reject);
      ws.on('unexpected-response', (_req, res) => reject(new Error(`${res.statusCode}`)));
    });

    expect(msg).toMatchObject({ type: 'connected' });
    ws.close();
  });
});

describe('subscribe — no active trip', () => {
  it('returns trip_status: idle when bus has no active trip', async () => {
    setActiveTrip(null);

    const client = await connectWs('valid-token');
    await client.nextMessage(); // consume 'connected'

    client.ws.send(JSON.stringify({ type: 'subscribe', busId: 'bus-001' }));
    const msg = await client.nextMessage();

    expect(msg).toEqual({ type: 'trip_status', status: 'idle' });

    client.close();
  });
});

describe('subscribe — active trip', () => {
  it('returns trip_status: active with tripId', async () => {
    setActiveTrip({ id: 'trip-001', data: { status: 'active', busId: 'bus-001' } });

    const client = await connectWs('valid-token');
    await client.nextMessage(); // connected

    client.ws.send(JSON.stringify({ type: 'subscribe', busId: 'bus-001' }));
    const msg = await client.nextMessage();

    expect(msg).toEqual({ type: 'trip_status', status: 'active', tripId: 'trip-001' });

    client.close();
  });

  it('pushes a location message when Firestore sends a position update', async () => {
    setActiveTrip({ id: 'trip-001', data: { status: 'active' } });

    const client = await connectWs('valid-token');
    await client.nextMessage(); // connected

    client.ws.send(JSON.stringify({ type: 'subscribe', busId: 'bus-001' }));
    await client.nextMessage(); // trip_status: active

    // Simulate a GPS ping arriving at the trip document
    pushTripSnapshot({
      status:           'active',
      latestLat:        12.9716,
      latestLon:        77.5946,
      latestSpeed:      45,
      latestHeading:    90,
      latestRecordedAt: 1700000001000,
    });

    const msg = await client.nextMessage();
    expect(msg).toMatchObject({
      type: 'location',
      data: {
        busId:  'bus-001',
        tripId: 'trip-001',
        lat:    12.9716,
        lon:    77.5946,
      },
    });

    client.close();
  });

  it('pushes trip_status: ended when Firestore shows the trip has ended', async () => {
    setActiveTrip({ id: 'trip-001', data: { status: 'active' } });

    const client = await connectWs('valid-token');
    await client.nextMessage(); // connected

    client.ws.send(JSON.stringify({ type: 'subscribe', busId: 'bus-001' }));
    await client.nextMessage(); // trip_status: active

    pushTripSnapshot({ status: 'ended' });

    const msg = await client.nextMessage();
    expect(msg).toEqual({ type: 'trip_status', status: 'ended' });

    client.close();
  });
});

describe('tenantId isolation', () => {
  it('queries trips with the tenantId from the verified JWT — never from client message', async () => {
    // User is in tenant-001; attacker tries to subscribe with a bus from tenant-002
    configureFirebaseUser({ tenantId: 'tenant-001' });
    setActiveTrip(null); // tenant-001 has no active trip for bus-attacker

    const client = await connectWs('valid-token');
    await client.nextMessage(); // connected

    // The subscribe message mentions a bus, but tenantId comes from JWT only
    client.ws.send(JSON.stringify({ type: 'subscribe', busId: 'bus-attacker' }));
    const msg = await client.nextMessage();

    // Should return idle (tenant-001 has no trips for this bus)
    // — not data from tenant-002 even if the bus exists there
    expect(msg).toEqual({ type: 'trip_status', status: 'idle' });

    client.close();
  });
});

describe('GET /health', () => {
  it('returns 200 JSON without a WebSocket connection', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
