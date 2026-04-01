import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bus } from '@saferide/types';

// ---------------------------------------------------------------------------
// Use vi.hoisted so all mock refs are available inside vi.mock factories
// ---------------------------------------------------------------------------
const { mockDocRef, mockCollection } = vi.hoisted(() => {
  const mockDocRef = {
    get:    vi.fn(),
    update: vi.fn(),
  };
  const mockCollection = {
    where:   vi.fn(),
    orderBy: vi.fn(),
    get:     vi.fn(),
    doc:     vi.fn().mockReturnValue(mockDocRef),
    add:     vi.fn(),
  };
  mockCollection.where.mockReturnValue(mockCollection);
  mockCollection.orderBy.mockReturnValue(mockCollection);
  return { mockDocRef, mockCollection };
});

vi.mock('@saferide/firebase-admin', () => ({
  getDb: vi.fn(() => ({
    collection: vi.fn(() => mockCollection),
  })),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { BusRepository } from '../../src/repositories/bus.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBusData(tenantId = 'tenant-001'): Omit<Bus, 'id'> {
  return {
    tenantId,
    registrationNumber: 'KA01AB1234',
    make:               'Tata',
    model:              'Starbus',
    year:               2020,
    capacity:           40,
    driverId:           null,
    routeId:            null,
    status:             'active',
    createdAt:          1700000000000,
    updatedAt:          1700000000000,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('BusRepository', () => {
  let repo: BusRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.where.mockReturnValue(mockCollection);
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDocRef);
    repo = new BusRepository();
  });

  // ── listByTenantId ────────────────────────────────────────────────────────
  it('listByTenantId() queries with tenantId filter and orderBy createdAt desc', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });

    await repo.listByTenantId('tenant-001');

    expect(mockCollection.where).toHaveBeenCalledWith('tenantId', '==', 'tenant-001');
    expect(mockCollection.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockCollection.get).toHaveBeenCalledOnce();
  });

  it('listByTenantId() returns empty array when no documents exist', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });

    const result = await repo.listByTenantId('tenant-001');

    expect(result).toEqual([]);
  });

  it('listByTenantId() maps each document to a Bus', async () => {
    const data = makeBusData();
    mockCollection.get.mockResolvedValue({
      docs: [{ id: 'bus-001', data: () => data, exists: true }],
    });

    const result = await repo.listByTenantId('tenant-001');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'bus-001', registrationNumber: 'KA01AB1234' });
  });

  // ── findById ──────────────────────────────────────────────────────────────
  it('findById() returns null when document does not exist', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, id: 'missing', data: () => undefined });

    const result = await repo.findById('missing-id', 'tenant-001');

    expect(result).toBeNull();
  });

  it('findById() returns a parsed Bus when document exists', async () => {
    const data = makeBusData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'bus-001', data: () => data });

    const result = await repo.findById('bus-001', 'tenant-001');

    expect(result).toMatchObject({ id: 'bus-001', registrationNumber: 'KA01AB1234' });
  });

  // ── create ────────────────────────────────────────────────────────────────
  it('create() calls collection.add() with data and returns the new ID', async () => {
    mockCollection.add.mockResolvedValue({ id: 'new-bus-id' });

    const data = makeBusData();
    const id   = await repo.create(data);

    expect(mockCollection.add).toHaveBeenCalledWith(data);
    expect(id).toBe('new-bus-id');
  });

  // ── update ────────────────────────────────────────────────────────────────
  it('update() calls doc.update() with the given fields plus updatedAt', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    await repo.update('bus-001', 'tenant-001', { capacity: 45 });

    expect(mockCollection.doc).toHaveBeenCalledWith('bus-001');
    expect(mockDocRef.update).toHaveBeenCalledWith({
      capacity:  45,
      updatedAt: expect.any(Number),
    });
  });

  it('update() always sets a fresh updatedAt timestamp', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    const before = Date.now();
    await repo.update('bus-001', 'tenant-001', { capacity: 45 });
    const after = Date.now();

    const callArg = mockDocRef.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArg['updatedAt']).toBeGreaterThanOrEqual(before);
    expect(callArg['updatedAt']).toBeLessThanOrEqual(after);
  });

  it('update() passes null driverId through to Firestore (does not filter nulls)', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    await repo.update('bus-001', 'tenant-001', { driverId: null });

    const callArg = mockDocRef.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArg['driverId']).toBeNull();
  });
});
