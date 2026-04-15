/**
 * Security tests — Auth bypass
 *
 * Asserts that every protected route in trip-service returns 401 when called
 * without an Authorization header. No service mocks needed — the middleware
 * rejects the request before any business logic runs.
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { buildFirebaseMock } from '../helpers/firebase-mock';

// ---------------------------------------------------------------------------
// Mocks — must be registered before app import
// ---------------------------------------------------------------------------

vi.mock('@saferide/firebase-admin', () => buildFirebaseMock());
vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../src/services/trip.service', () => ({
  TripService: vi.fn().mockImplementation(() => ({
    listMyTrips:         vi.fn(),
    findActiveForDriver: vi.fn(),
    findActiveForBus:    vi.fn(),
    listTripsForBus:     vi.fn(),
    findTrip:            vi.fn(),
    startTrip:           vi.fn(),
    endTrip:             vi.fn(),
    sendSOS:             vi.fn(),
    cancelSOS:           vi.fn(),
  })),
}));
vi.mock('../../src/services/telemetry.service', () => ({
  TelemetryService: vi.fn().mockImplementation(() => ({
    recordPing: vi.fn(),
    findLatest: vi.fn(),
  })),
}));
vi.mock('../../src/services/webhook.service', () => ({
  WebhookService: vi.fn().mockImplementation(() => ({
    listWebhooks:     vi.fn(),
    createWebhook:    vi.fn(),
    deleteWebhook:    vi.fn(),
    listDeliveries:   vi.fn(),
  })),
}));

import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Every protected route — [method, path]
// ---------------------------------------------------------------------------

const PROTECTED_ROUTES: [string, string][] = [
  // Trip routes
  ['get',    '/api/v1/trips'],
  ['get',    '/api/v1/trips/active'],
  ['get',    '/api/v1/trips/all-history'],
  ['get',    '/api/v1/trips/tenant-history'],
  ['get',    '/api/v1/trips/bus/bus-001'],
  ['get',    '/api/v1/trips/bus/bus-001/active'],
  ['post',   '/api/v1/trips'],
  ['post',   '/api/v1/trips/trip-001/end'],
  ['post',   '/api/v1/trips/trip-001/sos'],
  ['post',   '/api/v1/trips/trip-001/sos/cancel'],
  ['post',   '/api/v1/trips/trip-001/location'],
  ['get',    '/api/v1/trips/trip-001/location/latest'],
  // Webhook routes
  ['get',    '/api/v1/webhooks'],
  ['post',   '/api/v1/webhooks'],
  ['delete', '/api/v1/webhooks/wh-001'],
  ['get',    '/api/v1/webhooks/wh-001/deliveries'],
];

describe('Auth bypass — all protected routes return 401 without a token', () => {
  it.each(PROTECTED_ROUTES)('%s %s → 401', async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('Public routes remain accessible without a token', () => {
  it('GET /health → 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
