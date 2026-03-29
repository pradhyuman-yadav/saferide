import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Tenant } from '@saferide/types';
import type { UserRole } from '@saferide/types';

// ---------------------------------------------------------------------------
// Use vi.hoisted so serviceMock is available inside the vi.mock factory
// ---------------------------------------------------------------------------
const serviceMock = vi.hoisted(() => ({
  listTenants:      vi.fn(),
  getTenant:        vi.fn(),
  createTenant:     vi.fn(),
  suspendTenant:    vi.fn(),
  reactivateTenant: vi.fn(),
}));

vi.mock('../../src/services/tenants.service', () => ({
  TenantsService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { TenantsController } from '../../src/controllers/tenants.controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id:           'tenant-001',
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
    ...overrides,
  };
}

function mockReq(overrides: Partial<{
  params: Record<string, string>;
  body: unknown;
  user: { uid: string; email: string; role: UserRole; tenantId: string | null };
}> = {}): Request {
  return {
    params:    {},
    body:      {},
    headers:   {},
    requestId: 'test-req-id',
    user:      { uid: 'admin-1', email: 'admin@saferide.io', role: 'super_admin', tenantId: null },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): {
  status: ReturnType<typeof vi.fn>;
  json:   ReturnType<typeof vi.fn>;
  send:   ReturnType<typeof vi.fn>;
} {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TenantsController', () => {
  let controller: TenantsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TenantsController();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  it('list() returns 200 with { success: true, data: [...] }', async () => {
    const tenants = [makeTenant()];
    serviceMock.listTenants.mockResolvedValue(tenants);

    const req = mockReq();
    const res = mockRes();

    await controller.list(req, res as unknown as Response);

    expect(serviceMock.listTenants).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: tenants });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  it('getById() returns 200 when super_admin requests any tenant', async () => {
    const tenant = makeTenant();
    serviceMock.getTenant.mockResolvedValue(tenant);

    const req = mockReq({ params: { id: 'tenant-001' }, user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } });
    const res = mockRes();

    await controller.getById(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: tenant });
  });

  it('getById() returns 200 when school_admin requests their own tenant', async () => {
    const tenant = makeTenant();
    serviceMock.getTenant.mockResolvedValue(tenant);

    const req = mockReq({ params: { id: 'tenant-001' }, user: { uid: 'u1', email: 'a@b.com', role: 'school_admin', tenantId: 'tenant-001' } });
    const res = mockRes();

    await controller.getById(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: tenant });
  });

  it('getById() returns 403 when school_admin requests a different tenant', async () => {
    const req = mockReq({ params: { id: 'tenant-999' }, user: { uid: 'u1', email: 'a@b.com', role: 'school_admin', tenantId: 'tenant-001' } });
    const res = mockRes();

    await controller.getById(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(serviceMock.getTenant).not.toHaveBeenCalled();
  });

  it('getById() returns 404 when tenant not found', async () => {
    serviceMock.getTenant.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'missing-id' } });
    const res = mockRes();

    await controller.getById(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'TENANT_NOT_FOUND' }) }),
    );
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  it('create() returns 201 with the created tenant', async () => {
    const tenant = makeTenant();
    serviceMock.createTenant.mockResolvedValue(tenant);

    const req = mockReq({ body: { name: 'New School' } });
    const res = mockRes();

    await controller.create(req, res as unknown as Response);

    expect(serviceMock.createTenant).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: tenant });
  });

  // -------------------------------------------------------------------------
  // suspend
  // -------------------------------------------------------------------------
  it('suspend() returns 204 on success', async () => {
    const tenant = makeTenant({ status: 'active' });
    serviceMock.getTenant.mockResolvedValue(tenant);
    serviceMock.suspendTenant.mockResolvedValue(undefined);

    const req = mockReq({ params: { id: 'tenant-001' } });
    const res = mockRes();

    await controller.suspend(req, res as unknown as Response);

    expect(serviceMock.suspendTenant).toHaveBeenCalledWith('tenant-001');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('suspend() returns 409 when tenant is already suspended', async () => {
    serviceMock.getTenant.mockResolvedValue(makeTenant({ status: 'suspended' }));

    const req = mockReq({ params: { id: 'tenant-001' } });
    const res = mockRes();

    await controller.suspend(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'ALREADY_SUSPENDED' }) }),
    );
  });

  it('suspend() returns 404 when tenant not found', async () => {
    serviceMock.getTenant.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'missing-id' } });
    const res = mockRes();

    await controller.suspend(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // -------------------------------------------------------------------------
  // reactivate
  // -------------------------------------------------------------------------
  it('reactivate() returns 204 on success', async () => {
    const tenant = makeTenant({ status: 'suspended' });
    serviceMock.getTenant.mockResolvedValue(tenant);
    serviceMock.reactivateTenant.mockResolvedValue(undefined);

    const req = mockReq({ params: { id: 'tenant-001' } });
    const res = mockRes();

    await controller.reactivate(req, res as unknown as Response);

    expect(serviceMock.reactivateTenant).toHaveBeenCalledWith('tenant-001');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('reactivate() returns 409 when tenant is already active', async () => {
    serviceMock.getTenant.mockResolvedValue(makeTenant({ status: 'active' }));

    const req = mockReq({ params: { id: 'tenant-001' } });
    const res = mockRes();

    await controller.reactivate(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'ALREADY_ACTIVE' }) }),
    );
  });

  it('reactivate() returns 404 when tenant not found', async () => {
    serviceMock.getTenant.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'missing-id' } });
    const res = mockRes();

    await controller.reactivate(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
