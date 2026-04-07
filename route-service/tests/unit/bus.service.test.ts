import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bus, CreateBusInput, UpdateBusInput } from '@saferide/types';

// ---------------------------------------------------------------------------
// Use vi.hoisted so repo mocks are available inside vi.mock factories
// ---------------------------------------------------------------------------
const batchMock = vi.hoisted(() => ({
  update:  vi.fn(),
  commit:  vi.fn().mockResolvedValue(undefined),
}));

const dbMock = vi.hoisted(() => ({
  batch: vi.fn().mockReturnValue(batchMock),
  collection: vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue({ id: 'mock-doc-ref' }),
  }),
}));

const repoMock = vi.hoisted(() => ({
  listByTenantId: vi.fn(),
  findById:       vi.fn(),
  findByRouteId:  vi.fn(),
  create:         vi.fn(),
  update:         vi.fn(),
  getDocRef:      vi.fn().mockReturnValue({ id: 'bus-ref' }),
}));

const driverRepoMock = vi.hoisted(() => ({
  findById:  vi.fn(),
  update:    vi.fn(),
  getDocRef: vi.fn().mockReturnValue({ id: 'driver-ref' }),
}));

const routeRepoMock = vi.hoisted(() => ({
  findById: vi.fn(),
}));

const stopRepoMock = vi.hoisted(() => ({
  listByRouteId: vi.fn().mockResolvedValue([]),
}));

const studentRepoMock = vi.hoisted(() => ({
  listByStopIds: vi.fn().mockResolvedValue([]),
  update:        vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@saferide/firebase-admin', () => ({
  getDb: vi.fn().mockReturnValue(dbMock),
}));

vi.mock('../../src/repositories/bus.repository', () => ({
  BusRepository: vi.fn().mockImplementation(() => repoMock),
}));

vi.mock('../../src/repositories/driver.repository', () => ({
  DriverRepository: vi.fn().mockImplementation(() => driverRepoMock),
}));

vi.mock('../../src/repositories/route.repository', () => ({
  RouteRepository: vi.fn().mockImplementation(() => routeRepoMock),
}));

vi.mock('../../src/repositories/stop.repository', () => ({
  StopRepository: vi.fn().mockImplementation(() => stopRepoMock),
}));

vi.mock('../../src/repositories/student.repository', () => ({
  StudentRepository: vi.fn().mockImplementation(() => studentRepoMock),
}));

const mockChildLogger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue(mockChildLogger),
}));

import { BusService } from '../../src/services/bus.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBus(overrides: Partial<Bus> = {}): Bus {
  return {
    id:                 'bus-001',
    tenantId:           'tenant-001',
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
    ...overrides,
  };
}

function makeDriver(overrides: Partial<{ id: string; tenantId: string; busId: string | null }> = {}) {
  return {
    id:            'driver-001',
    tenantId:      'tenant-001',
    firebaseUid:   'uid-001',
    name:          'Raju Kumar',
    phone:         '9876543210',
    licenseNumber: 'KA0120230001',
    busId:         null,
    isActive:      true,
    createdAt:     1700000000000,
    updatedAt:     1700000000000,
    ...overrides,
  };
}

function makeRoute(overrides: Partial<{ id: string; tenantId: string }> = {}) {
  return {
    id:        'route-001',
    tenantId:  'tenant-001',
    name:      'Route A',
    isActive:  true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

const validCreateInput: CreateBusInput = {
  registrationNumber: 'KA01AB1234',
  make:               'Tata',
  model:              'Starbus',
  year:               2020,
  capacity:           40,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('BusService', () => {
  let service: BusService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default return values after clearAllMocks
    repoMock.getDocRef.mockReturnValue({ id: 'bus-ref' });
    driverRepoMock.getDocRef.mockReturnValue({ id: 'driver-ref' });
    dbMock.batch.mockReturnValue(batchMock);
    batchMock.commit.mockResolvedValue(undefined);
    stopRepoMock.listByRouteId.mockResolvedValue([]);
    studentRepoMock.listByStopIds.mockResolvedValue([]);
    studentRepoMock.update.mockResolvedValue(undefined);
    service = new BusService();
  });

  // ── listBuses ─────────────────────────────────────────────────────────────
  it('listBuses() returns the array from repo.listByTenantId()', async () => {
    const buses = [makeBus(), makeBus({ id: 'bus-002' })];
    repoMock.listByTenantId.mockResolvedValue(buses);

    const result = await service.listBuses('tenant-001');

    expect(repoMock.listByTenantId).toHaveBeenCalledWith('tenant-001');
    expect(result).toEqual(buses);
  });

  // ── findBus ───────────────────────────────────────────────────────────────
  it('findBus() returns the bus when id and tenantId match', async () => {
    const bus = makeBus();
    repoMock.findById.mockResolvedValue(bus);

    const result = await service.findBus('bus-001', 'tenant-001');

    expect(result).toEqual(bus);
  });

  it('findBus() returns null when bus does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    const result = await service.findBus('missing', 'tenant-001');

    expect(result).toBeNull();
  });

  it('findBus() returns null when bus belongs to a different tenant (tenant isolation)', async () => {
    repoMock.findById.mockResolvedValue(makeBus({ tenantId: 'tenant-002' }));

    const result = await service.findBus('bus-001', 'tenant-001');

    expect(result).toBeNull();
  });

  // ── getBus ────────────────────────────────────────────────────────────────
  it('getBus() returns the bus when found', async () => {
    const bus = makeBus();
    repoMock.findById.mockResolvedValue(bus);

    const result = await service.getBus('bus-001', 'tenant-001');

    expect(result).toEqual(bus);
  });

  it('getBus() throws BUS_NOT_FOUND when bus does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.getBus('missing', 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  it('getBus() throws BUS_NOT_FOUND when bus belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeBus({ tenantId: 'tenant-999' }));

    await expect(service.getBus('bus-001', 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  // ── createBus ─────────────────────────────────────────────────────────────
  it('createBus() calls repo.create() and returns the created bus', async () => {
    const createdBus = makeBus();
    repoMock.create.mockResolvedValue('bus-001');
    repoMock.findById.mockResolvedValue(createdBus);

    const result = await service.createBus(validCreateInput, 'tenant-001');

    expect(repoMock.create).toHaveBeenCalledOnce();
    expect(result).toEqual(createdBus);
  });

  it('createBus() sets status="active", driverId=null, routeId=null, tenantId from context', async () => {
    repoMock.create.mockResolvedValue('bus-001');
    repoMock.findById.mockResolvedValue(makeBus());

    await service.createBus(validCreateInput, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['status']).toBe('active');
    expect(createCall['tenantId']).toBe('tenant-001');
    expect(createCall['driverId']).toBeNull();
    expect(createCall['routeId']).toBeNull();
  });

  it('createBus() throws when repo.findById() returns null after create', async () => {
    repoMock.create.mockResolvedValue('bus-001');
    repoMock.findById.mockResolvedValue(null);

    await expect(service.createBus(validCreateInput, 'tenant-001')).rejects.toThrow();
  });

  // ── updateBus ─────────────────────────────────────────────────────────────
  it('updateBus() calls repo.update() and returns the updated bus', async () => {
    const existing = makeBus();
    const updated  = makeBus({ capacity: 50 });
    repoMock.findById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    repoMock.update.mockResolvedValue(undefined);

    const updateInput: UpdateBusInput = { capacity: 50 };
    const result = await service.updateBus('bus-001', updateInput, 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('bus-001', 'tenant-001', updateInput);
    expect(result).toEqual(updated);
  });

  it('updateBus() throws BUS_NOT_FOUND when bus does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.updateBus('missing', { capacity: 50 }, 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  it('updateBus() throws BUS_NOT_FOUND when bus belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeBus({ tenantId: 'tenant-999' }));

    await expect(service.updateBus('bus-001', { capacity: 50 }, 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  // ── deleteBus ─────────────────────────────────────────────────────────────
  it('deleteBus() soft-deletes by setting status to inactive', async () => {
    repoMock.findById.mockResolvedValue(makeBus());
    repoMock.update.mockResolvedValue(undefined);

    await service.deleteBus('bus-001', 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('bus-001', 'tenant-001', { status: 'inactive' });
  });

  it('deleteBus() throws BUS_NOT_FOUND when bus does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.deleteBus('missing', 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  it('deleteBus() throws BUS_NOT_FOUND when bus belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeBus({ tenantId: 'tenant-999' }));

    await expect(service.deleteBus('bus-001', 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  // ── assignDriver ──────────────────────────────────────────────────────────
  it('assignDriver() sets bus.driverId and driver.busId via batch', async () => {
    const bus    = makeBus({ driverId: null });
    const driver = makeDriver({ busId: null });
    const updated = makeBus({ driverId: 'driver-001' });

    repoMock.findById.mockResolvedValueOnce(bus).mockResolvedValueOnce(updated);
    driverRepoMock.findById.mockResolvedValue(driver);

    const result = await service.assignDriver('bus-001', 'driver-001', 'tenant-001');

    // Service uses batch.update (not repo.update directly)
    expect(batchMock.commit).toHaveBeenCalledOnce();
    expect(batchMock.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ busId: 'bus-001' }),
    );
    expect(batchMock.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ driverId: 'driver-001' }),
    );
    expect(result).toEqual(updated);
  });

  it('assignDriver() clears old driver.busId when reassigning', async () => {
    const bus    = makeBus({ driverId: 'old-driver' });
    const driver = makeDriver({ id: 'new-driver', busId: null });
    const updated = makeBus({ driverId: 'new-driver' });

    repoMock.findById.mockResolvedValueOnce(bus).mockResolvedValueOnce(updated);
    driverRepoMock.findById.mockResolvedValue(driver);

    await service.assignDriver('bus-001', 'new-driver', 'tenant-001');

    // Should clear old driver's busId
    expect(batchMock.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ busId: null }),
    );
    expect(batchMock.commit).toHaveBeenCalledOnce();
  });

  it('assignDriver() with null unassigns the driver and clears bus.driverId', async () => {
    const bus     = makeBus({ driverId: 'driver-001' });
    const updated = makeBus({ driverId: null });

    repoMock.findById.mockResolvedValueOnce(bus).mockResolvedValueOnce(updated);

    const result = await service.assignDriver('bus-001', null, 'tenant-001');

    expect(batchMock.commit).toHaveBeenCalledOnce();
    expect(batchMock.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ busId: null }),
    );
    expect(batchMock.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ driverId: null }),
    );
    expect(result).toEqual(updated);
  });

  it('assignDriver() throws BUS_NOT_FOUND when bus does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.assignDriver('missing', 'driver-001', 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  it('assignDriver() throws DRIVER_NOT_FOUND when driver does not exist', async () => {
    repoMock.findById.mockResolvedValue(makeBus());
    driverRepoMock.findById.mockResolvedValue(null);

    await expect(service.assignDriver('bus-001', 'missing-driver', 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });

  it('assignDriver() throws DRIVER_NOT_FOUND when driver belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeBus());
    driverRepoMock.findById.mockResolvedValue(makeDriver({ tenantId: 'tenant-999' }));

    await expect(service.assignDriver('bus-001', 'driver-001', 'tenant-001')).rejects.toThrow('DRIVER_NOT_FOUND');
  });

  // ── assignRoute ───────────────────────────────────────────────────────────
  it('assignRoute() sets bus.routeId', async () => {
    const bus     = makeBus({ routeId: null });
    const updated = makeBus({ routeId: 'route-001' });

    repoMock.findById.mockResolvedValueOnce(bus).mockResolvedValueOnce(updated);
    routeRepoMock.findById.mockResolvedValue(makeRoute());
    repoMock.findByRouteId.mockResolvedValue(null); // no existing bus on route
    repoMock.update.mockResolvedValue(undefined);

    const result = await service.assignRoute('bus-001', 'route-001', 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('bus-001', 'tenant-001', { routeId: 'route-001' });
    expect(result).toEqual(updated);
  });

  it('assignRoute() with null clears bus.routeId', async () => {
    const bus     = makeBus({ routeId: 'route-001' });
    const updated = makeBus({ routeId: null });

    repoMock.findById.mockResolvedValueOnce(bus).mockResolvedValueOnce(updated);
    repoMock.update.mockResolvedValue(undefined);

    const result = await service.assignRoute('bus-001', null, 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('bus-001', 'tenant-001', { routeId: null });
    expect(result).toEqual(updated);
  });

  it('assignRoute() throws BUS_NOT_FOUND when bus does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.assignRoute('missing', 'route-001', 'tenant-001')).rejects.toThrow('BUS_NOT_FOUND');
  });

  it('assignRoute() throws ROUTE_NOT_FOUND when route does not exist', async () => {
    repoMock.findById.mockResolvedValue(makeBus());
    routeRepoMock.findById.mockResolvedValue(null);
    repoMock.findByRouteId.mockResolvedValue(null);

    await expect(service.assignRoute('bus-001', 'missing-route', 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  it('assignRoute() throws ROUTE_NOT_FOUND when route belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeBus());
    routeRepoMock.findById.mockResolvedValue(makeRoute({ tenantId: 'tenant-999' }));
    repoMock.findByRouteId.mockResolvedValue(null);

    await expect(service.assignRoute('bus-001', 'route-001', 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  it('assignRoute() throws ROUTE_ALREADY_HAS_BUS when another bus is already on the route', async () => {
    repoMock.findById.mockResolvedValue(makeBus({ id: 'bus-001', routeId: null }));
    routeRepoMock.findById.mockResolvedValue(makeRoute());
    // A different bus is already on this route
    repoMock.findByRouteId.mockResolvedValue(makeBus({ id: 'bus-002', routeId: 'route-001' }));

    await expect(service.assignRoute('bus-001', 'route-001', 'tenant-001')).rejects.toThrow('ROUTE_ALREADY_HAS_BUS');
  });
});
