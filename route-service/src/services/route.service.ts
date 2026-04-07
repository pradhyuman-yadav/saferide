import type { Route, CreateRouteInput, UpdateRouteInput } from '@saferide/types';
import { createServiceLogger } from '@saferide/logger';
import { RouteRepository } from '../repositories/route.repository';
import { StopRepository }  from '../repositories/stop.repository';
import { config }          from '../config';

const log = createServiceLogger('route');

const repo     = new RouteRepository();
const stopRepo = new StopRepository();

// ── Google Directions helpers (server-side, key never leaves backend) ─────────

interface LatLon { lat: number; lon: number }

function decodePolyline(encoded: string): LatLon[] {
  const pts: LatLon[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push({ lat: lat / 1e5, lon: lng / 1e5 });
  }
  return pts;
}

async function callDirectionsApi(waypoints: LatLon[], apiKey: string): Promise<LatLon[]> {
  if (waypoints.length < 2) return [];
  const origin      = waypoints[0]!;
  const destination = waypoints[waypoints.length - 1]!;
  const middle      = waypoints.slice(1, -1);
  const wpStr       = middle.length > 0
    ? `&waypoints=optimize:false|${middle.map((w) => `${w.lat},${w.lon}`).join('|')}`
    : '';
  const url = `https://maps.googleapis.com/maps/api/directions/json`
            + `?origin=${origin.lat},${origin.lon}`
            + `&destination=${destination.lat},${destination.lon}`
            + wpStr
            + `&mode=driving`
            + `&key=${apiKey}`;

  const res  = await fetch(url);
  const data = await res.json() as {
    status: string;
    routes?: { overview_polyline?: { points: string } }[];
  };
  if (data.status !== 'OK') return [];
  const pts = data.routes?.[0]?.overview_polyline?.points;
  return pts ? decodePolyline(pts) : [];
}

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
    if (route === null) {
      log.warn({ routeId: id, tenantId }, 'route not found');
      throw new Error('ROUTE_NOT_FOUND');
    }
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
    log.info({ routeId: created.id, tenantId, name: created.name }, 'route created');
    return created;
  }

  async updateRoute(id: string, input: UpdateRouteInput, tenantId: string): Promise<Route> {
    const existing = await this.findRoute(id, tenantId);
    if (existing === null) throw new Error('ROUTE_NOT_FOUND');

    await repo.update(id, tenantId, input);

    const updated = await repo.findById(id, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated route');
    log.info({ routeId: id, tenantId, fields: Object.keys(input) }, 'route updated');
    return updated;
  }

  async deactivateRoute(id: string, tenantId: string): Promise<void> {
    const existing = await this.findRoute(id, tenantId);
    if (existing === null) throw new Error('ROUTE_NOT_FOUND');
    await repo.update(id, tenantId, { isActive: false });
    log.info({ routeId: id, tenantId }, 'route deactivated');
  }

  /**
   * Returns a road-following polyline for all stops on this route in sequence.
   * Requires GOOGLE_MAPS_DIRECTIONS_KEY in env; returns [] when not configured.
   * Called once per route load — safe to cache client-side between trips.
   */
  async getRoutePolyline(id: string, tenantId: string): Promise<LatLon[]> {
    const route = await this.findRoute(id, tenantId);
    if (route === null) throw new Error('ROUTE_NOT_FOUND');
    if (!config.GOOGLE_MAPS_DIRECTIONS_KEY) {
      log.warn({ routeId: id, tenantId }, 'GOOGLE_MAPS_DIRECTIONS_KEY not configured — returning empty polyline');
      return [];
    }

    const stops  = await stopRepo.listByRouteId(id, tenantId);
    const sorted = stops.slice().sort((a, b) => a.sequence - b.sequence);
    if (sorted.length < 2) {
      log.debug({ routeId: id, stopCount: sorted.length }, 'not enough stops to compute polyline');
      return [];
    }

    const t0 = Date.now();
    const points = await callDirectionsApi(
      sorted.map((s) => ({ lat: s.lat, lon: s.lon })),
      config.GOOGLE_MAPS_DIRECTIONS_KEY,
    );
    log.info(
      { routeId: id, tenantId, stopCount: sorted.length, pointCount: points.length, durationMs: Date.now() - t0 },
      'route polyline fetched from Directions API',
    );
    return points;
  }

  /**
   * Proxies a single origin → destination Directions API call.
   * Used by the driver app to draw the nav line from current position to next stop
   * without embedding the API key in the mobile bundle.
   */
  async getDirectionsPolyline(origin: LatLon, destination: LatLon): Promise<LatLon[]> {
    if (!config.GOOGLE_MAPS_DIRECTIONS_KEY) {
      log.warn({}, 'GOOGLE_MAPS_DIRECTIONS_KEY not configured — returning empty directions polyline');
      return [];
    }
    const t0 = Date.now();
    const points = await callDirectionsApi([origin, destination], config.GOOGLE_MAPS_DIRECTIONS_KEY);
    log.debug(
      { origin, destination, pointCount: points.length, durationMs: Date.now() - t0 },
      'directions polyline fetched',
    );
    return points;
  }
}
