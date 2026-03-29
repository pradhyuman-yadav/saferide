import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Bus, UserRole } from '@saferide/types';

// ---------------------------------------------------------------------------
// Use vi.hoisted so serviceMock is available inside the vi.mock factory
// ---------------------------------------------------------------------------
const serviceMock = vi.hoisted(() => ({
  listBuses:     vi.fn(),
  findBus:       vi.fn(),
  createBus:     vi.fn(),
  updateBus:     vi.fn(),
  deleteBus:     vi.fn(),
  assignDriver:  vi.fn(),
  assignRoute:   vi.fn(),
}));

vi.mock('../../src/services/bus.service', () => ({
  BusService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { BusController } from '../../src/controllers/bus.controller';

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

function mockReq(overrides: Partial<{
  params:    Record<string, string>;
  body:      unknown;
  user:      { uid: string; email: string; role: UserRole; tenantId: string | null };
  requestId: string;
}> = {}): Request {
  return {
    params:    {},
    body:      {},
    headers:   {},
    requestId: 'test-req-id',
    user:      { uid: 'user-1', email: 'admin@school.edu', role: 'school_admin', tenantId: 'tenant-001' },
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
describe('BusController', () => {
  let controller: BusController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new BusController();
  });

  // ── list ──────────────────────────────────────────────────────────────────
  it('list() returns 200 with { success: true, data: [...] }', async () => {
    const buses = [makeBus()];
    serviceMock.listBuses.mockResolvedValue(buses);

    const req = mockReq();
    const res = mockRes();

    await controller.list(req, res as unknown as Response);

    expect(serviceMock.listBuses).toHaveBeenCalledWith('tenant-001');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: buses });
  });

  it('list() returns 403 when tenantId is null', async () => {
    const req = mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } });
    const res = mockRes();

    await controller.list(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(serviceMock.listBuses).not.toHaveBeenCalled();
  });

  // ── getById ───────────────────────────────────────────────────────────────
  it('getById() returns 200 when bus is found', async () => {
    const bus = makeBus();
    serviceMock.findBus.mockResolvedValue(bus);

    const req = mockReq({ params: { id: 'bus-001' } });
    const res = mockRes();

    await controller.getById(req, res as unknown as Response);

    expect(serviceMock.findBus).toHaveBeenCalledWith('bus-001', 'tenant-001');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: bus });
  });

  it('getById() returns 404 when bus is not found', async () => {
    serviceMock.findBus.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await controller.getById(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'BUS_NOT_FOUND' }) }),
    );
  });

  it('getById() returns 403 when tenantId is null', async () => {
    const req = mockReq({ params: { id: 'bus-001' }, user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } });
    const res = mockRes();

    await controller.getById(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ── create ────────────────────────────────────────────────────────────────
  it('create() returns 201 with the created bus', async () => {
    const bus = makeBus();
    serviceMock.createBus.mockResolvedValue(bus);

    const req = mockReq({ body: { registrationNumber: 'KA01AB1234', make: 'Tata', model: 'Starbus', year: 2020, capacity: 40 } });
    const res = mockRes();

    await controller.create(req, res as unknown as Response);

    expect(serviceMock.createBus).toHaveBeenCalledWith(req.body, 'tenant-001');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: bus });
  });

  it('create() returns 403 when tenantId is null', async () => {
    const req = mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } });
    const res = mockRes();

    await controller.create(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(serviceMock.createBus).not.toHaveBeenCalled();
  });

  // ── update ────────────────────────────────────────────────────────────────
  it('update() returns 200 with the updated bus', async () => {
    const bus = makeBus({ capacity: 50 });
    serviceMock.updateBus.mockResolvedValue(bus);

    const req = mockReq({ params: { id: 'bus-001' }, body: { capacity: 50 } });
    const res = mockRes();

    await controller.update(req, res as unknown as Response);

    expect(serviceMock.updateBus).toHaveBeenCalledWith('bus-001', { capacity: 50 }, 'tenant-001');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: bus });
  });

  it('update() returns 404 when service throws BUS_NOT_FOUND', async () => {
    serviceMock.updateBus.mockRejectedValue(new Error('BUS_NOT_FOUND'));

    const req = mockReq({ params: { id: 'missing' }, body: { capacity: 50 } });
    const res = mockRes();

    await controller.update(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'BUS_NOT_FOUND' }) }),
    );
  });

  it('update() re-throws unknown errors', async () => {
    serviceMock.updateBus.mockRejectedValue(new Error('UNEXPECTED'));

    const req = mockReq({ params: { id: 'bus-001' }, body: { capacity: 50 } });
    const res = mockRes();

    await expect(controller.update(req, res as unknown as Response)).rejects.toThrow('UNEXPECTED');
  });

  // ── delete ────────────────────────────────────────────────────────────────
  it('delete() returns 204 on success', async () => {
    serviceMock.deleteBus.mockResolvedValue(undefined);

    const req = mockReq({ params: { id: 'bus-001' } });
    const res = mockRes();

    await controller.delete(req, res as unknown as Response);

    expect(serviceMock.deleteBus).toHaveBeenCalledWith('bus-001', 'tenant-001');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('delete() returns 404 when service throws BUS_NOT_FOUND', async () => {
    serviceMock.deleteBus.mockRejectedValue(new Error('BUS_NOT_FOUND'));

    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await controller.delete(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'BUS_NOT_FOUND' }) }),
    );
  });

  it('delete() re-throws unknown errors', async () => {
    serviceMock.deleteBus.mockRejectedValue(new Error('UNEXPECTED'));

    const req = mockReq({ params: { id: 'bus-001' } });
    const res = mockRes();

    await expect(controller.delete(req, res as unknown as Response)).rejects.toThrow('UNEXPECTED');
  });

  // ── assignDriver ──────────────────────────────────────────────────────────
  it('assignDriver() returns 200 with the updated bus', async () => {
    const bus = makeBus({ driverId: 'driver-001' });
    serviceMock.assignDriver.mockResolvedValue(bus);

    const req = mockReq({ params: { id: 'bus-001' }, body: { driverId: 'driver-001' } });
    const res = mockRes();

    await controller.assignDriver(req, res as unknown as Response);

    expect(serviceMock.assignDriver).toHaveBeenCalledWith('bus-001', 'driver-001', 'tenant-001');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: bus });
  });

  it('assignDriver() returns 404 when service throws BUS_NOT_FOUND', async () => {
    serviceMock.assignDriver.mockRejectedValue(new Error('BUS_NOT_FOUND'));

    const req = mockReq({ params: { id: 'missing' }, body: { driverId: 'driver-001' } });
    const res = mockRes();

    await controller.assignDriver(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'BUS_NOT_FOUND' }) }),
    );
  });

  it('assignDriver() returns 404 when service throws DRIVER_NOT_FOUND', async () => {
    serviceMock.assignDriver.mockRejectedValue(new Error('DRIVER_NOT_FOUND'));

    const req = mockReq({ params: { id: 'bus-001' }, body: { driverId: 'bad-driver' } });
    const res = mockRes();

    await controller.assignDriver(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'DRIVER_NOT_FOUND' }) }),
    );
  });

  // ── assignRoute ───────────────────────────────────────────────────────────
  it('assignRoute() returns 200 with the updated bus', async () => {
    const bus = makeBus({ routeId: 'route-001' });
    serviceMock.assignRoute.mockResolvedValue(bus);

    const req = mockReq({ params: { id: 'bus-001' }, body: { routeId: 'route-001' } });
    const res = mockRes();

    await controller.assignRoute(req, res as unknown as Response);

    expect(serviceMock.assignRoute).toHaveBeenCalledWith('bus-001', 'route-001', 'tenant-001');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: bus });
  });

  it('assignRoute() returns 404 when service throws ROUTE_NOT_FOUND', async () => {
    serviceMock.assignRoute.mockRejectedValue(new Error('ROUTE_NOT_FOUND'));

    const req = mockReq({ params: { id: 'bus-001' }, body: { routeId: 'bad-route' } });
    const res = mockRes();

    await controller.assignRoute(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'ROUTE_NOT_FOUND' }) }),
    );
  });
});
