import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Route, CreateRouteInput, UpdateRouteInput } from '@saferide/types';

// ---------------------------------------------------------------------------
const repoMock = vi.hoisted(() => ({
  listByTenantId: vi.fn(),
  findById:       vi.fn(),
  create:         vi.fn(),
  update:         vi.fn(),
}));

vi.mock('../../src/repositories/route.repository', () => ({
  RouteRepository: vi.fn().mockImplementation(() => repoMock),
}));

vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }, auditLog: vi.fn(),
}));

import { RouteService } from '../../src/services/route.service';

// ---------------------------------------------------------------------------
function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id:          'route-001',
    tenantId:    'tenant-001',
    name:        'Morning Route A',
    description: 'Sector 5 pickup',
    isActive:    true,
    createdAt:   1700000000000,
    updatedAt:   1700000000000,
    ...overrides,
  };
}

const validCreate: CreateRouteInput = { name: 'Evening Route B', description: null };

// ---------------------------------------------------------------------------
describe('RouteService', () => {
  let service: RouteService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RouteService();
  });

  // ── listRoutes ────────────────────────────────────────────────────────────
  it('listRoutes() returns array from repo.listByTenantId()', async () => {
    const routes = [makeRoute()];
    repoMock.listByTenantId.mockResolvedValue(routes);

    const result = await service.listRoutes('tenant-001');
    expect(repoMock.listByTenantId).toHaveBeenCalledWith('tenant-001');
    expect(result).toEqual(routes);
  });

  // ── findRoute ─────────────────────────────────────────────────────────────
  it('findRoute() returns route when id and tenantId match', async () => {
    repoMock.findById.mockResolvedValue(makeRoute());
    expect(await service.findRoute('route-001', 'tenant-001')).toMatchObject({ id: 'route-001' });
  });

  it('findRoute() returns null when route does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);
    expect(await service.findRoute('missing', 'tenant-001')).toBeNull();
  });

  it('findRoute() returns null when route belongs to a different tenant', async () => {
    repoMock.findById.mockResolvedValue(makeRoute({ tenantId: 'tenant-999' }));
    expect(await service.findRoute('route-001', 'tenant-001')).toBeNull();
  });

  // ── getRoute ──────────────────────────────────────────────────────────────
  it('getRoute() returns the route when found', async () => {
    repoMock.findById.mockResolvedValue(makeRoute());
    expect(await service.getRoute('route-001', 'tenant-001')).toMatchObject({ id: 'route-001' });
  });

  it('getRoute() throws ROUTE_NOT_FOUND when missing', async () => {
    repoMock.findById.mockResolvedValue(null);
    await expect(service.getRoute('missing', 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  it('getRoute() throws ROUTE_NOT_FOUND when wrong tenant', async () => {
    repoMock.findById.mockResolvedValue(makeRoute({ tenantId: 'tenant-999' }));
    await expect(service.getRoute('route-001', 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  // ── createRoute ───────────────────────────────────────────────────────────
  it('createRoute() creates and returns the route with isActive=true and correct tenantId', async () => {
    const created = makeRoute({ isActive: true, tenantId: 'tenant-001' });
    repoMock.create.mockResolvedValue('route-001');
    repoMock.findById.mockResolvedValue(created);

    const result = await service.createRoute(validCreate, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['isActive']).toBe(true);
    expect(createCall['tenantId']).toBe('tenant-001');
    expect(result).toEqual(created);
  });

  it('createRoute() sets description to null when not provided', async () => {
    repoMock.create.mockResolvedValue('route-001');
    repoMock.findById.mockResolvedValue(makeRoute());

    await service.createRoute({ name: 'Route X' }, 'tenant-001');

    const createCall = repoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['description']).toBeNull();
  });

  it('createRoute() throws when findById returns null after create', async () => {
    repoMock.create.mockResolvedValue('route-001');
    repoMock.findById.mockResolvedValue(null);
    await expect(service.createRoute(validCreate, 'tenant-001')).rejects.toThrow();
  });

  // ── updateRoute ───────────────────────────────────────────────────────────
  it('updateRoute() calls repo.update() and returns the updated route', async () => {
    const existing = makeRoute();
    const updated  = makeRoute({ name: 'Updated Name' });
    repoMock.findById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    repoMock.update.mockResolvedValue(undefined);

    const input: UpdateRouteInput = { name: 'Updated Name' };
    const result = await service.updateRoute('route-001', input, 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('route-001', 'tenant-001', input);
    expect(result).toEqual(updated);
  });

  it('updateRoute() throws ROUTE_NOT_FOUND when route does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);
    await expect(service.updateRoute('missing', { name: 'X' }, 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  it('updateRoute() throws ROUTE_NOT_FOUND when wrong tenant', async () => {
    repoMock.findById.mockResolvedValue(makeRoute({ tenantId: 'tenant-999' }));
    await expect(service.updateRoute('route-001', { name: 'X' }, 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  // ── deactivateRoute ───────────────────────────────────────────────────────
  it('deactivateRoute() sets isActive to false', async () => {
    repoMock.findById.mockResolvedValue(makeRoute());
    repoMock.update.mockResolvedValue(undefined);

    await service.deactivateRoute('route-001', 'tenant-001');

    expect(repoMock.update).toHaveBeenCalledWith('route-001', 'tenant-001', { isActive: false });
  });

  it('deactivateRoute() throws ROUTE_NOT_FOUND when route does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);
    await expect(service.deactivateRoute('missing', 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });
});
