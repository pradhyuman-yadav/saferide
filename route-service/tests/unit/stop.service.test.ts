import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Stop, Route, CreateStopInput, UpdateStopInput } from '@saferide/types';

// ---------------------------------------------------------------------------
const stopRepoMock = vi.hoisted(() => ({
  listByRouteId: vi.fn(),
  findById:      vi.fn(),
  create:        vi.fn(),
  update:        vi.fn(),
  remove:        vi.fn(),
}));

const routeRepoMock = vi.hoisted(() => ({
  listByTenantId: vi.fn(),
  findById:       vi.fn(),
  create:         vi.fn(),
  update:         vi.fn(),
}));

vi.mock('../../src/repositories/stop.repository', () => ({
  StopRepository: vi.fn().mockImplementation(() => stopRepoMock),
}));

vi.mock('../../src/repositories/route.repository', () => ({
  RouteRepository: vi.fn().mockImplementation(() => routeRepoMock),
}));

const mockChildLogger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('@saferide/logger', () => ({
  logger:              { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog:            vi.fn(),
  createServiceLogger: vi.fn().mockReturnValue(mockChildLogger),
}));

import { StopService } from '../../src/services/stop.service';

// ---------------------------------------------------------------------------
function makeStop(overrides: Partial<Stop> = {}): Stop {
  return {
    id:                     'stop-001',
    tenantId:               'tenant-001',
    routeId:                'route-001',
    name:                   'Stop Alpha',
    sequence:               1,
    lat:                    12.9716,
    lon:                    77.5946,
    estimatedOffsetMinutes: 5,
    createdAt:              1700000000000,
    updatedAt:              1700000000000,
    ...overrides,
  };
}

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id:          'route-001',
    tenantId:    'tenant-001',
    name:        'Morning Route A',
    description: null,
    isActive:    true,
    createdAt:   1700000000000,
    updatedAt:   1700000000000,
    ...overrides,
  };
}

const validCreate: CreateStopInput = {
  name:                   'Stop Beta',
  sequence:               2,
  lat:                    12.9800,
  lon:                    77.6000,
  estimatedOffsetMinutes: 10,
};

// ---------------------------------------------------------------------------
describe('StopService', () => {
  let service: StopService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StopService();
  });

  // ── listStops ─────────────────────────────────────────────────────────────
  it('listStops() verifies route belongs to tenant, then returns stops', async () => {
    routeRepoMock.findById.mockResolvedValue(makeRoute());
    stopRepoMock.listByRouteId.mockResolvedValue([makeStop()]);

    const result = await service.listStops('route-001', 'tenant-001');

    expect(routeRepoMock.findById).toHaveBeenCalledWith('route-001', 'tenant-001');
    expect(stopRepoMock.listByRouteId).toHaveBeenCalledWith('route-001', 'tenant-001');
    expect(result).toHaveLength(1);
  });

  it('listStops() throws ROUTE_NOT_FOUND when route does not exist', async () => {
    routeRepoMock.findById.mockResolvedValue(null);
    await expect(service.listStops('missing', 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  it('listStops() throws ROUTE_NOT_FOUND when route belongs to different tenant', async () => {
    routeRepoMock.findById.mockResolvedValue(makeRoute({ tenantId: 'tenant-999' }));
    await expect(service.listStops('route-001', 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  // ── addStop ───────────────────────────────────────────────────────────────
  it('addStop() creates stop after verifying route ownership', async () => {
    routeRepoMock.findById.mockResolvedValue(makeRoute());
    stopRepoMock.create.mockResolvedValue('stop-002');
    stopRepoMock.findById.mockResolvedValue(makeStop({ id: 'stop-002' }));

    const result = await service.addStop('route-001', validCreate, 'tenant-001');

    const createCall = stopRepoMock.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(createCall['routeId']).toBe('route-001');
    expect(createCall['tenantId']).toBe('tenant-001');
    expect(result).toMatchObject({ id: 'stop-002' });
  });

  it('addStop() throws ROUTE_NOT_FOUND when route does not exist', async () => {
    routeRepoMock.findById.mockResolvedValue(null);
    await expect(service.addStop('missing', validCreate, 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  it('addStop() throws ROUTE_NOT_FOUND when route belongs to different tenant', async () => {
    routeRepoMock.findById.mockResolvedValue(makeRoute({ tenantId: 'tenant-999' }));
    await expect(service.addStop('route-001', validCreate, 'tenant-001')).rejects.toThrow('ROUTE_NOT_FOUND');
  });

  // ── updateStop ────────────────────────────────────────────────────────────
  it('updateStop() updates stop after verifying tenant ownership', async () => {
    const existing = makeStop();
    const updated  = makeStop({ sequence: 3 });
    stopRepoMock.findById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    stopRepoMock.update.mockResolvedValue(undefined);

    const input: UpdateStopInput = { sequence: 3 };
    const result = await service.updateStop('stop-001', input, 'tenant-001');

    expect(stopRepoMock.update).toHaveBeenCalledWith('stop-001', 'tenant-001', input);
    expect(result).toEqual(updated);
  });

  it('updateStop() throws STOP_NOT_FOUND when stop does not exist', async () => {
    stopRepoMock.findById.mockResolvedValue(null);
    await expect(service.updateStop('missing', { sequence: 1 }, 'tenant-001')).rejects.toThrow('STOP_NOT_FOUND');
  });

  it('updateStop() throws STOP_NOT_FOUND when stop belongs to different tenant', async () => {
    stopRepoMock.findById.mockResolvedValue(makeStop({ tenantId: 'tenant-999' }));
    await expect(service.updateStop('stop-001', { sequence: 1 }, 'tenant-001')).rejects.toThrow('STOP_NOT_FOUND');
  });

  // ── deleteStop ────────────────────────────────────────────────────────────
  it('deleteStop() removes stop after verifying tenant ownership', async () => {
    stopRepoMock.findById.mockResolvedValue(makeStop());
    stopRepoMock.remove.mockResolvedValue(undefined);

    await service.deleteStop('stop-001', 'tenant-001');

    expect(stopRepoMock.remove).toHaveBeenCalledWith('stop-001', 'tenant-001');
  });

  it('deleteStop() throws STOP_NOT_FOUND when stop does not exist', async () => {
    stopRepoMock.findById.mockResolvedValue(null);
    await expect(service.deleteStop('missing', 'tenant-001')).rejects.toThrow('STOP_NOT_FOUND');
  });

  it('deleteStop() throws STOP_NOT_FOUND when stop belongs to different tenant', async () => {
    stopRepoMock.findById.mockResolvedValue(makeStop({ tenantId: 'tenant-999' }));
    await expect(service.deleteStop('stop-001', 'tenant-001')).rejects.toThrow('STOP_NOT_FOUND');
  });
});
