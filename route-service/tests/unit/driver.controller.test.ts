import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Driver } from '@saferide/types';

const serviceMock = vi.hoisted(() => ({
  listDrivers:  vi.fn(),
  findDriver:   vi.fn(),
  createDriver: vi.fn(),
  updateDriver: vi.fn(),
  deleteDriver: vi.fn(),
}));

vi.mock('../../src/services/driver.service', () => ({
  DriverService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { DriverController } from '../../src/controllers/driver.controller';

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

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user:   { uid: 'user-001', role: 'school_admin', tenantId: 'tenant-001' },
    params: {},
    body:   {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  const json   = vi.fn();
  const send   = vi.fn();
  const status = vi.fn().mockReturnValue({ json, send });
  const res    = { status, json, send } as unknown as Response;
  return { res, status, json, send };
}

describe('DriverController', () => {
  let controller: DriverController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new DriverController();
  });

  // ── list ──────────────────────────────────────────────────────────────────
  it('list() returns 200 with drivers array', async () => {
    const drivers = [makeDriver()];
    serviceMock.listDrivers.mockResolvedValue(drivers);

    const req = makeReq();
    const { res, json } = makeRes();

    await controller.list(req, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: drivers });
  });

  it('list() returns 403 when tenantId is null', async () => {
    const req = makeReq({ user: { uid: 'u', role: 'super_admin', tenantId: null } as never });
    const { res, status } = makeRes();

    await controller.list(req, res);

    expect(status).toHaveBeenCalledWith(403);
  });

  // ── getById ───────────────────────────────────────────────────────────────
  it('getById() returns 200 when driver exists', async () => {
    serviceMock.findDriver.mockResolvedValue(makeDriver());

    const req = makeReq({ params: { id: 'driver-001' } });
    const { res, json } = makeRes();

    await controller.getById(req, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ id: 'driver-001' }) });
  });

  it('getById() returns 404 when driver not found', async () => {
    serviceMock.findDriver.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'missing' } });
    const { res, status } = makeRes();

    await controller.getById(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });

  // ── create ────────────────────────────────────────────────────────────────
  it('create() returns 201 with the new driver', async () => {
    const newDriver = makeDriver();
    serviceMock.createDriver.mockResolvedValue(newDriver);

    const req = makeReq({ body: {
      email: 'raju@example.com', name: 'Raju Kumar',
      phone: '9876543210', licenseNumber: 'KA0120230001234',
    }});
    const { res, status } = makeRes();

    await controller.create(req, res);

    expect(status).toHaveBeenCalledWith(201);
  });

  it('create() returns 403 when tenantId is null', async () => {
    const req = makeReq({ user: { uid: 'u', role: 'super_admin', tenantId: null } as never });
    const { res, status } = makeRes();

    await controller.create(req, res);

    expect(status).toHaveBeenCalledWith(403);
  });

  // ── update ────────────────────────────────────────────────────────────────
  it('update() returns 200 with the updated driver', async () => {
    serviceMock.updateDriver.mockResolvedValue(makeDriver({ phone: '9999999999' }));

    const req = makeReq({ params: { id: 'driver-001' }, body: { phone: '9999999999' } });
    const { res, json } = makeRes();

    await controller.update(req, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ phone: '9999999999' }) });
  });

  it('update() returns 404 when driver not found', async () => {
    serviceMock.updateDriver.mockRejectedValue(new Error('DRIVER_NOT_FOUND'));

    const req = makeReq({ params: { id: 'missing' }, body: { phone: '9999999999' } });
    const { res, status } = makeRes();

    await controller.update(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });

  // ── delete ────────────────────────────────────────────────────────────────
  it('delete() returns 204 on success', async () => {
    serviceMock.deleteDriver.mockResolvedValue(undefined);

    const req = makeReq({ params: { id: 'driver-001' } });
    const { res, status } = makeRes();

    await controller.delete(req, res);

    expect(status).toHaveBeenCalledWith(204);
  });

  it('delete() returns 404 when driver not found', async () => {
    serviceMock.deleteDriver.mockRejectedValue(new Error('DRIVER_NOT_FOUND'));

    const req = makeReq({ params: { id: 'missing' } });
    const { res, status } = makeRes();

    await controller.delete(req, res);

    expect(status).toHaveBeenCalledWith(404);
  });
});
