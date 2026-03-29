import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tenant, CreateTenantInput } from '@saferide/types';

// ---------------------------------------------------------------------------
// Use vi.hoisted so repoMock is available inside the vi.mock factory
// ---------------------------------------------------------------------------
const repoMock = vi.hoisted(() => ({
  listAll:      vi.fn(),
  findById:     vi.fn(),
  create:       vi.fn(),
  updateStatus: vi.fn(),
  createInvite: vi.fn(),
}));

vi.mock('../../src/repositories/tenants.repository', () => ({
  TenantsRepository: vi.fn().mockImplementation(() => repoMock),
}));

// Also mock logger to avoid pino-pretty side effects
vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { TenantsService } from '../../src/services/tenants.service';

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

const validCreateInput: CreateTenantInput = {
  name:         'Sunrise Academy',
  city:         'Chennai',
  state:        'Tamil Nadu',
  plan:         'trial',
  maxBuses:     5,
  maxStudents:  200,
  contactName:  'Sunita',
  contactEmail: 'sunita@sunrise.edu',
  contactPhone: '8765432109',
  adminEmail:   'admin@sunrise.edu',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenantsService();
  });

  // -------------------------------------------------------------------------
  it('listTenants() returns the array from repo.listAll()', async () => {
    const tenants = [makeTenant(), makeTenant({ id: 'tenant-002' })];
    repoMock.listAll.mockResolvedValue(tenants);

    const result = await service.listTenants();

    expect(repoMock.listAll).toHaveBeenCalledOnce();
    expect(result).toEqual(tenants);
  });

  // -------------------------------------------------------------------------
  it('getTenant(id) returns the tenant from repo.findById(id)', async () => {
    const tenant = makeTenant();
    repoMock.findById.mockResolvedValue(tenant);

    const result = await service.getTenant('tenant-001');

    expect(repoMock.findById).toHaveBeenCalledWith('tenant-001');
    expect(result).toEqual(tenant);
  });

  it('getTenant(id) returns null when not found', async () => {
    repoMock.findById.mockResolvedValue(null);

    const result = await service.getTenant('missing-id');

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('createTenant() calls repo.create() and repo.createInvite() and returns the created tenant', async () => {
    const createdTenant = makeTenant();
    repoMock.create.mockResolvedValue('tenant-001');
    repoMock.createInvite.mockResolvedValue(undefined);
    repoMock.findById.mockResolvedValue(createdTenant);

    const result = await service.createTenant(validCreateInput);

    expect(repoMock.create).toHaveBeenCalledOnce();
    expect(repoMock.createInvite).toHaveBeenCalledOnce();
    expect(result).toEqual(createdTenant);
  });

  it('createTenant() always sets status="pending" and trialEndsAt=null regardless of plan', async () => {
    // Tenant lifecycle: always starts "pending"; transitions to "trial"/"active"
    // only when the school admin claims their invite (handled by auth-service).
    const createdTenant = makeTenant({ status: 'pending', trialEndsAt: null });
    repoMock.create.mockResolvedValue('tenant-001');
    repoMock.createInvite.mockResolvedValue(undefined);
    repoMock.findById.mockResolvedValue(createdTenant);

    await service.createTenant({ ...validCreateInput, plan: 'trial' });

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['status']).toBe('pending');
    expect(createCall['trialEndsAt']).toBeNull();
  });

  it('createTenant() with plan="pro" still sets status="pending" and trialEndsAt=null', async () => {
    const createdTenant = makeTenant({ status: 'pending', plan: 'pro', trialEndsAt: null });
    repoMock.create.mockResolvedValue('tenant-001');
    repoMock.createInvite.mockResolvedValue(undefined);
    repoMock.findById.mockResolvedValue(createdTenant);

    await service.createTenant({ ...validCreateInput, plan: 'pro' });

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['status']).toBe('pending');
    expect(createCall['trialEndsAt']).toBeNull();
  });

  it('createTenant() stores plan in the pendingInvite for auth-service to use on claim', async () => {
    const createdTenant = makeTenant({ status: 'pending', plan: 'basic' });
    repoMock.create.mockResolvedValue('tenant-001');
    repoMock.createInvite.mockResolvedValue(undefined);
    repoMock.findById.mockResolvedValue(createdTenant);

    await service.createTenant({ ...validCreateInput, plan: 'basic' });

    const inviteCall = repoMock.createInvite.mock.calls[0]![1] as Record<string, unknown>;
    expect(inviteCall['plan']).toBe('basic');
  });

  // -------------------------------------------------------------------------
  it('suspendTenant(id) calls repo.updateStatus(id, "suspended")', async () => {
    repoMock.updateStatus.mockResolvedValue(undefined);

    await service.suspendTenant('tenant-001');

    expect(repoMock.updateStatus).toHaveBeenCalledWith('tenant-001', 'suspended');
  });

  it('reactivateTenant(id) calls repo.updateStatus(id, "active")', async () => {
    repoMock.updateStatus.mockResolvedValue(undefined);

    await service.reactivateTenant('tenant-001');

    expect(repoMock.updateStatus).toHaveBeenCalledWith('tenant-001', 'active');
  });
});
