import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Driver } from '@saferide/types';

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
  getDb: vi.fn(() => ({ collection: vi.fn(() => mockCollection) })),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { DriverRepository } from '../../src/repositories/driver.repository';

function makeDriverData(tenantId = 'tenant-001'): Omit<Driver, 'id'> {
  return {
    tenantId,
    firebaseUid:   'firebase-uid-001',
    name:          'Raju Kumar',
    phone:         '9876543210',
    licenseNumber: 'KA0120230001234',
    busId:         null,
    isActive:      true,
    createdAt:     1700000000000,
    updatedAt:     1700000000000,
  };
}

describe('DriverRepository', () => {
  let repo: DriverRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.where.mockReturnValue(mockCollection);
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDocRef);
    repo = new DriverRepository();
  });

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

  it('listByTenantId() maps each document to a Driver', async () => {
    const data = makeDriverData();
    mockCollection.get.mockResolvedValue({
      docs: [{ id: 'driver-001', data: () => data, exists: true }],
    });

    const result = await repo.listByTenantId('tenant-001');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'driver-001', name: 'Raju Kumar' });
  });

  it('findById() returns null when document does not exist', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, id: 'missing', data: () => undefined });

    const result = await repo.findById('missing-id', 'tenant-001');

    expect(result).toBeNull();
  });

  it('findById() returns a parsed Driver when document exists', async () => {
    const data = makeDriverData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'driver-001', data: () => data });

    const result = await repo.findById('driver-001', 'tenant-001');

    expect(result).toMatchObject({ id: 'driver-001', name: 'Raju Kumar' });
  });

  it('create() calls collection.add() with data and returns the new ID', async () => {
    mockCollection.add.mockResolvedValue({ id: 'new-driver-id' });

    const data = makeDriverData();
    const id   = await repo.create(data);

    expect(mockCollection.add).toHaveBeenCalledWith(data);
    expect(id).toBe('new-driver-id');
  });

  it('update() calls doc.update() with the given fields plus updatedAt', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    await repo.update('driver-001', 'tenant-001', { phone: '9999999999' });

    expect(mockCollection.doc).toHaveBeenCalledWith('driver-001');
    expect(mockDocRef.update).toHaveBeenCalledWith({
      phone:     '9999999999',
      updatedAt: expect.any(Number),
    });
  });

  it('update() always sets a fresh updatedAt timestamp', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    const before = Date.now();
    await repo.update('driver-001', 'tenant-001', { isActive: false });
    const after = Date.now();

    const callArg = mockDocRef.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArg['updatedAt']).toBeGreaterThanOrEqual(before);
    expect(callArg['updatedAt']).toBeLessThanOrEqual(after);
  });
});
