import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Trip, Student, BoardingEvent } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — defined before module imports so vi.mock hoisting works
// ---------------------------------------------------------------------------

const tripRepoMock = vi.hoisted(() => ({
  findById: vi.fn(),
}));

const studentRepoMock = vi.hoisted(() => ({
  findById: vi.fn(),
}));

const boardingRepoMock = vi.hoisted(() => ({
  create:                    vi.fn().mockResolvedValue('boarding-001'),
  listByTripId:              vi.fn().mockResolvedValue([]),
  findStudentBoardingInTrip: vi.fn().mockResolvedValue(null),
}));

const notificationMock = vi.hoisted(() => ({
  notifyParentOfStudent: vi.fn().mockResolvedValue(undefined),
}));

const webhookMock = vi.hoisted(() => ({
  deliverEvent: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../src/repositories/student.repository', () => ({
  StudentRepository: vi.fn().mockImplementation(() => studentRepoMock),
}));

vi.mock('../../src/repositories/boarding.repository', () => ({
  BoardingRepository: vi.fn().mockImplementation(() => boardingRepoMock),
}));

vi.mock('../../src/services/notification.service', () => ({
  NotificationService: vi.fn().mockImplementation(() => notificationMock),
}));

vi.mock('../../src/services/webhook.service', () => ({
  WebhookService: vi.fn().mockImplementation(() => webhookMock),
}));

vi.mock('@saferide/firebase-admin', () => ({
  getRtdb:          vi.fn().mockReturnValue(rtdbMock),
  getDb:            vi.fn(),
  initFirebaseAdmin: vi.fn(),
}));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { BoardingService } from '../../src/services/boarding.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-001', tenantId: 'tenant-001', driverId: 'driver-001',
    busId: 'bus-001', routeId: 'route-001', status: 'active',
    startedAt: 1700000000000, createdAt: 1700000000000, updatedAt: 1700000000000,
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

function makeBoardingEvent(overrides: Partial<BoardingEvent> = {}): BoardingEvent {
  return {
    id: 'boarding-001', tenantId: 'tenant-001', tripId: 'trip-001',
    studentId: 'student-001', busId: 'bus-001', stopId: 'stop-001',
    eventType: 'boarded', method: 'manual',
    recordedAt: 1700000100000, createdAt: 1700000100000,
    ...overrides,
  };
}

const BOARD_INPUT = {
  studentId:  'student-001',
  stopId:     'stop-001',
  eventType:  'boarded' as const,
  method:     'manual' as const,
  recordedAt: 1700000100000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardingService', () => {
  let service: BoardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    rtdbMock.ref.mockReturnValue(rtdbRefMock);
    tripRepoMock.findById.mockResolvedValue(makeTrip());
    studentRepoMock.findById.mockResolvedValue(makeStudent());
    service = new BoardingService();
  });

  // ── recordBoarding — happy path ────────────────────────────────────────────

  it('records a boarding event and returns the created id', async () => {
    boardingRepoMock.findStudentBoardingInTrip.mockResolvedValue(null); // not already boarded

    const id = await service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001');

    expect(id).toBe('boarding-001');
    expect(boardingRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId:    'trip-001',
        studentId: 'student-001',
        busId:     'bus-001',
        eventType: 'boarded',
        method:    'manual',
      }),
      'tenant-001',
    );
  });

  it('writes RTDB boardingStatus on board event', async () => {
    boardingRepoMock.findStudentBoardingInTrip.mockResolvedValue(null);

    await service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001');

    expect(rtdbMock.ref).toHaveBeenCalledWith('boardingStatus/bus-001/student-001');
    expect(rtdbRefMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status:  'boarded',
        tripId:  'trip-001',
        stopId:  'stop-001',
      }),
    );
  });

  it('notifies parent and fires student.boarded webhook', async () => {
    boardingRepoMock.findStudentBoardingInTrip.mockResolvedValue(null);

    await service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001');

    expect(notificationMock.notifyParentOfStudent).toHaveBeenCalledWith(
      'parent-uid-001', 'tenant-001', expect.any(String), expect.any(String),
    );
    expect(webhookMock.deliverEvent).toHaveBeenCalledWith(
      'student.boarded',
      expect.objectContaining({ tripId: 'trip-001', studentId: 'student-001', busId: 'bus-001' }),
      'tenant-001',
    );
  });

  it('fires student.deboarded webhook for a deboard event', async () => {
    const input = { ...BOARD_INPUT, eventType: 'deboarded' as const };

    await service.recordBoarding('trip-001', input, 'driver-001', 'tenant-001');

    expect(webhookMock.deliverEvent).toHaveBeenCalledWith(
      'student.deboarded',
      expect.objectContaining({ tripId: 'trip-001', studentId: 'student-001' }),
      'tenant-001',
    );
  });

  // ── recordBoarding — error paths ───────────────────────────────────────────

  it('throws TRIP_NOT_FOUND when trip does not exist', async () => {
    tripRepoMock.findById.mockResolvedValue(null);

    await expect(
      service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_FOUND');

    expect(boardingRepoMock.create).not.toHaveBeenCalled();
  });

  it('throws TRIP_NOT_ACTIVE when trip is ended', async () => {
    tripRepoMock.findById.mockResolvedValue(makeTrip({ status: 'ended' }));

    await expect(
      service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_ACTIVE');
  });

  it('throws TRIP_NOT_OWNED when driverId does not match', async () => {
    tripRepoMock.findById.mockResolvedValue(makeTrip({ driverId: 'other-driver' }));

    await expect(
      service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001'),
    ).rejects.toThrow('TRIP_NOT_OWNED');
  });

  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    studentRepoMock.findById.mockResolvedValue(null);

    await expect(
      service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001'),
    ).rejects.toThrow('STUDENT_NOT_FOUND');
  });

  it('throws STUDENT_NOT_ON_BUS when student.busId does not match trip.busId', async () => {
    studentRepoMock.findById.mockResolvedValue(makeStudent({ busId: 'bus-999' }));

    await expect(
      service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001'),
    ).rejects.toThrow('STUDENT_NOT_ON_BUS');
  });

  it('throws ALREADY_BOARDED when student is currently boarded on this trip', async () => {
    boardingRepoMock.findStudentBoardingInTrip.mockResolvedValue(
      makeBoardingEvent({ eventType: 'boarded' }),
    );

    await expect(
      service.recordBoarding('trip-001', BOARD_INPUT, 'driver-001', 'tenant-001'),
    ).rejects.toThrow('ALREADY_BOARDED');
  });

  // ── sweepOnTripEnd ─────────────────────────────────────────────────────────

  it('deboard all students still boarded at trip end', async () => {
    // repo returns events DESC by createdAt — deboard(s2) is newest, board(s1) is oldest
    // Net state: s1=boarded (sweep must deboard), s2=deboarded (already off, skip)
    boardingRepoMock.listByTripId.mockResolvedValue([
      makeBoardingEvent({ id: 'b3', studentId: 'student-002', eventType: 'deboarded', createdAt: 1700000300000 }),
      makeBoardingEvent({ id: 'b2', studentId: 'student-002', eventType: 'boarded',   createdAt: 1700000200000 }),
      makeBoardingEvent({ studentId: 'student-001', eventType: 'boarded',             createdAt: 1700000100000 }),
    ]);
    studentRepoMock.findById.mockResolvedValue(makeStudent());

    await service.sweepOnTripEnd('trip-001', 'bus-001', 'tenant-001');

    // Only student-001 is still boarded → one deboard event + one notification
    expect(notificationMock.notifyParentOfStudent).toHaveBeenCalledOnce();
    expect(webhookMock.deliverEvent).toHaveBeenCalledWith(
      'student.deboarded',
      expect.objectContaining({ studentId: 'student-001' }),
      'tenant-001',
    );
  });

  it('clears the entire RTDB boardingStatus/{busId} node when trip ends', async () => {
    boardingRepoMock.listByTripId.mockResolvedValue([]); // no one boarded — still clears RTDB

    await service.sweepOnTripEnd('trip-001', 'bus-001', 'tenant-001');

    expect(rtdbMock.ref).toHaveBeenCalledWith('boardingStatus/bus-001');
    expect(rtdbRefMock.remove).toHaveBeenCalledOnce();
  });
});
