import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Driver, CreateDriverInput, UpdateDriverInput } from '@saferide/types';

const repoMock = vi.hoisted(() => ({
  listByTenantId: vi.fn(),
  findById:       vi.fn(),
  create:         vi.fn(),
  update:         vi.fn(),
}));

vi.mock('../../src/repositories/driver.repository', () => ({
  DriverRepository: vi.fn().mockImplementation(() => repoMock),
}));

vi.mock('../../src/utils/firebase-auth.utils', () => ({
  findOrCreateFirebaseUser: vi.fn().mockResolvedValue('firebase-uid-001'),
  sendSetupEmail:           vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { DriverService } from '../../src/services/driver.service';

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id:            'driver-001',
    tenantId:      'tenant-001',
    firebaseUid:   'firebase-uid-001',
    email:         'raju@example.com',
    name:          'Raju Kumar',
    phone:         '9876543210',
    licenseNumber: 'KA0120230001234',
    busId:         null,
    isActive:      true,
    createdAt:     1700000000000,
    updatedAt:     1700000000000,
    ...overrides,
  };
}

const validCreateInput: CreateDriverInput = {
  email:         'raju@example.com',
  name:          'Raju Kumar',
  phone:         '9876543210',
  licenseNumber: 'KA0120230001234',
};

describe('DriverService', () => {
  let service: DriverService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DriverService();
  });

  // ── listDrivers ───────────────────────────────────────────────────────────
  it('listDrivers() returns array from repo.listByTenantId()', async () => {
    const drivers = [makeDriver(), makeDriver({ id: 'driver-002' })];
    repoMock.listByTenantId.mockResolvedValue(drivers);

    const result = await service.listDrivers('tenant-001');

    expect(repoMock.listByTenantId).toHaveBeenCalledWith('tenant-001');
    expect(result).toEqual(drivers);
  });

  // ── findDriver ────────────────────────────────────────────────────────────
  it('findDriver() returns the driver when id and tenantId match', async () => {
    repoMock.findById.mockResolvedValue(makeDriver());

    const result = await service.findDriver('driver-001', 'tenant-001');

    expect(result).toMatchObject({ id: 'driver-001' });
  });

  it('findDriver() returns null when driver does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    const result = await service.findDriver('missing', 'tenant-001');

    expect(result).toBeNull();
  });

  it('findDriver() returns null when driver belongs to a different tenant (tenant isolation)', async () => {
    repoMock.findById.mockResolvedValue(makeDriver({ tenantId: 'tenant-002' }));

    const result = await service.findDriver('driver-001', 'tenant-001');

    expect(result).toBeNull();
  });

  // ── getDriver ─────────────────────────────────────────────────────────────
  it('getDriver() returns the driver when found', async () => {
    repoMock.findById.mockResolvedValue(makeDriver());

    const result = await service.getDriver('driver-001', 'tenant-001');

    expect(result).toMatchObject({ id: 'driver-001' });
  });

  it('getDriver() throws DRIVER_NOT_FOUND when driver does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.getDriver('missing', 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });

  it('getDriver() throws DRIVER_NOT_FOUND when driver belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeDriver({ tenantId: 'tenant-999' }));

    await expect(service.getDriver('driver-001', 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });

  // ── createDriver ──────────────────────────────────────────────────────────
  it('createDriver() calls repo.create() and returns the created driver', async () => {
    const created = makeDriver();
    repoMock.create.mockResolvedValue('driver-001');
    repoMock.findById.mockResolvedValue(created);

    const result = await service.createDriver(validCreateInput, 'tenant-001');

    expect(repoMock.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it('createDriver() always sets isActive=true and tenantId from context', async () => {
    repoMock.create.mockResolvedValue('driver-001');
    repoMock.findById.mockResolvedValue(makeDriver());

    await service.createDriver(validCreateInput, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['isActive']).toBe(true);
    expect(createCall['tenantId']).toBe('tenant-001');
  });

  it('createDriver() stores the resolved firebaseUid from findOrCreateFirebaseUser', async () => {
    repoMock.create.mockResolvedValue('driver-001');
    repoMock.findById.mockResolvedValue(makeDriver());

    await service.createDriver(validCreateInput, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['firebaseUid']).toBe('firebase-uid-001');
  });

  it('createDriver() sets busId to null when not provided', async () => {
    repoMock.create.mockResolvedValue('driver-001');
    repoMock.findById.mockResolvedValue(makeDriver());

    await service.createDriver(validCreateInput, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['busId']).toBeNull();
  });

  it('createDriver() throws when repo.findById() returns null after create', async () => {
    repoMock.create.mockResolvedValue('driver-001');
    repoMock.findById.mockResolvedValue(null);

    await expect(service.createDriver(validCreateInput, 'tenant-001')).rejects.toThrow();
  });

  // ── updateDriver ──────────────────────────────────────────────────────────
  it('updateDriver() calls repo.update() and returns the updated driver', async () => {
    const existing = makeDriver();
    const updated  = makeDriver({ phone: '9999999999' });
    repoMock.findById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    repoMock.update.mockResolvedValue(undefined);

    const input: UpdateDriverInput = { phone: '9999999999' };
    const result = await service.updateDriver('driver-001', input, 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('driver-001', input);
    expect(result).toEqual(updated);
  });

  it('updateDriver() throws DRIVER_NOT_FOUND when driver does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.updateDriver('missing', { phone: '9999999999' }, 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });

  it('updateDriver() throws DRIVER_NOT_FOUND when driver belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeDriver({ tenantId: 'tenant-999' }));

    await expect(service.updateDriver('driver-001', { phone: '9999999999' }, 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });

  // ── deleteDriver ──────────────────────────────────────────────────────────
  it('deleteDriver() soft-deletes by setting isActive to false', async () => {
    repoMock.findById.mockResolvedValue(makeDriver());
    repoMock.update.mockResolvedValue(undefined);

    await service.deleteDriver('driver-001', 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('driver-001', { isActive: false });
  });

  it('deleteDriver() throws DRIVER_NOT_FOUND when driver does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.deleteDriver('missing', 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });

  it('deleteDriver() throws DRIVER_NOT_FOUND when driver belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeDriver({ tenantId: 'tenant-999' }));

    await expect(service.deleteDriver('driver-001', 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });
});
