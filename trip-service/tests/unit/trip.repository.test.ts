import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Trip } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------

const {
  mockDocRef,
  mockCol,
  mockDb,
} = vi.hoisted(() => {
  const mockDocRef = {
    get:    vi.fn(),
    update: vi.fn(),
  };

  const mockCol = {
    where:   vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit:   vi.fn().mockReturnThis(),
    get:     vi.fn(),
    doc:     vi.fn().mockReturnValue(mockDocRef),
    add:     vi.fn(),
  };

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCol),
  };

  return { mockDocRef, mockCol, mockDb };
});

vi.mock('@saferide/firebase-admin', () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  auditLog: vi.fn(),
}));

import { TripRepository } from '../../src/repositories/trip.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTripData(overrides: Partial<Trip> = {}): Record<string, unknown> {
  return {
    tenantId:  'tenant-001',
    driverId:  'driver-001',
    busId:     'bus-001',
    routeId:   'route-001',
    status:    'active',
    startedAt: 1700000000000,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function snapOf(docs: { id: string; data: () => Record<string, unknown> }[]) {
  return { docs, empty: docs.length === 0 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TripRepository', () => {
  let repo: TripRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCol.where.mockReturnThis();
    mockCol.orderBy.mockReturnThis();
    mockCol.limit.mockReturnThis();
    mockCol.doc.mockReturnValue(mockDocRef);
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => undefined });
    mockDocRef.update.mockResolvedValue(undefined);
    mockCol.add.mockResolvedValue({ id: 'new-trip-id' });
    mockCol.get.mockResolvedValue(snapOf([]));
    repo = new TripRepository();
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns trip when doc exists and tenantId matches', async () => {
      const data = makeTripData({ tenantId: 'tenant-001' });
      mockDocRef.get.mockResolvedValue({ exists: true, id: 'trip-001', data: () => data });

      const result = await repo.findById('trip-001', 'tenant-001');

      expect(result).toMatchObject({ id: 'trip-001', tenantId: 'tenant-001' });
    });

    it('returns null when doc does not exist', async () => {
      mockDocRef.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await repo.findById('trip-missing', 'tenant-001');
      expect(result).toBeNull();
    });

    it('returns null when tenantId does not match (cross-tenant guard)', async () => {
      const data = makeTripData({ tenantId: 'tenant-999' });
      mockDocRef.get.mockResolvedValue({ exists: true, id: 'trip-001', data: () => data });

      const result = await repo.findById('trip-001', 'tenant-001');
      expect(result).toBeNull();
    });
  });

  // ── listByDriverId ──────────────────────────────────────────────────────────

  describe('listByDriverId()', () => {
    it('returns trips for the driver', async () => {
      const data = makeTripData();
      mockCol.get.mockResolvedValue(snapOf([{ id: 'trip-001', data: () => data }]));

      const result = await repo.listByDriverId('driver-001', 'tenant-001');

      expect(result).toHaveLength(1);
      expect(result[0]!.driverId).toBe('driver-001');
    });

    it('returns empty array when no trips found', async () => {
      mockCol.get.mockResolvedValue(snapOf([]));
      const result = await repo.listByDriverId('driver-001', 'tenant-001');
      expect(result).toEqual([]);
    });
  });

  // ── findActiveByDriverId ────────────────────────────────────────────────────

  describe('findActiveByDriverId()', () => {
    it('returns the active trip for a driver', async () => {
      const data = makeTripData({ status: 'active' });
      mockCol.get.mockResolvedValue(snapOf([{ id: 'trip-001', data: () => data }]));

      const result = await repo.findActiveByDriverId('driver-001', 'tenant-001');

      expect(result).toMatchObject({ status: 'active' });
    });

    it('returns null when no active trip', async () => {
      mockCol.get.mockResolvedValue(snapOf([]));
      const result = await repo.findActiveByDriverId('driver-001', 'tenant-001');
      expect(result).toBeNull();
    });
  });

  // ── listByBusId ─────────────────────────────────────────────────────────────

  describe('listByBusId()', () => {
    it('returns trips for the bus', async () => {
      const data = makeTripData({ busId: 'bus-001' });
      mockCol.get.mockResolvedValue(snapOf([{ id: 'trip-001', data: () => data }]));

      const result = await repo.listByBusId('bus-001', 'tenant-001');

      expect(result).toHaveLength(1);
      expect(result[0]!.busId).toBe('bus-001');
    });
  });

  // ── findActiveByBusId ───────────────────────────────────────────────────────

  describe('findActiveByBusId()', () => {
    it('returns the active trip for a bus', async () => {
      const data = makeTripData({ busId: 'bus-001', status: 'active' });
      mockCol.get.mockResolvedValue(snapOf([{ id: 'trip-001', data: () => data }]));

      const result = await repo.findActiveByBusId('bus-001', 'tenant-001');

      expect(result).toMatchObject({ busId: 'bus-001', status: 'active' });
    });

    it('returns null when no active trip for the bus', async () => {
      mockCol.get.mockResolvedValue(snapOf([]));
      const result = await repo.findActiveByBusId('bus-001', 'tenant-001');
      expect(result).toBeNull();
    });
  });

  // ── listAll ─────────────────────────────────────────────────────────────────

  describe('listAll()', () => {
    it('returns trips across all tenants', async () => {
      const d1 = makeTripData({ tenantId: 'tenant-001' });
      const d2 = makeTripData({ tenantId: 'tenant-002' });
      mockCol.get.mockResolvedValue(snapOf([
        { id: 'trip-001', data: () => d1 },
        { id: 'trip-002', data: () => d2 },
      ]));

      const result = await repo.listAll();

      expect(result).toHaveLength(2);
    });
  });

  // ── listByTenant ────────────────────────────────────────────────────────────

  describe('listByTenant()', () => {
    it('returns trips for a specific tenant', async () => {
      const data = makeTripData({ tenantId: 'tenant-001' });
      mockCol.get.mockResolvedValue(snapOf([{ id: 'trip-001', data: () => data }]));

      const result = await repo.listByTenant('tenant-001');

      expect(result).toHaveLength(1);
      expect(result[0]!.tenantId).toBe('tenant-001');
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('adds a document and returns the new ID', async () => {
      mockCol.add.mockResolvedValue({ id: 'trip-new' });

      const id = await repo.create(makeTripData() as never);

      expect(mockCol.add).toHaveBeenCalledOnce();
      expect(id).toBe('trip-new');
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('patches the trip document with the provided fields', async () => {
      mockDocRef.get.mockResolvedValue({ exists: true, id: 'trip-001', data: () => makeTripData() });
      mockDocRef.update.mockResolvedValue(undefined);

      await repo.update('trip-001', 'tenant-001', { status: 'ended', endedAt: 1700000010000 });

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ended', endedAt: 1700000010000 }),
      );
    });

    it('filters out undefined values from the patch', async () => {
      mockDocRef.get.mockResolvedValue({ exists: true, id: 'trip-001', data: () => makeTripData() });
      mockDocRef.update.mockResolvedValue(undefined);

      await repo.update('trip-001', 'tenant-001', { status: 'ended', endedAt: undefined });

      const callArg = mockDocRef.update.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg).not.toHaveProperty('endedAt');
    });
  });

  // ── setSosStatus ─────────────────────────────────────────────────────────────

  describe('setSosStatus()', () => {
    it('sets sosActive = true and records sosTriggeredAt', async () => {
      mockDocRef.get.mockResolvedValue({ exists: true, id: 'trip-001', data: () => makeTripData() });
      mockDocRef.update.mockResolvedValue(undefined);

      await repo.setSosStatus('trip-001', 'tenant-001', true, 1700000005000);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ sosActive: true, sosTriggeredAt: 1700000005000 }),
      );
    });

    it('sets sosActive = false without sosTriggeredAt', async () => {
      mockDocRef.get.mockResolvedValue({ exists: true, id: 'trip-001', data: () => makeTripData() });
      mockDocRef.update.mockResolvedValue(undefined);

      await repo.setSosStatus('trip-001', 'tenant-001', false);

      const callArg = mockDocRef.update.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg['sosActive']).toBe(false);
      expect(callArg).not.toHaveProperty('sosTriggeredAt');
    });
  });
});
