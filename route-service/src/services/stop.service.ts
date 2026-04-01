import type { Stop, CreateStopInput, UpdateStopInput } from '@saferide/types';
import { StopRepository } from '../repositories/stop.repository';
import { RouteRepository } from '../repositories/route.repository';

const stopRepo  = new StopRepository();
const routeRepo = new RouteRepository();

export class StopService {
  /** Verify the route exists and belongs to tenantId, then list its stops. */
  async listStops(routeId: string, tenantId: string): Promise<Stop[]> {
    await this.requireRoute(routeId, tenantId);
    return stopRepo.listByRouteId(routeId, tenantId);
  }

  /** Add a stop to a route. Verifies route ownership before creating. */
  async addStop(routeId: string, input: CreateStopInput, tenantId: string): Promise<Stop> {
    await this.requireRoute(routeId, tenantId);

    const now    = Date.now();
    const stopId = await stopRepo.create({
      tenantId,
      routeId,
      name:                   input.name,
      sequence:               input.sequence,
      lat:                    input.lat,
      lon:                    input.lon,
      estimatedOffsetMinutes: input.estimatedOffsetMinutes,
      createdAt:              now,
      updatedAt:              now,
    });

    const created = await stopRepo.findById(stopId, tenantId);
    if (created === null) throw new Error('Failed to retrieve created stop');
    return created;
  }

  async updateStop(id: string, input: UpdateStopInput, tenantId: string): Promise<Stop> {
    const existing = await this.findStop(id, tenantId);
    if (existing === null) throw new Error('STOP_NOT_FOUND');

    await stopRepo.update(id, tenantId, input);

    const updated = await stopRepo.findById(id, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated stop');
    return updated;
  }

  async deleteStop(id: string, tenantId: string): Promise<void> {
    const existing = await this.findStop(id, tenantId);
    if (existing === null) throw new Error('STOP_NOT_FOUND');
    await stopRepo.remove(id, tenantId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findStop(id: string, tenantId: string): Promise<Stop | null> {
    const stop = await stopRepo.findById(id, tenantId);
    if (stop !== null && stop.tenantId !== tenantId) return null;
    return stop;
  }

  private async requireRoute(routeId: string, tenantId: string): Promise<void> {
    const route = await routeRepo.findById(routeId, tenantId);
    if (route === null || route.tenantId !== tenantId) throw new Error('ROUTE_NOT_FOUND');
  }
}
