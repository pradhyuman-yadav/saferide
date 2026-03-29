import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Stop, UserRole } from '@saferide/types';

// ---------------------------------------------------------------------------
const serviceMock = vi.hoisted(() => ({
  listStops:  vi.fn(),
  addStop:    vi.fn(),
  updateStop: vi.fn(),
  deleteStop: vi.fn(),
}));

vi.mock('../../src/services/stop.service', () => ({
  StopService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }, auditLog: vi.fn(),
}));

import { StopController } from '../../src/controllers/stop.controller';

// ---------------------------------------------------------------------------
function makeStop(overrides: Partial<Stop> = {}): Stop {
  return {
    id: 'stop-001', tenantId: 'tenant-001', routeId: 'route-001',
    name: 'Stop Alpha', sequence: 1, lat: 12.9716, lon: 77.5946,
    estimatedOffsetMinutes: 5, createdAt: 1700000000000, updatedAt: 1700000000000,
    ...overrides,
  };
}

function mockReq(overrides: Partial<{
  params: Record<string, string>;
  body:   unknown;
  user:   { uid: string; email: string; role: UserRole; tenantId: string | null };
}> = {}): Request {
  return {
    params: {}, body: {}, headers: {}, requestId: 'test-req-id',
    user: { uid: 'u1', email: 'admin@school.edu', role: 'school_admin', tenantId: 'tenant-001' },
    ...overrides,
  } as unknown as Request;
}

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
describe('StopController', () => {
  let controller: StopController;

  beforeEach(() => { vi.clearAllMocks(); controller = new StopController(); });

  // ── list ──────────────────────────────────────────────────────────────────
  it('list() returns 200 with stops for the route', async () => {
    serviceMock.listStops.mockResolvedValue([makeStop()]);
    const res = mockRes();
    await controller.list(mockReq({ params: { routeId: 'route-001' } }), res as unknown as Response);
    expect(serviceMock.listStops).toHaveBeenCalledWith('route-001', 'tenant-001');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [makeStop()] });
  });

  it('list() returns 404 when service throws ROUTE_NOT_FOUND', async () => {
    serviceMock.listStops.mockRejectedValue(new Error('ROUTE_NOT_FOUND'));
    const res = mockRes();
    await controller.list(mockReq({ params: { routeId: 'missing' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'ROUTE_NOT_FOUND' }) }),
    );
  });

  it('list() returns 403 when tenantId is null', async () => {
    const res = mockRes();
    await controller.list(
      mockReq({ params: { routeId: 'route-001' }, user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ── create ────────────────────────────────────────────────────────────────
  it('create() returns 201 with the new stop', async () => {
    const stop = makeStop();
    serviceMock.addStop.mockResolvedValue(stop);
    const res = mockRes();
    await controller.create(
      mockReq({ params: { routeId: 'route-001' }, body: { name: 'Stop Alpha', sequence: 1, lat: 12.97, lon: 77.59, estimatedOffsetMinutes: 5 } }),
      res as unknown as Response,
    );
    expect(serviceMock.addStop).toHaveBeenCalledWith('route-001', expect.any(Object), 'tenant-001');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: stop });
  });

  it('create() returns 404 when service throws ROUTE_NOT_FOUND', async () => {
    serviceMock.addStop.mockRejectedValue(new Error('ROUTE_NOT_FOUND'));
    const res = mockRes();
    await controller.create(mockReq({ params: { routeId: 'missing' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('create() returns 403 when tenantId is null', async () => {
    const res = mockRes();
    await controller.create(
      mockReq({ params: { routeId: 'route-001' }, user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ── update ────────────────────────────────────────────────────────────────
  it('update() returns 200 with the updated stop', async () => {
    serviceMock.updateStop.mockResolvedValue(makeStop({ sequence: 3 }));
    const res = mockRes();
    await controller.update(mockReq({ params: { id: 'stop-001' }, body: { sequence: 3 } }), res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: makeStop({ sequence: 3 }) });
  });

  it('update() returns 404 when service throws STOP_NOT_FOUND', async () => {
    serviceMock.updateStop.mockRejectedValue(new Error('STOP_NOT_FOUND'));
    const res = mockRes();
    await controller.update(mockReq({ params: { id: 'missing' }, body: { sequence: 1 } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('update() re-throws unknown errors', async () => {
    serviceMock.updateStop.mockRejectedValue(new Error('UNEXPECTED'));
    const res = mockRes();
    await expect(
      controller.update(mockReq({ params: { id: 'stop-001' }, body: { sequence: 1 } }), res as unknown as Response),
    ).rejects.toThrow('UNEXPECTED');
  });

  // ── delete ────────────────────────────────────────────────────────────────
  it('delete() returns 204 on success', async () => {
    serviceMock.deleteStop.mockResolvedValue(undefined);
    const res = mockRes();
    await controller.delete(mockReq({ params: { id: 'stop-001' } }), res as unknown as Response);
    expect(serviceMock.deleteStop).toHaveBeenCalledWith('stop-001', 'tenant-001');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('delete() returns 404 when service throws STOP_NOT_FOUND', async () => {
    serviceMock.deleteStop.mockRejectedValue(new Error('STOP_NOT_FOUND'));
    const res = mockRes();
    await controller.delete(mockReq({ params: { id: 'missing' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('delete() re-throws unknown errors', async () => {
    serviceMock.deleteStop.mockRejectedValue(new Error('UNEXPECTED'));
    const res = mockRes();
    await expect(
      controller.delete(mockReq({ params: { id: 'stop-001' } }), res as unknown as Response),
    ).rejects.toThrow('UNEXPECTED');
  });
});
