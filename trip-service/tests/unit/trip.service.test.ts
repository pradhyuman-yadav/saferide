import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Trip } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — hoisted so they're available inside vi.mock() factories
// ---------------------------------------------------------------------------
const repoMock = vi.hoisted(() => ({
  listByDriverId:       vi.fn(),
  listByBusId:          vi.fn(),
  findById:             vi.fn(),
  findActiveByDriverId: vi.fn(),
  findActiveByBusId:    vi.fn(),
  create:               vi.fn(),
  update:               vi.fn(),
  setSosStatus:         vi.fn(),
}));

const rtdbMock = vi.hoisted(() => ({
  ref: vi.fn().mockReturnValue({
    set:    vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }),
}));

const notificationsMock = vi.hoisted(() => ({
  notifyParentsOfBus:     vi.fn().mockResolvedValue(undefined),
  notifyManagersOfTenant: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/repositories/trip.repository', () => ({
  TripRepository: vi.fn().mockImplementation(() => repoMock),
}));

vi.mock('../../src/services/notification.service', () => ({
  NotificationService: vi.fn().mockImplementation(() => notificationsMock),
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

import { TripService } from '../../src/services/trip.service';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TripService', () => {
  let service: TripService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset rtdb ref mock each test
    rtdbMock.ref.mockReturnValue({
      set:    vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    });
    service = new TripService();
  });

  // ── listMyTrips ──────────────────────────────────────────────────────────
  it('listMyTrips() returns trips for the driver', async () => {
    const trips = [makeTrip({ id: 'trip-001' }), makeTrip({ id: 'trip-002', status: 'ended' })];
    repoMock.listByDriverId.mockResolvedValue(trips);

    const result = await service.listMyTrips('driver-uid-001', 'tenant-001');

    expect(repoMock.listByDriverId).toHaveBeenCalledWith('driver-uid-001', 'tenant-001', 30);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('trip-001');
  });

  it('listMyTrips() returns empty array when driver has no trips', async () => {
    repoMock.listByDriverId.mockResolvedValue([]);

    const result = await service.listMyTrips('driver-uid-001', 'tenant-001');

    expect(result).toEqual([]);
  });

  // ── findActiveForDriver ──────────────────────────────────────────────────
  it('findActiveForDriver() returns active trip for driver', async () => {
    const trip = makeTrip();
    repoMock.findActiveByDriverId.mockResolvedValue(trip);

    const result = await service.findActiveForDriver('driver-uid-001', 'tenant-001');

    expect(repoMock.findActiveByDriverId).toHaveBeenCalledWith('driver-uid-001', 'tenant-001');
    expect(result).toEqual(trip);
  });

  it('findActiveForDriver() returns null when no active trip', async () => {
    repoMock.findActiveByDriverId.mockResolvedValue(null);

    const result = await service.findActiveForDriver('driver-uid-001', 'tenant-001');

    expect(result).toBeNull();
  });

  // ── listTripsForBus ──────────────────────────────────────────────────────
  it('listTripsForBus() returns trips for the bus, newest first', async () => {
    const trips = [makeTrip({ id: 'trip-001' }), makeTrip({ id: 'trip-002', status: 'ended' })];
    repoMock.listByBusId.mockResolvedValue(trips);

    const result = await service.listTripsForBus('bus-001', 'tenant-001');

    expect(repoMock.listByBusId).toHaveBeenCalledWith('bus-001', 'tenant-001', 20);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('trip-001');
  });

  it('listTripsForBus() returns empty array when bus has no trips', async () => {
    repoMock.listByBusId.mockResolvedValue([]);

    const result = await service.listTripsForBus('bus-001', 'tenant-001');

    expect(result).toEqual([]);
  });

  // ── findActiveForBus ─────────────────────────────────────────────────────
  it('findActiveForBus() returns active trip for bus', async () => {
    const trip = makeTrip();
    repoMock.findActiveByBusId.mockResolvedValue(trip);

    const result = await service.findActiveForBus('bus-001', 'tenant-001');

    expect(repoMock.findActiveByBusId).toHaveBeenCalledWith('bus-001', 'tenant-001');
    expect(result).toEqual(trip);
  });

  // ── findTrip ─────────────────────────────────────────────────────────────
  it('findTrip() returns the trip when id and tenantId match', async () => {
    repoMock.findById.mockResolvedValue(makeTrip());

    const result = await service.findTrip('trip-001', 'tenant-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('trip-001');
  });

  it('findTrip() returns null when trip does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    const result = await service.findTrip('missing', 'tenant-001');

    expect(result).toBeNull();
  });

  it('findTrip() returns null when trip belongs to a different tenant (isolation)', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ tenantId: 'tenant-999' }));

    const result = await service.findTrip('trip-001', 'tenant-001');

    expect(result).toBeNull();
  });

  // ── startTrip ────────────────────────────────────────────────────────────
  it('startTrip() creates a new trip and returns it', async () => {
    const created = makeTrip();
    repoMock.findActiveByDriverId.mockResolvedValue(null); // no active trip
    repoMock.create.mockResolvedValue('trip-001');
    repoMock.findById.mockResolvedValue(created);

    const result = await service.startTrip(
      { busId: 'bus-001', routeId: 'route-001' },
      'driver-uid-001',
      'tenant-001',
    );

    expect(repoMock.create).toHaveBeenCalledOnce();
    const createArg = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg['tenantId']).toBe('tenant-001');
    expect(createArg['driverId']).toBe('driver-uid-001');
    expect(createArg['status']).toBe('active');
    expect(result).toEqual(created);
  });

  it('startTrip() throws TRIP_ALREADY_ACTIVE when driver has an active trip', async () => {
    repoMock.findActiveByDriverId.mockResolvedValue(makeTrip());

    await expect(
      service.startTrip({ busId: 'bus-001', routeId: 'route-001' }, 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_ALREADY_ACTIVE');

    expect(repoMock.create).not.toHaveBeenCalled();
  });

  // ── endTrip ──────────────────────────────────────────────────────────────
  it('endTrip() sets status to ended and clears RTDB live location', async () => {
    const active = makeTrip({ status: 'active' });
    const ended  = makeTrip({ status: 'ended', endedAt: Date.now() });
    repoMock.findById
      .mockResolvedValueOnce(active)  // getTrip
      .mockResolvedValueOnce(ended);  // final read
    repoMock.update.mockResolvedValue(undefined);

    const result = await service.endTrip('trip-001', 'driver-uid-001', 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith(
      'trip-001',
      'tenant-001',
      expect.objectContaining({ status: 'ended' }),
    );
    // RTDB node must be cleared
    expect(rtdbMock.ref).toHaveBeenCalledWith('liveLocation/bus-001');
    expect(result.status).toBe('ended');
  });

  it('endTrip() throws TRIP_NOT_FOUND when trip does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(
      service.endTrip('missing', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');
  });

  it('endTrip() throws TRIP_NOT_OWNED when called by a different driver', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ driverId: 'other-driver' }));

    await expect(
      service.endTrip('trip-001', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_OWNED');
  });

  it('endTrip() throws TRIP_ALREADY_ENDED when trip is already ended', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ status: 'ended' }));

    await expect(
      service.endTrip('trip-001', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_ALREADY_ENDED');
  });

  it('endTrip() enforces tenant isolation — throws TRIP_NOT_FOUND for wrong tenant', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ tenantId: 'tenant-999' }));

    await expect(
      service.endTrip('trip-001', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');
  });

  // ── sendSOS ──────────────────────────────────────────────────────────────
  it('sendSOS() sets sosActive=true and returns the updated trip', async () => {
    const active  = makeTrip({ status: 'active' });
    const withSOS = makeTrip({ status: 'active', sosActive: true, sosTriggeredAt: Date.now() });
    repoMock.findById
      .mockResolvedValueOnce(active)    // getTrip inside sendSOS
      .mockResolvedValueOnce(withSOS);  // final read
    repoMock.setSosStatus.mockResolvedValue(undefined);

    const result = await service.sendSOS('trip-001', 'driver-uid-001', 'tenant-001');

    expect(repoMock.setSosStatus).toHaveBeenCalledWith(
      'trip-001',
      'tenant-001',
      true,
      expect.any(Number),
    );
    expect(result.sosActive).toBe(true);
  });

  it('sendSOS() throws TRIP_NOT_FOUND when trip does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(
      service.sendSOS('missing', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');

    expect(repoMock.setSosStatus).not.toHaveBeenCalled();
  });

  it('sendSOS() throws TRIP_NOT_OWNED when called by a different driver', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ driverId: 'other-driver' }));

    await expect(
      service.sendSOS('trip-001', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_OWNED');

    expect(repoMock.setSosStatus).not.toHaveBeenCalled();
  });

  it('sendSOS() throws TRIP_ALREADY_ENDED when trip is ended', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ status: 'ended' }));

    await expect(
      service.sendSOS('trip-001', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_ALREADY_ENDED');

    expect(repoMock.setSosStatus).not.toHaveBeenCalled();
  });

  it('sendSOS() enforces tenant isolation — throws TRIP_NOT_FOUND for wrong tenant', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ tenantId: 'tenant-999' }));

    await expect(
      service.sendSOS('trip-001', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');
  });

  // ── cancelSOS ────────────────────────────────────────────────────────────
  it('cancelSOS() sets sosActive=false and returns the updated trip', async () => {
    const withSOS    = makeTrip({ status: 'active', sosActive: true });
    const sosCleared = makeTrip({ status: 'active', sosActive: false });
    repoMock.findById
      .mockResolvedValueOnce(withSOS)    // getTrip inside cancelSOS
      .mockResolvedValueOnce(sosCleared); // final read
    repoMock.setSosStatus.mockResolvedValue(undefined);

    const result = await service.cancelSOS('trip-001', 'driver-uid-001', 'tenant-001');

    expect(repoMock.setSosStatus).toHaveBeenCalledWith('trip-001', 'tenant-001', false);
    expect(result.sosActive).toBe(false);
  });

  it('cancelSOS() throws TRIP_NOT_FOUND when trip does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(
      service.cancelSOS('missing', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');

    expect(repoMock.setSosStatus).not.toHaveBeenCalled();
  });

  it('cancelSOS() throws TRIP_NOT_OWNED when called by a different driver', async () => {
    repoMock.findById.mockResolvedValue(makeTrip({ driverId: 'other-driver' }));

    await expect(
      service.cancelSOS('trip-001', 'driver-uid-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_OWNED');

    expect(repoMock.setSosStatus).not.toHaveBeenCalled();
  });
});
