import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Trip, CreateTelemetryInput } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const tripRepoMock = vi.hoisted(() => ({
  findById: vi.fn(),
  update:   vi.fn(),
}));

const telemetryRepoMock = vi.hoisted(() => ({
  findLatestByTripId: vi.fn(),
  create:             vi.fn(),
}));

const rtdbRefMock = vi.hoisted(() => ({
  set:    vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));

const rtdbMock = vi.hoisted(() => ({
  ref: vi.fn().mockReturnValue(rtdbRefMock),
}));

vi.mock('../../src/repositories/trip.repository', () => ({
  TripRepository: vi.fn().mockImplementation(() => tripRepoMock),
}));

vi.mock('../../src/repositories/telemetry.repository', () => ({
  TelemetryRepository: vi.fn().mockImplementation(() => telemetryRepoMock),
}));

vi.mock('@saferide/firebase-admin', () => ({
  getRtdb: vi.fn().mockReturnValue(rtdbMock),
}));

const mockChildLogger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue(mockChildLogger),
}));

import { TelemetryService } from '../../src/services/telemetry.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id:        'trip-001',
    tenantId:  'tenant-001',
    driverId:  'driver-uid-001',
    busId:     'bus-001',
    routeId:   'route-001',
    status:    'active',
    startedAt: 1700000000000,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

const validPing: CreateTelemetryInput = {
  lat:        12.9716,
  lon:        77.5946,
  speed:      32.5,
  heading:    180,
  accuracy:   5,
  recordedAt: 1700000001000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(() => {
    vi.clearAllMocks();
    rtdbMock.ref.mockReturnValue(rtdbRefMock);
    service = new TelemetryService();
  });

  // ── recordPing ────────────────────────────────────────────────────────────
  it('recordPing() persists to Firestore and pushes to RTDB', async () => {
    tripRepoMock.findById.mockResolvedValue(makeTrip());
    tripRepoMock.update.mockResolvedValue(undefined);
    telemetryRepoMock.create.mockResolvedValue('telemetry-001');
    telemetryRepoMock.findLatestByTripId.mockResolvedValue(null);

    const result = await service.recordPing(
      'trip-001', validPing, 'driver-uid-001', 'bus-001', 'tenant-001',
    );

    // Firestore write
    expect(telemetryRepoMock.create).toHaveBeenCalledOnce();
    const createArg = telemetryRepoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg['lat']).toBe(validPing.lat);
    expect(createArg['lon']).toBe(validPing.lon);
    expect(createArg['tripId']).toBe('trip-001');
    expect(createArg['tenantId']).toBe('tenant-001');

    // RTDB write — keyed by busId
    expect(rtdbMock.ref).toHaveBeenCalledWith('liveLocation/bus-001');
    expect(rtdbRefMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ lat: validPing.lat, lon: validPing.lon, tripId: 'trip-001' }),
    );

    // Denormalize on trip doc — repo.update takes (id, tenantId, updates)
    expect(tripRepoMock.update).toHaveBeenCalledWith(
      'trip-001',
      'tenant-001',
      expect.objectContaining({ latestLat: validPing.lat, latestLon: validPing.lon }),
    );

    // Returns synthetic telemetry object
    expect(result.lat).toBe(validPing.lat);
    expect(result.tripId).toBe('trip-001');
    expect(result.busId).toBe('bus-001');
  });

  it('recordPing() throws TRIP_NOT_FOUND when trip does not exist', async () => {
    tripRepoMock.findById.mockResolvedValue(null);

    await expect(
      service.recordPing('missing', validPing, 'driver-uid-001', 'bus-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');

    expect(telemetryRepoMock.create).not.toHaveBeenCalled();
    expect(rtdbRefMock.set).not.toHaveBeenCalled();
  });

  it('recordPing() throws TRIP_NOT_OWNED when driverId does not match', async () => {
    tripRepoMock.findById.mockResolvedValue(makeTrip({ driverId: 'someone-else' }));

    await expect(
      service.recordPing('trip-001', validPing, 'driver-uid-001', 'bus-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_OWNED');

    expect(telemetryRepoMock.create).not.toHaveBeenCalled();
  });

  it('recordPing() throws TRIP_NOT_ACTIVE when trip is ended', async () => {
    tripRepoMock.findById.mockResolvedValue(makeTrip({ status: 'ended' }));

    await expect(
      service.recordPing('trip-001', validPing, 'driver-uid-001', 'bus-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_ACTIVE');

    expect(telemetryRepoMock.create).not.toHaveBeenCalled();
    expect(rtdbRefMock.set).not.toHaveBeenCalled();
  });

  it('recordPing() enforces tenant isolation — finds trip with tenantId match', async () => {
    // Trip belongs to different tenant — findById returns it but trip service returns null
    tripRepoMock.findById.mockResolvedValue(makeTrip({ tenantId: 'tenant-999' }));

    await expect(
      service.recordPing('trip-001', validPing, 'driver-uid-001', 'bus-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');
  });

  // ── findLatest ────────────────────────────────────────────────────────────
  it('findLatest() delegates to the telemetry repository', async () => {
    const ping = {
      id: 'tel-001', tenantId: 'tenant-001', tripId: 'trip-001',
      driverId: 'driver-uid-001', busId: 'bus-001',
      lat: 12.9716, lon: 77.5946, recordedAt: 1700000001000, createdAt: 1700000001050,
    };
    telemetryRepoMock.findLatestByTripId.mockResolvedValue(ping);

    const result = await service.findLatest('trip-001', 'tenant-001');

    expect(telemetryRepoMock.findLatestByTripId).toHaveBeenCalledWith('trip-001', 'tenant-001');
    expect(result).toEqual(ping);
  });

  it('findLatest() returns null when no pings exist', async () => {
    telemetryRepoMock.findLatestByTripId.mockResolvedValue(null);

    const result = await service.findLatest('trip-001', 'tenant-001');

    expect(result).toBeNull();
  });
});
