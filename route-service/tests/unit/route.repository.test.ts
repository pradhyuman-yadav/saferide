import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Route } from '@saferide/types';

// ---------------------------------------------------------------------------
const { mockDocRef, mockCollection } = vi.hoisted(() => {
  const mockDocRef   = { get: vi.fn(), update: vi.fn() };
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

import { RouteRepository } from '../../src/repositories/route.repository';

// ---------------------------------------------------------------------------
function makeRouteData(tenantId = 'tenant-001'): Omit<Route, 'id'> {
  return {
    tenantId,
    name:        'Morning Route A',
    description: 'Picks up students from Sector 5',
    isActive:    true,
    createdAt:   1700000000000,
    updatedAt:   1700000000000,
  };
}

// ---------------------------------------------------------------------------
describe('RouteRepository', () => {
  let repo: RouteRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.where.mockReturnValue(mockCollection);
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDocRef);
    repo = new RouteRepository();
  });

  it('listByTenantId() queries with tenantId filter and orderBy createdAt desc', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });

    await repo.listByTenantId('tenant-001');

    expect(mockCollection.where).toHaveBeenCalledWith('tenantId', '==', 'tenant-001');
    expect(mockCollection.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  it('listByTenantId() returns empty array when no documents', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });
    expect(await repo.listByTenantId('tenant-001')).toEqual([]);
  });

  it('listByTenantId() maps each document to a Route', async () => {
    const data = makeRouteData();
    mockCollection.get.mockResolvedValue({
      docs: [{ id: 'route-001', data: () => data, exists: true }],
    });

    const result = await repo.listByTenantId('tenant-001');
    expect(result[0]).toMatchObject({ id: 'route-001', name: 'Morning Route A' });
  });

  it('findById() returns null when document does not exist', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, id: 'missing', data: () => undefined });
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findById() returns a parsed Route when document exists', async () => {
    const data = makeRouteData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'route-001', data: () => data });

    const result = await repo.findById('route-001');
    expect(result).toMatchObject({ id: 'route-001', name: 'Morning Route A' });
  });

  it('create() calls collection.add() and returns the new ID', async () => {
    mockCollection.add.mockResolvedValue({ id: 'new-route-id' });

    const id = await repo.create(makeRouteData());
    expect(mockCollection.add).toHaveBeenCalledWith(makeRouteData());
    expect(id).toBe('new-route-id');
  });

  it('update() calls doc.update() with fields plus a fresh updatedAt', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    const before = Date.now();
    await repo.update('route-001', { name: 'Evening Route' });
    const after = Date.now();

    const arg = mockDocRef.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg['name']).toBe('Evening Route');
    expect(arg['updatedAt']).toBeGreaterThanOrEqual(before);
    expect(arg['updatedAt']).toBeLessThanOrEqual(after);
  });
});
