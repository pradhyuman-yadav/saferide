import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Student } from '@saferide/types';

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

import { StudentRepository } from '../../src/repositories/student.repository';

function makeStudentData(tenantId = 'tenant-001'): Omit<Student, 'id'> {
  return {
    tenantId,
    name:              'Arjun Sharma',
    parentFirebaseUid: 'parent-uid-001',
    parentName:        'Priya Sharma',
    parentPhone:       '9876543210',
    parentEmail:       'priya@example.com',
    busId:             null,
    stopId:            null,
    isActive:          true,
    createdAt:         1700000000000,
    updatedAt:         1700000000000,
  };
}

describe('StudentRepository', () => {
  let repo: StudentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.where.mockReturnValue(mockCollection);
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDocRef);
    repo = new StudentRepository();
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

  it('listByTenantId() maps each document to a Student', async () => {
    const data = makeStudentData();
    mockCollection.get.mockResolvedValue({
      docs: [{ id: 'student-001', data: () => data, exists: true }],
    });

    const result = await repo.listByTenantId('tenant-001');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'student-001', name: 'Arjun Sharma' });
  });

  it('findById() returns null when document does not exist', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, id: 'missing', data: () => undefined });

    const result = await repo.findById('missing-id');

    expect(result).toBeNull();
  });

  it('findById() returns a parsed Student when document exists', async () => {
    const data = makeStudentData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'student-001', data: () => data });

    const result = await repo.findById('student-001');

    expect(result).toMatchObject({ id: 'student-001', name: 'Arjun Sharma' });
  });

  it('create() calls collection.add() with data and returns the new ID', async () => {
    mockCollection.add.mockResolvedValue({ id: 'new-student-id' });

    const data = makeStudentData();
    const id   = await repo.create(data);

    expect(mockCollection.add).toHaveBeenCalledWith(data);
    expect(id).toBe('new-student-id');
  });

  it('update() calls doc.update() with the given fields plus updatedAt', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    await repo.update('student-001', { parentPhone: '9999999999' });

    expect(mockCollection.doc).toHaveBeenCalledWith('student-001');
    expect(mockDocRef.update).toHaveBeenCalledWith({
      parentPhone: '9999999999',
      updatedAt:   expect.any(Number),
    });
  });

  it('update() always sets a fresh updatedAt timestamp', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    const before = Date.now();
    await repo.update('student-001', { isActive: false });
    const after = Date.now();

    const callArg = mockDocRef.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArg['updatedAt']).toBeGreaterThanOrEqual(before);
    expect(callArg['updatedAt']).toBeLessThanOrEqual(after);
  });
});
