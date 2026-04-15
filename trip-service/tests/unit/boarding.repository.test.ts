import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BoardingEvent } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — Firestore Admin SDK
// All chainable mock state must be defined inside vi.hoisted so it is
// available when vi.mock() factories run (they hoist above module evaluation).
// ---------------------------------------------------------------------------

const getMock = vi.hoisted(() => vi.fn());
const addMock = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'boarding-doc-001' }));

/**
 * Chainable Firestore query mock.
 * Every chaining method returns the same object so code like
 * `.where(...).where(...).orderBy(...).limit(...).get()` works.
 */
const queryChain = vi.hoisted(() => {
  const chain: Record<string, unknown> = {
    where:   vi.fn(),
    orderBy: vi.fn(),
    limit:   vi.fn(),
    get:     getMock,
    add:     addMock,
  };
  (chain['where']   as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['orderBy'] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain['limit']   as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
});

const dbMock = vi.hoisted(() => ({
  collection: vi.fn().mockReturnValue(queryChain),
}));

vi.mock('@saferide/firebase-admin', () => ({
  getDb:             vi.fn().mockReturnValue(dbMock),
  initFirebaseAdmin: vi.fn(),
}));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { BoardingRepository } from '../../src/repositories/boarding.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoardingDoc(overrides: Partial<BoardingEvent> = {}): BoardingEvent {
  return {
    id:         'boarding-doc-001',
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

function makeFirestoreDoc(data: BoardingEvent) {
  return { id: data.id, data: () => ({ ...data }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardingRepository', () => {
  let repo: BoardingRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore chain mock behaviour after clearAllMocks resets .mockReturnValue calls
    dbMock.collection.mockReturnValue(queryChain);
    (queryChain['where']   as ReturnType<typeof vi.fn>).mockReturnValue(queryChain);
    (queryChain['orderBy'] as ReturnType<typeof vi.fn>).mockReturnValue(queryChain);
    (queryChain['limit']   as ReturnType<typeof vi.fn>).mockReturnValue(queryChain);
    addMock.mockResolvedValue({ id: 'boarding-doc-001' });
    repo = new BoardingRepository();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  it('create: persists a boarding event document and returns the generated id', async () => {
    addMock.mockResolvedValue({ id: 'boarding-doc-001' });

    const data = makeBoardingDoc();
    const id   = await repo.create(data, 'tenant-001');

    expect(id).toBe('boarding-doc-001');
    expect(dbMock.collection).toHaveBeenCalledWith('boardingEvents');
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId:  'tenant-001',
        tripId:    'trip-001',
        studentId: 'student-001',
        eventType: 'boarded',
      }),
    );
  });

  // ── listByTripId ───────────────────────────────────────────────────────────

  it('listByTripId: returns all events for a trip ordered by createdAt desc', async () => {
    const events = [
      makeBoardingDoc({ id: 'b1', eventType: 'boarded',   createdAt: 1700000100000 }),
      makeBoardingDoc({ id: 'b2', eventType: 'deboarded', createdAt: 1700000200000 }),
    ];
    getMock.mockResolvedValue({
      empty: false,
      docs:  events.map(makeFirestoreDoc),
    });

    const result = await repo.listByTripId('trip-001', 'tenant-001');

    expect(result).toHaveLength(2);
    expect(result[0]!.eventType).toBe('boarded');
    expect(result[1]!.eventType).toBe('deboarded');

    // Verify tenant isolation — where() must filter by tenantId and tripId
    const whereCalls = (queryChain['where'] as ReturnType<typeof vi.fn>).mock.calls as Array<[string, string, string]>;
    expect(whereCalls.some(([f]) => f === 'tenantId')).toBe(true);
    expect(whereCalls.some(([f]) => f === 'tripId')).toBe(true);
  });

  it('listByTripId: returns empty array when no events exist', async () => {
    getMock.mockResolvedValue({ empty: true, docs: [] });

    const result = await repo.listByTripId('trip-001', 'tenant-001');

    expect(result).toEqual([]);
  });

  // ── findStudentBoardingInTrip ──────────────────────────────────────────────

  it('findStudentBoardingInTrip: returns the open boarding event when student is boarded', async () => {
    const event = makeBoardingDoc({ eventType: 'boarded' });
    getMock.mockResolvedValue({
      empty: false,
      docs:  [makeFirestoreDoc(event)],
    });

    const result = await repo.findStudentBoardingInTrip(
      'trip-001', 'student-001', 'boarded', 'tenant-001',
    );

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('boarded');
    expect(result!.studentId).toBe('student-001');
  });

  it('findStudentBoardingInTrip: returns null when no matching event exists', async () => {
    getMock.mockResolvedValue({ empty: true, docs: [] });

    const result = await repo.findStudentBoardingInTrip(
      'trip-001', 'student-001', 'boarded', 'tenant-001',
    );

    expect(result).toBeNull();
  });
});
