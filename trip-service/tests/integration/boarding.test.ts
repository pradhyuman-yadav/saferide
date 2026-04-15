/**
 * Integration tests — /api/v1/trips/:id/boarding
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
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog: vi.fn(),
}));

// Mock TripService (required by middleware / trip lookup)
const tripServiceMock = vi.hoisted(() => ({
  listMyTrips:          vi.fn(),
  findActiveForDriver:  vi.fn(),
  findActiveForBus:     vi.fn(),
  listTripsForBus:      vi.fn(),
  findTrip:             vi.fn(),
  startTrip:            vi.fn(),
  endTrip:              vi.fn(),
  sendSOS:              vi.fn(),
  cancelSOS:            vi.fn(),
  updateLatestLocation: vi.fn(),
}));

vi.mock('../../src/services/trip.service', () => ({
  TripService: vi.fn().mockImplementation(() => tripServiceMock),
}));

// Mock TelemetryService (registered in routes file)
const telemetryServiceMock = vi.hoisted(() => ({
  recordPing: vi.fn(),
  findLatest: vi.fn(),
}));

vi.mock('../../src/services/telemetry.service', () => ({
  TelemetryService: vi.fn().mockImplementation(() => telemetryServiceMock),
}));

// Mock BoardingService — the service under test at HTTP layer
const boardingServiceMock = vi.hoisted(() => ({
  recordBoarding: vi.fn(),
  listBoarding:   vi.fn(),
  sweepOnTripEnd: vi.fn(),
}));

vi.mock('../../src/services/boarding.service', () => ({
  BoardingService: vi.fn().mockImplementation(() => boardingServiceMock),
}));

// Import app AFTER mocks are registered
import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_HEADER = 'Bearer test-token';

function makeBoardingEvent(overrides: Record<string, unknown> = {}) {
  return {
    id:         'boarding-001',
    tenantId:   'tenant-001',
    tripId:     'trip-001',
    studentId:  'student-001',
    busId:      'bus-001',
    stopId:     'stop-001',
    eventType:  'boarded',
    method:     'manual',
    recordedAt: 1700000100000,
    createdAt:  1700000100000,
    ...overrides,
  };
}

const VALID_BOARDING_BODY = {
  studentId:  'student-001',
  stopId:     'stop-001',
  eventType:  'boarded',
  method:     'manual',
  recordedAt: 1700000100000,
};

// ---------------------------------------------------------------------------
// POST /api/v1/trips/:id/boarding
// ---------------------------------------------------------------------------

describe('POST /api/v1/trips/:id/boarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseUser({ role: 'driver', tenantId: 'tenant-001', uid: 'driver-uid' });
    configureFirebaseTenant({ status: 'active' });
    boardingServiceMock.recordBoarding.mockResolvedValue('boarding-001');
  });

  it('returns 201 with boarding event id on success', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_BOARDING_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('boarding-001');
  });

  it('calls service with tripId, input, driverId, tenantId from JWT', async () => {
    await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_BOARDING_BODY);

    expect(boardingServiceMock.recordBoarding).toHaveBeenCalledWith(
      'trip-001',
      expect.objectContaining({ studentId: 'student-001', method: 'manual' }),
      'driver-uid',
      'tenant-001',
    );
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .send(VALID_BOARDING_BODY);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when caller is not a driver', async () => {
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001' });

    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_BOARDING_BODY);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when request body is invalid (missing studentId)', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send({ eventType: 'boarded', method: 'manual', recordedAt: 1700000100000 }); // missing studentId

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when method is rfid (Phase 1: manual only)', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_BOARDING_BODY, method: 'rfid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 ALREADY_BOARDED when service throws ALREADY_BOARDED', async () => {
    boardingServiceMock.recordBoarding.mockRejectedValue(new Error('ALREADY_BOARDED'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_BOARDING_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_BOARDED');
  });

  it('returns 404 TRIP_NOT_FOUND when service throws TRIP_NOT_FOUND', async () => {
    boardingServiceMock.recordBoarding.mockRejectedValue(new Error('TRIP_NOT_FOUND'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_BOARDING_BODY);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIP_NOT_FOUND');
  });

  it('returns 422 STUDENT_NOT_ON_BUS when service throws STUDENT_NOT_ON_BUS', async () => {
    boardingServiceMock.recordBoarding.mockRejectedValue(new Error('STUDENT_NOT_ON_BUS'));

    const res = await request(app)
      .post('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_BOARDING_BODY);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('STUDENT_NOT_ON_BUS');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/trips/:id/boarding
// ---------------------------------------------------------------------------

describe('GET /api/v1/trips/:id/boarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseMock();
    configureFirebaseTenant({ status: 'active' });
    boardingServiceMock.listBoarding.mockResolvedValue([makeBoardingEvent()]);
  });

  it('returns 200 with boarding events array for manager', async () => {
    configureFirebaseUser({ role: 'manager', tenantId: 'tenant-001', uid: 'manager-uid' });

    const res = await request(app)
      .get('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 200 with boarding events for school_admin', async () => {
    configureFirebaseUser({ role: 'school_admin', tenantId: 'tenant-001', uid: 'admin-uid' });

    const res = await request(app)
      .get('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/v1/trips/trip-001/boarding');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when caller is a parent (insufficient role)', async () => {
    configureFirebaseUser({ role: 'parent', tenantId: 'tenant-001', uid: 'parent-uid' });

    const res = await request(app)
      .get('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('calls service with tripId and tenantId from JWT', async () => {
    configureFirebaseUser({ role: 'manager', tenantId: 'tenant-001', uid: 'manager-uid' });

    await request(app)
      .get('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER);

    expect(boardingServiceMock.listBoarding).toHaveBeenCalledWith('trip-001', 'tenant-001');
  });

  it('returns empty array when no boarding events exist', async () => {
    configureFirebaseUser({ role: 'manager', tenantId: 'tenant-001', uid: 'manager-uid' });
    boardingServiceMock.listBoarding.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/trips/trip-001/boarding')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
