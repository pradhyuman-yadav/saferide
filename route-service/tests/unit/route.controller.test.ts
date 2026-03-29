import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Route, UserRole } from '@saferide/types';

// ---------------------------------------------------------------------------
const serviceMock = vi.hoisted(() => ({
  listRoutes:      vi.fn(),
  findRoute:       vi.fn(),
  createRoute:     vi.fn(),
  updateRoute:     vi.fn(),
  deactivateRoute: vi.fn(),
}));

vi.mock('../../src/services/route.service', () => ({
  RouteService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }, auditLog: vi.fn(),
}));

import { RouteController } from '../../src/controllers/route.controller';

// ---------------------------------------------------------------------------
function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'route-001', tenantId: 'tenant-001', name: 'Morning Route A',
    description: null, isActive: true, createdAt: 1700000000000, updatedAt: 1700000000000,
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
describe('RouteController', () => {
  let controller: RouteController;

  beforeEach(() => { vi.clearAllMocks(); controller = new RouteController(); });

  // ── list ──────────────────────────────────────────────────────────────────
  it('list() returns 200 with routes', async () => {
    serviceMock.listRoutes.mockResolvedValue([makeRoute()]);
    const res = mockRes();
    await controller.list(mockReq(), res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [makeRoute()] });
  });

  it('list() returns 403 when tenantId is null', async () => {
    const res = mockRes();
    await controller.list(
      mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(serviceMock.listRoutes).not.toHaveBeenCalled();
  });

  // ── getById ───────────────────────────────────────────────────────────────
  it('getById() returns 200 when route found', async () => {
    serviceMock.findRoute.mockResolvedValue(makeRoute());
    const res = mockRes();
    await controller.getById(mockReq({ params: { id: 'route-001' } }), res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: makeRoute() });
  });

  it('getById() returns 404 when route not found', async () => {
    serviceMock.findRoute.mockResolvedValue(null);
    const res = mockRes();
    await controller.getById(mockReq({ params: { id: 'missing' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'ROUTE_NOT_FOUND' }) }),
    );
  });

  // ── create ────────────────────────────────────────────────────────────────
  it('create() returns 201 with the created route', async () => {
    serviceMock.createRoute.mockResolvedValue(makeRoute());
    const res = mockRes();
    await controller.create(mockReq({ body: { name: 'New Route' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: makeRoute() });
  });

  it('create() returns 403 when tenantId is null', async () => {
    const res = mockRes();
    await controller.create(
      mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ── update ────────────────────────────────────────────────────────────────
  it('update() returns 200 with the updated route', async () => {
    serviceMock.updateRoute.mockResolvedValue(makeRoute({ name: 'Updated' }));
    const res = mockRes();
    await controller.update(mockReq({ params: { id: 'route-001' }, body: { name: 'Updated' } }), res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: makeRoute({ name: 'Updated' }) });
  });

  it('update() returns 404 when service throws ROUTE_NOT_FOUND', async () => {
    serviceMock.updateRoute.mockRejectedValue(new Error('ROUTE_NOT_FOUND'));
    const res = mockRes();
    await controller.update(mockReq({ params: { id: 'missing' }, body: { name: 'X' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('update() re-throws unknown errors', async () => {
    serviceMock.updateRoute.mockRejectedValue(new Error('UNEXPECTED'));
    const res = mockRes();
    await expect(
      controller.update(mockReq({ params: { id: 'route-001' }, body: { name: 'X' } }), res as unknown as Response),
    ).rejects.toThrow('UNEXPECTED');
  });

  // ── deactivate ────────────────────────────────────────────────────────────
  it('deactivate() returns 204 on success', async () => {
    serviceMock.deactivateRoute.mockResolvedValue(undefined);
    const res = mockRes();
    await controller.deactivate(mockReq({ params: { id: 'route-001' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('deactivate() returns 404 when service throws ROUTE_NOT_FOUND', async () => {
    serviceMock.deactivateRoute.mockRejectedValue(new Error('ROUTE_NOT_FOUND'));
    const res = mockRes();
    await controller.deactivate(mockReq({ params: { id: 'missing' } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
