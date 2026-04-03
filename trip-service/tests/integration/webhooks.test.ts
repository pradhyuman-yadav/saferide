/**
 * Integration tests — /api/v1/webhooks
 *
 * Tests the full HTTP stack: route → middleware → controller → service (mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  buildFirebaseMock,
  configureFirebaseUser,
  resetFirebaseMock,
} from '../helpers/firebase-mock';
import type { Webhook, WebhookDelivery } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — must be declared before app import
// ---------------------------------------------------------------------------

vi.mock('@saferide/firebase-admin', () => buildFirebaseMock());
vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog: vi.fn(),
}));

const tripServiceMock = vi.hoisted(() => ({
  listMyTrips:         vi.fn(),
  findActiveForDriver: vi.fn(),
  findActiveForBus:    vi.fn(),
  listTripsForBus:     vi.fn(),
  listAllTrips:        vi.fn(),
  listTenantTrips:     vi.fn(),
  findTrip:            vi.fn(),
  startTrip:           vi.fn(),
  endTrip:             vi.fn(),
  sendSOS:             vi.fn(),
  cancelSOS:           vi.fn(),
  updateLatestLocation: vi.fn(),
}));
vi.mock('../../src/services/trip.service', () => ({
  TripService: vi.fn().mockImplementation(() => tripServiceMock),
}));

const telemetryServiceMock = vi.hoisted(() => ({
  recordPing:  vi.fn(),
  findLatest:  vi.fn(),
}));
vi.mock('../../src/services/telemetry.service', () => ({
  TelemetryService: vi.fn().mockImplementation(() => telemetryServiceMock),
}));

const webhookServiceMock = vi.hoisted(() => ({
  list:            vi.fn(),
  create:          vi.fn(),
  delete:          vi.fn(),
  listDeliveries:  vi.fn(),
  deliverEvent:    vi.fn(),
}));
vi.mock('../../src/services/webhook.service', () => ({
  WebhookService: vi.fn().mockImplementation(() => webhookServiceMock),
}));

import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebhook(overrides: Partial<Webhook> = {}): Webhook {
  return {
    id:        'wh-001',
    tenantId:  'tenant-001',
    url:       'https://example.com/hook',
    events:    ['trip.started'],
    isActive:  true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function makeDelivery(): WebhookDelivery {
  return {
    id:            'del-001',
    tenantId:      'tenant-001',
    webhookId:     'wh-001',
    event:         'trip.started',
    status:        'success',
    statusCode:    200,
    attempts:      1,
    lastAttemptAt: 1700000000000,
    createdAt:     1700000000000,
  };
}

const SCHOOL_ADMIN_TOKEN = 'Bearer school-admin-token';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
  });

  it('returns 200 with webhook list', async () => {
    webhookServiceMock.list.mockResolvedValue([makeWebhook()]);

    const res = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/webhooks');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has no tenantId', async () => {
    configureFirebaseUser({ role: 'school_admin', tenantId: null });
    webhookServiceMock.list.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NO_TENANT');
  });
});

describe('POST /api/v1/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
  });

  it('creates a webhook and returns 201', async () => {
    webhookServiceMock.create.mockResolvedValue(makeWebhook());

    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', SCHOOL_ADMIN_TOKEN)
      .send({ url: 'https://example.com/hook', events: ['trip.started'] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('wh-001');
  });

  it('returns 400 on invalid body (missing events)', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', SCHOOL_ADMIN_TOKEN)
      .send({ url: 'https://example.com/hook' });

    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid URL', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', SCHOOL_ADMIN_TOKEN)
      .send({ url: 'not-a-url', events: ['trip.started'] });

    expect(res.status).toBe(400);
  });

  it('returns 403 when user has no tenantId', async () => {
    configureFirebaseUser({ role: 'school_admin', tenantId: null });

    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', SCHOOL_ADMIN_TOKEN)
      .send({ url: 'https://example.com/hook', events: ['trip.started'] });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/webhooks/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
  });

  it('returns 204 on successful deletion', async () => {
    webhookServiceMock.delete.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/webhooks/wh-001')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(204);
  });

  it('returns 404 when webhook not found', async () => {
    webhookServiceMock.delete.mockRejectedValue(new Error('WEBHOOK_NOT_FOUND'));

    const res = await request(app)
      .delete('/api/v1/webhooks/wh-missing')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEBHOOK_NOT_FOUND');
  });

  it('returns 403 when user has no tenantId', async () => {
    configureFirebaseUser({ role: 'school_admin', tenantId: null });

    const res = await request(app)
      .delete('/api/v1/webhooks/wh-001')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/webhooks/:id/deliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
  });

  it('returns 200 with delivery list', async () => {
    webhookServiceMock.listDeliveries.mockResolvedValue([makeDelivery()]);

    const res = await request(app)
      .get('/api/v1/webhooks/wh-001/deliveries')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 403 when user has no tenantId', async () => {
    configureFirebaseUser({ role: 'school_admin', tenantId: null });

    const res = await request(app)
      .get('/api/v1/webhooks/wh-001/deliveries')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(403);
  });
});

// ── Additional trip controller coverage (all-history, tenant-history) ────────

describe('GET /api/v1/trips/all-history (super_admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'super_admin', tenantId: null });
  });

  it('returns 200 with all trips', async () => {
    tripServiceMock.listAllTrips.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/trips/all-history')
      .set('Authorization', 'Bearer super-admin-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for non-super_admin', async () => {
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });

    const res = await request(app)
      .get('/api/v1/trips/all-history')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/trips/tenant-history (school_admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
  });

  it('returns 200 with tenant trips', async () => {
    tripServiceMock.listTenantTrips.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/trips/tenant-history')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when tenantId is null', async () => {
    configureFirebaseUser({ role: 'school_admin', tenantId: null });
    tripServiceMock.listTenantTrips.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/trips/tenant-history')
      .set('Authorization', SCHOOL_ADMIN_TOKEN);

    expect(res.status).toBe(403);
  });
});
