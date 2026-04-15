import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Trip } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — defined before module imports so vi.mock hoisting works
// ---------------------------------------------------------------------------

const tripRepoMock = vi.hoisted(() => ({
  update: vi.fn().mockResolvedValue(undefined),
}));

const notificationMock = vi.hoisted(() => ({
  notifyManagersOfTenant: vi.fn().mockResolvedValue(undefined),
  notifyParentsOfBus:     vi.fn().mockResolvedValue(undefined),
}));

const webhookMock = vi.hoisted(() => ({
  deliverEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/repositories/trip.repository', () => ({
  TripRepository: vi.fn().mockImplementation(() => tripRepoMock),
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

import { SpeedAlertService } from '../../src/services/speed-alert.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = 1700000300_000; // arbitrary fixed timestamp

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-001', tenantId: 'tenant-001', driverId: 'driver-001',
    busId: 'bus-001', routeId: 'route-001', status: 'active',
    startedAt: 1700000000000, createdAt: 1700000000000, updatedAt: 1700000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpeedAlertService', () => {
  let service: SpeedAlertService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    service = new SpeedAlertService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Speeding alerts ────────────────────────────────────────────────────────

  it('alerts managers and parents when speed > 60 and cooldown has expired', async () => {
    // lastSpeedingAlertAt is undefined → cooldown elapsed
    const trip = makeTrip();

    await service.check(trip, 65, 'tenant-001');

    expect(tripRepoMock.update).toHaveBeenCalledWith(
      'trip-001', 'tenant-001',
      expect.objectContaining({ lastSpeedingAlertAt: NOW }),
    );
    expect(notificationMock.notifyManagersOfTenant).toHaveBeenCalledWith(
      'tenant-001', expect.any(String), expect.any(String),
    );
    expect(notificationMock.notifyParentsOfBus).toHaveBeenCalledWith(
      'bus-001', 'tenant-001', expect.any(String), expect.any(String),
    );
    expect(webhookMock.deliverEvent).toHaveBeenCalledWith(
      'bus.speeding',
      expect.objectContaining({ tripId: 'trip-001', busId: 'bus-001', speed: 65 }),
      'tenant-001',
    );
  });

  it('does NOT re-alert speeding when within 5-minute cooldown', async () => {
    // Last alert sent 2 minutes ago — still inside 300 s cooldown
    const trip = makeTrip({ lastSpeedingAlertAt: NOW - 120_000 });

    await service.check(trip, 70, 'tenant-001');

    expect(notificationMock.notifyManagersOfTenant).not.toHaveBeenCalled();
    expect(notificationMock.notifyParentsOfBus).not.toHaveBeenCalled();
    expect(webhookMock.deliverEvent).not.toHaveBeenCalled();
    expect(tripRepoMock.update).not.toHaveBeenCalled();
  });

  it('alerts again when cooldown has fully elapsed (> 300 s since last alert)', async () => {
    // Last alert sent 6 minutes ago — cooldown expired
    const trip = makeTrip({ lastSpeedingAlertAt: NOW - 360_000 });

    await service.check(trip, 65, 'tenant-001');

    expect(notificationMock.notifyManagersOfTenant).toHaveBeenCalledOnce();
  });

  it('does NOT alert when speed is exactly 60 km/h (threshold is strictly > 60)', async () => {
    const trip = makeTrip();

    await service.check(trip, 60, 'tenant-001');

    expect(notificationMock.notifyManagersOfTenant).not.toHaveBeenCalled();
    expect(notificationMock.notifyParentsOfBus).not.toHaveBeenCalled();
  });

  // ── Rash-driving alerts ────────────────────────────────────────────────────

  it('detects rash driving when speed delta > 20 km/h', async () => {
    // latestSpeed = 10, currentSpeed = 35 → delta = 25 → rash driving
    const trip = makeTrip({ latestSpeed: 10 });

    await service.check(trip, 35, 'tenant-001');

    expect(tripRepoMock.update).toHaveBeenCalledWith(
      'trip-001', 'tenant-001',
      expect.objectContaining({ lastRashDrivingAlertAt: NOW }),
    );
    expect(notificationMock.notifyManagersOfTenant).toHaveBeenCalledWith(
      'tenant-001', expect.any(String), expect.any(String),
    );
    expect(webhookMock.deliverEvent).toHaveBeenCalledWith(
      'bus.rash_driving',
      expect.objectContaining({ tripId: 'trip-001', busId: 'bus-001', speedDelta: 25 }),
      'tenant-001',
    );
  });

  it('does NOT alert for rash driving when there is no previous speed (first ping)', async () => {
    // latestSpeed undefined → cannot compute delta
    const trip = makeTrip();

    await service.check(trip, 40, 'tenant-001');

    expect(webhookMock.deliverEvent).not.toHaveBeenCalledWith(
      'bus.rash_driving', expect.anything(), expect.anything(),
    );
  });

  it('does NOT re-alert rash driving within 5-minute cooldown', async () => {
    const trip = makeTrip({ latestSpeed: 5, lastRashDrivingAlertAt: NOW - 60_000 });

    await service.check(trip, 30, 'tenant-001');

    expect(webhookMock.deliverEvent).not.toHaveBeenCalledWith(
      'bus.rash_driving', expect.anything(), expect.anything(),
    );
  });

  it('rash driving notifies managers only — does NOT push to parents', async () => {
    const trip = makeTrip({ latestSpeed: 5 });

    await service.check(trip, 30, 'tenant-001');

    // Rash driving → managers only
    expect(notificationMock.notifyManagersOfTenant).toHaveBeenCalledOnce();
    // Parents NOT notified for rash driving (only for speeding)
    expect(notificationMock.notifyParentsOfBus).not.toHaveBeenCalled();
  });

  it('fires both speeding and rash-driving webhooks when both conditions hit simultaneously', async () => {
    // Speed 65 (speeding) AND delta from 5 is 60 (rash driving)
    const trip = makeTrip({ latestSpeed: 5 });

    await service.check(trip, 65, 'tenant-001');

    const events = webhookMock.deliverEvent.mock.calls.map((c) => c[0] as string);
    expect(events).toContain('bus.speeding');
    expect(events).toContain('bus.rash_driving');
  });

  it('does not throw when tripRepo.update throws (fire-and-forget resilience)', async () => {
    tripRepoMock.update.mockRejectedValue(new Error('Firestore unavailable'));
    const trip = makeTrip();

    await expect(service.check(trip, 65, 'tenant-001')).resolves.toBeUndefined();
  });
});
