import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Stop } from '@saferide/types';

// ---------------------------------------------------------------------------
const { mockDocRef, mockCollection } = vi.hoisted(() => {
  const mockDocRef   = { get: vi.fn(), update: vi.fn(), delete: vi.fn() };
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
  getDb: vi.fn(() => ({ collection: vi.fn(() => mockCollection) })),
}));

vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }, auditLog: vi.fn(),
}));

import { StopRepository } from '../../src/repositories/stop.repository';

// ---------------------------------------------------------------------------
function makeStopData(tenantId = 'tenant-001', routeId = 'route-001'): Omit<Stop, 'id'> {
  return {
    tenantId,
    routeId,
    name:                   'Stop Alpha',
    sequence:               1,
    lat:                    12.9716,
    lon:                    77.5946,
    estimatedOffsetMinutes: 5,
    createdAt:              1700000000000,
    updatedAt:              1700000000000,
  };
}

// ---------------------------------------------------------------------------
describe('StopRepository', () => {
  let repo: StopRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.where.mockReturnValue(mockCollection);
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDocRef);
    repo = new StopRepository();
  });

  it('listByRouteId() queries with tenantId + routeId filters and orderBy sequence asc', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });

    await repo.listByRouteId('route-001', 'tenant-001');

    expect(mockCollection.where).toHaveBeenCalledWith('tenantId', '==', 'tenant-001');
    expect(mockCollection.where).toHaveBeenCalledWith('routeId', '==', 'route-001');
    expect(mockCollection.orderBy).toHaveBeenCalledWith('sequence', 'asc');
  });

  it('listByRouteId() returns empty array when no documents', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });
    expect(await repo.listByRouteId('route-001', 'tenant-001')).toEqual([]);
  });

  it('listByRouteId() maps each document to a Stop', async () => {
    const data = makeStopData();
    mockCollection.get.mockResolvedValue({
      docs: [{ id: 'stop-001', data: () => data, exists: true }],
    });

    const result = await repo.listByRouteId('route-001', 'tenant-001');
    expect(result[0]).toMatchObject({ id: 'stop-001', name: 'Stop Alpha' });
  });

  it('findById() returns null when document does not exist', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, id: 'missing', data: () => undefined });
    expect(await repo.findById('missing', 'tenant-001')).toBeNull();
  });

  it('findById() returns a parsed Stop when document exists', async () => {
    const data = makeStopData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'stop-001', data: () => data });

    const result = await repo.findById('stop-001', 'tenant-001');
    expect(result).toMatchObject({ id: 'stop-001', name: 'Stop Alpha' });
  });

  it('create() calls collection.add() and returns the new ID', async () => {
    mockCollection.add.mockResolvedValue({ id: 'new-stop-id' });

    const data = makeStopData();
    const id   = await repo.create(data);
    expect(mockCollection.add).toHaveBeenCalledWith(data);
    expect(id).toBe('new-stop-id');
  });

  it('update() calls doc.update() with fields plus a fresh updatedAt', async () => {
    const data = makeStopData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'stop-001', data: () => data });
    mockDocRef.update.mockResolvedValue(undefined);

    const before = Date.now();
    await repo.update('stop-001', 'tenant-001', { sequence: 3 });
    const after = Date.now();

    const arg = mockDocRef.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg['sequence']).toBe(3);
    expect(arg['updatedAt']).toBeGreaterThanOrEqual(before);
    expect(arg['updatedAt']).toBeLessThanOrEqual(after);
  });

  it('remove() calls doc.delete()', async () => {
    const data = makeStopData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'stop-001', data: () => data });
    mockDocRef.delete.mockResolvedValue(undefined);

    await repo.remove('stop-001', 'tenant-001');

    expect(mockCollection.doc).toHaveBeenCalledWith('stop-001');
    expect(mockDocRef.delete).toHaveBeenCalledOnce();
  });
});
