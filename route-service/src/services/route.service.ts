import type { Route, CreateRouteInput, UpdateRouteInput } from '@saferide/types';
import { RouteRepository } from '../repositories/route.repository';

const repo = new RouteRepository();

export class RouteService {
  listRoutes(tenantId: string): Promise<Route[]> {
    return repo.listByTenantId(tenantId);
  }

  async findRoute(id: string, tenantId: string): Promise<Route | null> {
    const route = await repo.findById(id, tenantId);
    // Defense-in-depth: verify tenantId even if repo enforces it at query level
    if (route !== null && route.tenantId !== tenantId) return null;
    return route;
  }

  async getRoute(id: string, tenantId: string): Promise<Route> {
    const route = await this.findRoute(id, tenantId);
    if (route === null) throw new Error('ROUTE_NOT_FOUND');
    return route;
  }

  async createRoute(input: CreateRouteInput, tenantId: string): Promise<Route> {
    const now     = Date.now();
    const routeId = await repo.create({
      tenantId,
      name:        input.name,
      description: input.description ?? null,
      isActive:    true,
      createdAt:   now,
      updatedAt:   now,
    });

    const created = await repo.findById(routeId, tenantId);
    if (created === null) throw new Error('Failed to retrieve created route');
    return created;
  }

  async updateRoute(id: string, input: UpdateRouteInput, tenantId: string): Promise<Route> {
    const existing = await this.findRoute(id, tenantId);
    if (existing === null) throw new Error('ROUTE_NOT_FOUND');

    await repo.update(id, tenantId, input);

    const updated = await repo.findById(id, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated route');
    return updated;
  }

  async deactivateRoute(id: string, tenantId: string): Promise<void> {
    const existing = await this.findRoute(id, tenantId);
    if (existing === null) throw new Error('ROUTE_NOT_FOUND');
    await repo.update(id, tenantId, { isActive: false });
  }
}
