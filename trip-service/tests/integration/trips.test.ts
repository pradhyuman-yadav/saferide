/**
 * Integration tests — /api/v1/trips
 *
 * Tests the full HTTP stack: route → middleware → controller → service (mocked).
 * Firebase Admin SDK and both services are mocked so no real Firestore/RTDB
 * calls are made and tests stay deterministic.
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
// Module-level mocks — must be declared before app import
// ---------------------------------------------------------------------------

vi.mock('@saferide/firebase-admin', () => buildFirebaseMock());
vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Mock TripService so tests stay fast and predictable
const tripServiceMock = vi.hoisted(() => ({
  listMyTrips:         vi.fn(),
  findActiveForDriver: vi.fn(),
  findActiveForBus:    vi.fn(),
  listTripsForBus:     vi.fn(),
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

// Mock TelemetryService
const telemetryServiceMock = vi.hoisted(() => ({
  recordPing:  vi.fn(),
  findLatest:  vi.fn(),
}));

vi.mock('../../src/services/telemetry.service', () => ({
  TelemetryService: vi.fn().mockImplementation(() => telemetryServiceMock),
}));

// Import app AFTER mocks are registered
import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_HEADER = 'Bearer test-token';

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id:         'trip-001',
    tenantId:   'tenant-001',
    driverId:   'driver-uid',
    busId:      'bus-001',
    routeId:    'route-001',
    status:     'active',
    sosActive:  false,
    startedAt:  1700000000000,
    createdAt:  1700000000000,
    updatedAt:  1700000000000,
    ...overrides,
  };
}

function makePing(overrides: Record<string, unknown> = {}) {
  return {
    id:         'ping-001',
    tenantId:   'tenant-001',
    tripId:     'trip-001',
    driverId:   'driver-uid',
    busId:      'bus-001',
    lat:        12.9716,
    lon:        77.5946,
    speed:      45,
    heading:    90,
    recordedAt: 1700000000000,
    createdAt:  1700000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/trips — driver's own trip history
// ---------------------------------------------------------------------------

describe('GET /api/v1/trips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with trips array wrapped in success envelope', async () => {
    tripServiceMock.listMyTrips.mockResolvedValue([makeTrip(), makeTrip({ id: 'trip-002' })]);

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/v1/trips');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when role is parent (driver-only endpoint)', async () => {
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('calls service with driverId and tenantId from JWT', async () => {
    tripServiceMock.listMyTrips.mockResolvedValue([]);

    await request(app)
      .get('/api/v1/trips')
      .set('Authorization', AUTH_HEADER);

    expect(tripServiceMock.listMyTrips).toHaveBeenCalledWith('driver-uid', 'tenant-001');
  });

  it('returns empty array when driver has no trips', async () => {
    tripServiceMock.listMyTrips.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/trips/active — driver's active trip
// ---------------------------------------------------------------------------

describe('GET /api/v1/trips/active', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with active trip when found', async () => {
    tripServiceMock.findActiveForDriver.mockResolvedValue(makeTrip());

    const res = await request(app)
      .get('/api/v1/trips/active')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('trip-001');
    expect(res.body.data.status).toBe('active');
  });

  it('returns 200 with null data when no active trip', async () => {
    tripServiceMock.findActiveForDriver.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/trips/active')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/trips/active');
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is manager (driver-only endpoint)', async () => {
    configureFirebaseUser({ role: 'manager', tenantId: 'tenant-001' });

    const res = await request(app)
      .get('/api/v1/trips/active')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/trips/bus/:busId — bus trip history (parents, managers)
// ---------------------------------------------------------------------------

describe('GET /api/v1/trips/bus/:busId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with trips for a bus (parent role)', async () => {
    tripServiceMock.listTripsForBus.mockResolvedValue([makeTrip(), makeTrip({ id: 'trip-002', status: 'ended' })]);

    const res = await request(app)
      .get('/api/v1/trips/bus/bus-001')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns 200 with trips for a bus (manager role)', async () => {
    configureFirebaseUser({ role: 'manager', tenantId: 'tenant-001' });
    tripServiceMock.listTripsForBus.mockResolvedValue([makeTrip()]);

    const res = await request(app)
      .get('/api/v1/trips/bus/bus-001')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 403 when role is driver (not allowed)', async () => {
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001' });

    const res = await request(app)
      .get('/api/v1/trips/bus/bus-001')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
  });

  it('calls service with busId from URL and tenantId from JWT', async () => {
    tripServiceMock.listTripsForBus.mockResolvedValue([]);

    await request(app)
      .get('/api/v1/trips/bus/bus-001?tenantId=tenant-attacker')
      .set('Authorization', AUTH_HEADER);

    // tenantId must come from JWT, never from query string
    expect(tripServiceMock.listTripsForBus).toHaveBeenCalledWith('bus-001', 'tenant-001');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/trips/bus/:busId/active — live active trip for a bus
// ---------------------------------------------------------------------------

describe('GET /api/v1/trips/bus/:busId/active', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with active trip when bus is on route', async () => {
    tripServiceMock.findActiveForBus.mockResolvedValue(makeTrip());

    const res = await request(app)
      .get('/api/v1/trips/bus/bus-001/active')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.busId).toBe('bus-001');
  });

  it('returns 200 with null when no active trip for bus', async () => {
    tripServiceMock.findActiveForBus.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/trips/bus/bus-001/active')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/trips/bus/bus-001/active');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/trips — driver starts a trip
// ---------------------------------------------------------------------------

describe('POST /api/v1/trips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
  });

  const validBody = { busId: 'bus-001', routeId: 'route-001' };

  it('returns 201 with created trip', async () => {
    tripServiceMock.startTrip.mockResolvedValue(makeTrip());

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('trip-001');
    expect(res.body.data.status).toBe('active');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', AUTH_HEADER)
      .send({ busId: 'bus-001' }); // missing routeId

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/trips').send(validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is parent (driver-only)', async () => {
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('returns 409 when driver already has an active trip', async () => {
    tripServiceMock.startTrip.mockRejectedValue(new Error('TRIP_ALREADY_ACTIVE'));

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRIP_ALREADY_ACTIVE');
  });

  it('passes driverId from JWT — never from request body', async () => {
    tripServiceMock.startTrip.mockResolvedValue(makeTrip());

    await request(app)
      .post('/api/v1/trips')
      .set('Authorization', AUTH_HEADER)
      .send({ ...validBody, driverId: 'attacker-uid' });

    // driverId must be the JWT uid, not anything from the body
    expect(tripServiceMock.startTrip).toHaveBeenCalledWith(
      expect.objectContaining({ busId: 'bus-001', routeId: 'route-001' }),
      'driver-uid',
      'tenant-001',
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/trips/:id/end — driver ends a trip
// ---------------------------------------------------------------------------

describe('POST /api/v1/trips/:id/end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with ended trip', async () => {
    tripServiceMock.endTrip.mockResolvedValue(makeTrip({ status: 'ended', endedAt: Date.now() }));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/end')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ended');
  });

  it('returns 404 when trip does not exist', async () => {
    tripServiceMock.endTrip.mockRejectedValue(new Error('TRIP_NOT_FOUND'));

    const res = await request(app)
      .post('/api/v1/trips/missing/end')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIP_NOT_FOUND');
  });

  it('returns 403 when driver tries to end another driver\'s trip', async () => {
    tripServiceMock.endTrip.mockRejectedValue(new Error('TRIP_NOT_OWNED'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/end')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TRIP_NOT_OWNED');
  });

  it('returns 409 when trip is already ended', async () => {
    tripServiceMock.endTrip.mockRejectedValue(new Error('TRIP_ALREADY_ENDED'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/end')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRIP_ALREADY_ENDED');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/trips/trip-001/end');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/trips/:id/sos — driver triggers SOS
// ---------------------------------------------------------------------------

describe('POST /api/v1/trips/:id/sos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with trip showing sosActive: true', async () => {
    tripServiceMock.sendSOS.mockResolvedValue(makeTrip({ sosActive: true, sosTriggeredAt: Date.now() }));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/sos')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sosActive).toBe(true);
  });

  it('returns 404 when trip does not exist', async () => {
    tripServiceMock.sendSOS.mockRejectedValue(new Error('TRIP_NOT_FOUND'));

    const res = await request(app)
      .post('/api/v1/trips/missing/sos')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIP_NOT_FOUND');
  });

  it('returns 403 when driver triggers SOS on another trip', async () => {
    tripServiceMock.sendSOS.mockRejectedValue(new Error('TRIP_NOT_OWNED'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/sos')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TRIP_NOT_OWNED');
  });

  it('returns 409 when trip is already ended', async () => {
    tripServiceMock.sendSOS.mockRejectedValue(new Error('TRIP_ALREADY_ENDED'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/sos')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRIP_ALREADY_ENDED');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/trips/trip-001/sos');
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is manager (driver-only)', async () => {
    configureFirebaseUser({ role: 'manager', tenantId: 'tenant-001' });

    const res = await request(app)
      .post('/api/v1/trips/trip-001/sos')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/trips/:id/sos/cancel — driver cancels SOS
// ---------------------------------------------------------------------------

describe('POST /api/v1/trips/:id/sos/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with trip showing sosActive: false', async () => {
    tripServiceMock.cancelSOS.mockResolvedValue(makeTrip({ sosActive: false }));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/sos/cancel')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.sosActive).toBe(false);
  });

  it('returns 404 when trip does not exist', async () => {
    tripServiceMock.cancelSOS.mockRejectedValue(new Error('TRIP_NOT_FOUND'));

    const res = await request(app)
      .post('/api/v1/trips/missing/sos/cancel')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIP_NOT_FOUND');
  });

  it('returns 403 when driver cancels SOS on another trip', async () => {
    tripServiceMock.cancelSOS.mockRejectedValue(new Error('TRIP_NOT_OWNED'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/sos/cancel')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TRIP_NOT_OWNED');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/trips/trip-001/sos/cancel');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/trips/:id/location — GPS ping
// ---------------------------------------------------------------------------

describe('POST /api/v1/trips/:id/location', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
  });

  const validPing = {
    lat:        12.9716,
    lon:        77.5946,
    speed:      45,
    heading:    90,
    recordedAt: 1700000000000,
  };

  it('returns 201 with recorded ping', async () => {
    tripServiceMock.findTrip.mockResolvedValue(makeTrip());
    telemetryServiceMock.recordPing.mockResolvedValue(makePing());

    const res = await request(app)
      .post('/api/v1/trips/trip-001/location')
      .set('Authorization', AUTH_HEADER)
      .send(validPing);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lat).toBe(12.9716);
  });

  it('returns 404 when trip does not exist', async () => {
    tripServiceMock.findTrip.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/trips/missing/location')
      .set('Authorization', AUTH_HEADER)
      .send(validPing);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIP_NOT_FOUND');
  });

  it('returns 400 when lat/lon are missing', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/location')
      .set('Authorization', AUTH_HEADER)
      .send({ speed: 45, recordedAt: 1700000000000 }); // missing lat, lon

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when lat is out of range', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/location')
      .set('Authorization', AUTH_HEADER)
      .send({ ...validPing, lat: 91 }); // invalid

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/location')
      .send(validPing);
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is parent (driver-only)', async () => {
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });

    const res = await request(app)
      .post('/api/v1/trips/trip-001/location')
      .set('Authorization', AUTH_HEADER)
      .send(validPing);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/trips/:id/location/latest — latest GPS ping
// ---------------------------------------------------------------------------

describe('GET /api/v1/trips/:id/location/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });
    configureFirebaseTenant({ status: 'active' });
  });

  it('returns 200 with latest ping (parent role)', async () => {
    tripServiceMock.findTrip.mockResolvedValue(makeTrip());
    telemetryServiceMock.findLatest.mockResolvedValue(makePing());

    const res = await request(app)
      .get('/api/v1/trips/trip-001/location/latest')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lat).toBe(12.9716);
  });

  it('returns 200 with null when no pings yet', async () => {
    tripServiceMock.findTrip.mockResolvedValue(makeTrip());
    telemetryServiceMock.findLatest.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/trips/trip-001/location/latest')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 404 when trip does not exist', async () => {
    tripServiceMock.findTrip.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/trips/missing/location/latest')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIP_NOT_FOUND');
  });

  it('returns 200 with latest ping (driver role)', async () => {
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001' });
    tripServiceMock.findTrip.mockResolvedValue(makeTrip());
    telemetryServiceMock.findLatest.mockResolvedValue(makePing());

    const res = await request(app)
      .get('/api/v1/trips/trip-001/location/latest')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/trips/trip-001/location/latest');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /health — public endpoint
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 without an auth token', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe('trip-service');
  });
});
