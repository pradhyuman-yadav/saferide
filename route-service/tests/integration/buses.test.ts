/**
 * Integration tests — /api/v1/buses
 *
 * Tests the full HTTP stack: route → middleware → controller → service (mocked).
 * Firebase is mocked so no real Firestore calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  buildFirebaseMock,
  configureFirebaseUser,
  configureFirebaseTenant,
  resetFirebaseMock,
} from '../helpers/firebase-mock';

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any service/app imports
// ---------------------------------------------------------------------------

vi.mock('@saferide/firebase-admin', () => buildFirebaseMock());
const mockChildLogger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue(mockChildLogger),
}));

// Mock BusService so integration tests stay fast and deterministic
const busServiceMock = vi.hoisted(() => ({
  listBuses:    vi.fn(),
  findBus:      vi.fn(),
  createBus:    vi.fn(),
  updateBus:    vi.fn(),
  deleteBus:    vi.fn(),
  assignDriver: vi.fn(),
  assignRoute:  vi.fn(),
}));

vi.mock('../../src/services/bus.service', () => ({
  BusService: vi.fn().mockImplementation(() => busServiceMock),
}));

// Import app AFTER mocks are registered
import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_HEADER = 'Bearer test-token';

function makeBus(overrides: Record<string, unknown> = {}) {
  return {
    id:                 'bus-001',
    tenantId:           'tenant-001',
    registrationNumber: 'KA 01 AB 1234',
    make:               'Tata',
    model:              'Starbus',
    capacity:           40,
    status:             'active',
    driverId:           null,
    routeId:            null,
    createdAt:          1700000000000,
    updatedAt:          1700000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/buses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with buses array wrapped in success envelope', async () => {
    busServiceMock.listBuses.mockResolvedValue([makeBus(), makeBus({ id: 'bus-002' })]);

    const res = await request(app)
      .get('/api/v1/buses')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/v1/buses');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when role is parent (not allowed to list buses)', async () => {
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });

    const res = await request(app)
      .get('/api/v1/buses')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('calls service with tenantId from JWT — never from query string', async () => {
    busServiceMock.listBuses.mockResolvedValue([]);

    await request(app)
      .get('/api/v1/buses?tenantId=tenant-attacker')
      .set('Authorization', AUTH_HEADER);

    // Must be called with the JWT tenantId, not the query param
    expect(busServiceMock.listBuses).toHaveBeenCalledWith('tenant-001');
  });

  it('returns empty array when tenant has no buses', async () => {
    busServiceMock.listBuses.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/buses')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/v1/buses/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with bus when found', async () => {
    busServiceMock.findBus.mockResolvedValue(makeBus());

    const res = await request(app)
      .get('/api/v1/buses/bus-001')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('bus-001');
  });

  it('returns 404 when bus does not exist', async () => {
    busServiceMock.findBus.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/buses/missing')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BUS_NOT_FOUND');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/buses/bus-001');
    expect(res.status).toBe(401);
  });

  it('passes bus id and tenantId from JWT to service — never tenantId from URL', async () => {
    busServiceMock.findBus.mockResolvedValue(makeBus());

    await request(app)
      .get('/api/v1/buses/bus-001')
      .set('Authorization', AUTH_HEADER);

    expect(busServiceMock.findBus).toHaveBeenCalledWith('bus-001', 'tenant-001');
  });
});

describe('POST /api/v1/buses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  const validBody = {
    registrationNumber: 'KA 01 AB 1234',
    make:               'Tata',
    model:              'Starbus',
    year:               2022,
    capacity:           40,
  };

  it('returns 201 with created bus', async () => {
    busServiceMock.createBus.mockResolvedValue(makeBus());

    const res = await request(app)
      .post('/api/v1/buses')
      .set('Authorization', AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('bus-001');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/buses')
      .set('Authorization', AUTH_HEADER)
      .send({ make: 'Tata' }); // missing registrationNumber, model, capacity

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/buses')
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when driver role tries to create a bus', async () => {
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001' });

    const res = await request(app)
      .post('/api/v1/buses')
      .set('Authorization', AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('uses tenantId from JWT, ignoring any tenantId in the request body', async () => {
    busServiceMock.createBus.mockResolvedValue(makeBus());

    await request(app)
      .post('/api/v1/buses')
      .set('Authorization', AUTH_HEADER)
      .send({ ...validBody, tenantId: 'tenant-attacker' });

    // Controller must pass req.user.tenantId, not any body field
    expect(busServiceMock.createBus).toHaveBeenCalledWith(
      expect.not.objectContaining({ tenantId: 'tenant-attacker' }),
      'tenant-001',
    );
  });
});

describe('PATCH /api/v1/buses/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with updated bus', async () => {
    busServiceMock.updateBus.mockResolvedValue(makeBus({ make: 'Force' }));

    const res = await request(app)
      .patch('/api/v1/buses/bus-001')
      .set('Authorization', AUTH_HEADER)
      .send({ make: 'Force' });

    expect(res.status).toBe(200);
    expect(res.body.data.make).toBe('Force');
  });

  it('returns 404 when bus does not exist', async () => {
    busServiceMock.updateBus.mockRejectedValue(new Error('BUS_NOT_FOUND'));

    const res = await request(app)
      .patch('/api/v1/buses/missing')
      .set('Authorization', AUTH_HEADER)
      .send({ make: 'Force' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BUS_NOT_FOUND');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch('/api/v1/buses/bus-001')
      .send({ make: 'Force' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/buses/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 204 on successful deletion', async () => {
    busServiceMock.deleteBus.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/buses/bus-001')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('returns 404 when bus does not exist', async () => {
    busServiceMock.deleteBus.mockRejectedValue(new Error('BUS_NOT_FOUND'));

    const res = await request(app)
      .delete('/api/v1/buses/missing')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 403 when manager tries to delete (school_admin only)', async () => {
    configureFirebaseUser({ role: 'manager', tenantId: 'tenant-001' });

    const res = await request(app)
      .delete('/api/v1/buses/bus-001')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
  });
});

describe('GET /health', () => {
  it('returns 200 without auth token', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
