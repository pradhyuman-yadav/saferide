import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Trip, Stop, Student } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — defined before module imports so vi.mock hoisting works
// ---------------------------------------------------------------------------

const tripRepoMock = vi.hoisted(() => ({
  addAlertedStopId: vi.fn().mockResolvedValue(undefined),
}));

const stopRepoMock = vi.hoisted(() => ({
  listByRouteId: vi.fn(),
}));

const studentRepoMock = vi.hoisted(() => ({
  listByStopId: vi.fn(),
}));

const notificationMock = vi.hoisted(() => ({
  notifyParentsAtStop: vi.fn().mockResolvedValue(undefined),
}));

const webhookMock = vi.hoisted(() => ({
  deliverEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/repositories/trip.repository', () => ({
  TripRepository: vi.fn().mockImplementation(() => tripRepoMock),
}));

vi.mock('../../src/repositories/stop.repository', () => ({
  StopRepository: vi.fn().mockImplementation(() => stopRepoMock),
}));

vi.mock('../../src/repositories/student.repository', () => ({
  StudentRepository: vi.fn().mockImplementation(() => studentRepoMock),
}));

vi.mock('../../src/services/notification.service', () => ({
  NotificationService: vi.fn().mockImplementation(() => notificationMock),
}));

vi.mock('../../src/services/webhook.service', () => ({
  WebhookService: vi.fn().mockImplementation(() => webhookMock),
}));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { GeofenceService } from '../../src/services/geofence.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-001', tenantId: 'tenant-001', driverId: 'driver-001',
    busId: 'bus-001', routeId: 'route-001', status: 'active',
    startedAt: 1700000000000, createdAt: 1700000000000, updatedAt: 1700000000000,
    alertedStopIds: [],
    ...overrides,
  };
}

function makeStop(overrides: Partial<Stop> = {}): Stop {
  return {
    id: 'stop-001', tenantId: 'tenant-001', routeId: 'route-001',
    name: 'Green Park', sequence: 1,
    // ~900 m from the bus position used in tests
    lat: 12.9716, lon: 77.6180,
    estimatedOffsetMinutes: 5,
    createdAt: 1700000000000, updatedAt: 1700000000000,
    ...overrides,
  };
}

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-001', tenantId: 'tenant-001', name: 'Arjun',
    parentFirebaseUid: 'parent-uid-001', parentName: 'Priya',
    parentPhone: '9999999999', parentEmail: 'priya@example.com',
    busId: 'bus-001', stopId: 'stop-001', isActive: true,
    createdAt: 1700000000000, updatedAt: 1700000000000,
    ...overrides,
  };
}

// Bus position: Bengaluru MG Road area — ~900 m from makeStop's coordinates
const BUS_LAT = 12.9716;
const BUS_LON = 77.6099;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GeofenceService', () => {
  let service: GeofenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GeofenceService();
  });

  it('sends notification when bus is within 1000 m of an unalerted stop', async () => {
    const stop = makeStop(); // ~900 m from bus
    const student = makeStudent();
    stopRepoMock.listByRouteId.mockResolvedValue([stop]);
    studentRepoMock.listByStopId.mockResolvedValue([student]);

    await service.check(makeTrip({ alertedStopIds: [] }), BUS_LAT, BUS_LON, 'tenant-001');

    expect(notificationMock.notifyParentsAtStop).toHaveBeenCalledWith(
      stop.id, stop.name, 'tenant-001',
      expect.any(String), expect.any(String),
    );
    expect(tripRepoMock.addAlertedStopId).toHaveBeenCalledWith('trip-001', 'tenant-001', stop.id);
    expect(webhookMock.deliverEvent).toHaveBeenCalledWith(
      'bus.approaching_stop',
      expect.objectContaining({ tripId: 'trip-001', stopId: stop.id }),
      'tenant-001',
    );
  });

  it('does NOT alert a stop already in alertedStopIds', async () => {
    const stop = makeStop(); // within range
    stopRepoMock.listByRouteId.mockResolvedValue([stop]);
    studentRepoMock.listByStopId.mockResolvedValue([makeStudent()]);

    // Stop already alerted
    await service.check(makeTrip({ alertedStopIds: ['stop-001'] }), BUS_LAT, BUS_LON, 'tenant-001');

    expect(notificationMock.notifyParentsAtStop).not.toHaveBeenCalled();
    expect(tripRepoMock.addAlertedStopId).not.toHaveBeenCalled();
    expect(webhookMock.deliverEvent).not.toHaveBeenCalled();
  });

  it('does NOT alert when bus is more than 1000 m from all stops', async () => {
    // Stop 20 km away from bus position
    const farStop = makeStop({ lat: 13.0827, lon: 77.6099 });
    stopRepoMock.listByRouteId.mockResolvedValue([farStop]);

    await service.check(makeTrip({ alertedStopIds: [] }), BUS_LAT, BUS_LON, 'tenant-001');

    expect(notificationMock.notifyParentsAtStop).not.toHaveBeenCalled();
    expect(tripRepoMock.addAlertedStopId).not.toHaveBeenCalled();
  });

  it('alerts each in-range stop independently and skips already-alerted ones', async () => {
    const nearStop = makeStop({ id: 'stop-001', lat: 12.9716, lon: 77.6180 }); // ~900 m
    const farStop  = makeStop({ id: 'stop-002', lat: 13.0827, lon: 77.6099 }); // ~20 km
    stopRepoMock.listByRouteId.mockResolvedValue([nearStop, farStop]);
    studentRepoMock.listByStopId.mockResolvedValue([makeStudent()]);

    await service.check(makeTrip({ alertedStopIds: [] }), BUS_LAT, BUS_LON, 'tenant-001');

    // Only near stop alerted
    expect(tripRepoMock.addAlertedStopId).toHaveBeenCalledOnce();
    expect(tripRepoMock.addAlertedStopId).toHaveBeenCalledWith('trip-001', 'tenant-001', 'stop-001');
    expect(notificationMock.notifyParentsAtStop).toHaveBeenCalledOnce();
  });

  it('delivers bus.approaching_stop webhook with correct payload (no GPS coords)', async () => {
    const stop = makeStop();
    stopRepoMock.listByRouteId.mockResolvedValue([stop]);
    studentRepoMock.listByStopId.mockResolvedValue([makeStudent()]);

    await service.check(makeTrip({ alertedStopIds: [] }), BUS_LAT, BUS_LON, 'tenant-001');

    // lat/lon intentionally excluded from webhook payload (DPDP 2023 — GPS coords
    // are sensitive personal data and must not be sent to third-party webhook URLs).
    expect(webhookMock.deliverEvent).toHaveBeenCalledWith(
      'bus.approaching_stop',
      {
        tripId:   'trip-001',
        busId:    'bus-001',
        stopId:   stop.id,
        stopName: stop.name,
      },
      'tenant-001',
    );
    // Verify lat/lon are NOT present in the payload
    const payload = webhookMock.deliverEvent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('lat');
    expect(payload).not.toHaveProperty('lon');
  });

  it('does not throw when stopRepo throws (fire-and-forget resilience)', async () => {
    stopRepoMock.listByRouteId.mockRejectedValue(new Error('Firestore unavailable'));

    // Must not throw — the caller fires this method without await
    await expect(
      service.check(makeTrip(), BUS_LAT, BUS_LON, 'tenant-001'),
    ).resolves.toBeUndefined();
  });

  it('uses stop cache — only fetches stops once per routeId', async () => {
    const stop = makeStop();
    stopRepoMock.listByRouteId.mockResolvedValue([stop]);
    studentRepoMock.listByStopId.mockResolvedValue([]);

    const trip = makeTrip({ alertedStopIds: [] });

    await service.check(trip, BUS_LAT, BUS_LON, 'tenant-001');
    await service.check(trip, BUS_LAT, BUS_LON, 'tenant-001');

    // Second call should use cache — repo only called once
    expect(stopRepoMock.listByRouteId).toHaveBeenCalledOnce();
  });
});
