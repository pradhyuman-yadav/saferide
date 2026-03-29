import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tenant } from '@saferide/types';

// ---------------------------------------------------------------------------
// Use vi.hoisted so all mock refs are available inside vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockDocRef,
  mockPendingInviteDoc,
  mockPendingInvites,
  mockCollection,
} = vi.hoisted(() => {
  const mockDocRef = {
    get:    vi.fn(),
    update: vi.fn(),
    set:    vi.fn(),
  };
  const mockPendingInviteDoc = { set: vi.fn() };
  const mockPendingInvites   = {
    doc: vi.fn().mockReturnValue(mockPendingInviteDoc),
  };
  const mockCollection = {
    orderBy: vi.fn(),
    get:     vi.fn(),
    doc:     vi.fn().mockReturnValue(mockDocRef),
    add:     vi.fn(),
  };
  mockCollection.orderBy.mockReturnValue(mockCollection);
  return { mockDocRef, mockPendingInviteDoc, mockPendingInvites, mockCollection };
});

vi.mock('@saferide/firebase-admin', () => ({
  getDb: vi.fn(() => ({
    collection: vi.fn((name: string) =>
      name === 'pendingInvites' ? mockPendingInvites : mockCollection,
    ),
  })),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { TenantsRepository } from '../../src/repositories/tenants.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTenantData(): Omit<Tenant, 'id'> {
  return {
    name:         'Green Valley',
    slug:         'green-valley-abc1',
    city:         'Bengaluru',
    state:        'Karnataka',
    status:       'active',
    plan:         'pro',
    trialEndsAt:  null,
    maxBuses:     10,
    maxStudents:  500,
    contactName:  'Ramesh',
    contactEmail: 'ramesh@school.edu',
    contactPhone: '9876543210',
    adminEmail:   'admin@school.edu',
    createdAt:    1700000000000,
    updatedAt:    1700000000000,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TenantsRepository', () => {
  let repo: TenantsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore return values after clearAllMocks wipes them
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDocRef);
    mockPendingInvites.doc.mockReturnValue(mockPendingInviteDoc);
    repo = new TenantsRepository();
  });

  // -------------------------------------------------------------------------
  it('listAll() calls collection("tenants").orderBy("createdAt", "desc").get()', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });

    await repo.listAll();

    expect(mockCollection.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockCollection.get).toHaveBeenCalledOnce();
  });

  it('listAll() returns an empty array when there are no documents', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });

    const result = await repo.listAll();

    expect(result).toEqual([]);
  });

  it('listAll() maps each document to a Tenant', async () => {
    const data = makeTenantData();
    mockCollection.get.mockResolvedValue({
      docs: [{ id: 'tenant-001', data: () => data, exists: true }],
    });

    const result = await repo.listAll();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'tenant-001', name: 'Green Valley' });
  });

  // -------------------------------------------------------------------------
  it('findById() returns null when doc does not exist', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, id: 'missing', data: () => undefined });

    const result = await repo.findById('missing-id');

    expect(result).toBeNull();
  });

  it('findById() returns a parsed Tenant when doc exists', async () => {
    const data = makeTenantData();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'tenant-001', data: () => data });

    const result = await repo.findById('tenant-001');

    expect(result).toMatchObject({ id: 'tenant-001', name: 'Green Valley' });
  });

  // -------------------------------------------------------------------------
  it('create() calls collection.add() with the data and returns the new ID', async () => {
    mockCollection.add.mockResolvedValue({ id: 'new-tenant-id' });

    const data = makeTenantData();
    const id   = await repo.create(data);

    expect(mockCollection.add).toHaveBeenCalledWith(data);
    expect(id).toBe('new-tenant-id');
  });

  // -------------------------------------------------------------------------
  it('updateStatus() calls doc.update() with status and updatedAt', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    await repo.updateStatus('tenant-001', 'suspended');

    expect(mockCollection.doc).toHaveBeenCalledWith('tenant-001');
    expect(mockDocRef.update).toHaveBeenCalledWith({
      status:    'suspended',
      updatedAt: expect.any(Number),
    });
  });

  // -------------------------------------------------------------------------
  it('createInvite() calls pendingInvites.doc(key).set(data)', async () => {
    mockPendingInviteDoc.set.mockResolvedValue(undefined);

    const inviteData = { tenantId: 'tenant-001', email: 'admin@school.edu', role: 'school_admin', createdAt: 1700000000000, updatedAt: 1700000000000 };
    await repo.createInvite('admin_school_edu', inviteData);

    expect(mockPendingInvites.doc).toHaveBeenCalledWith('admin_school_edu');
    expect(mockPendingInviteDoc.set).toHaveBeenCalledWith(inviteData);
  });
});
