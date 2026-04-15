/**
 * GeofenceService
 *
 * Called fire-and-forget after every GPS ping. Checks whether the bus has
 * entered a 1 km radius of any stop on its route that has not yet been alerted
 * this trip, then pushes notifications to parents at that stop.
 *
 * Performance: stops are cached per routeId so Firestore is read at most once
 * per unique route per service lifetime (~1 read per active trip).
 *
 * Safety: the entire check() method swallows all errors — it must never
 * propagate exceptions to the caller (telemetry recordPing is latency-sensitive).
 */
import { createServiceLogger } from '@saferide/logger';
import type { Trip, Stop } from '@saferide/types';
import { haversineMeters } from '../utils/geo';
import { StopRepository } from '../repositories/stop.repository';
import { StudentRepository } from '../repositories/student.repository';
import { TripRepository } from '../repositories/trip.repository';
import { NotificationService } from './notification.service';
import { WebhookService } from './webhook.service';

const log = createServiceLogger('geofence');

const GEOFENCE_RADIUS_M = 1_000; // 1 km

export class GeofenceService {
  private readonly stopRepo       = new StopRepository();
  private readonly studentRepo    = new StudentRepository();
  private readonly tripRepo       = new TripRepository();
  private readonly notifications  = new NotificationService();
  private readonly webhooks       = new WebhookService();

  /** In-memory stop cache: routeId → Stop[].  Populated lazily, never invalidated. */
  private readonly stopCache = new Map<string, Stop[]>();

  /**
   * Main entry point. Called fire-and-forget — never throws.
   *
   * @param trip     The active trip document (pre-fetched by recordPing).
   * @param lat      Bus latitude from this ping.
   * @param lon      Bus longitude from this ping.
   * @param tenantId Tenant owning the trip.
   */
  async check(trip: Trip, lat: number, lon: number, tenantId: string): Promise<void> {
    try {
      const stops = await this.getStops(trip.routeId, tenantId);

      for (const stop of stops) {
        // Skip already-alerted stops (anti-spam guard)
        if (trip.alertedStopIds?.includes(stop.id)) continue;

        const dist = haversineMeters(lat, lon, stop.lat, stop.lon);
        if (dist > GEOFENCE_RADIUS_M) continue;

        log.info(
          { tripId: trip.id, stopId: stop.id, stopName: stop.name, distM: Math.round(dist), tenantId },
          'Bus entering geofence — alerting parents',
        );

        // Atomic write first so concurrent pings don't double-alert
        await this.tripRepo.addAlertedStopId(trip.id, tenantId, stop.id);

        const title = 'Bus Approaching';
        const body  = `Your child's bus is approaching ${stop.name} — be ready in 2–3 minutes.`;

        void this.notifications.notifyParentsAtStop(stop.id, stop.name, tenantId, title, body);

        void this.webhooks.deliverEvent(
          'bus.approaching_stop',
          {
            tripId:   trip.id,
            busId:    trip.busId,
            stopId:   stop.id,
            stopName: stop.name,
            lat,
            lon,
          },
          tenantId,
        );
      }
    } catch (err) {
      log.error({ err, tripId: trip.id, tenantId }, 'GeofenceService.check failed — suppressed');
    }
  }

  /** Returns stops from cache, fetching from Firestore on first access per routeId. */
  private async getStops(routeId: string, tenantId: string): Promise<Stop[]> {
    const cached = this.stopCache.get(routeId);
    if (cached !== undefined) return cached;

    const stops = await this.stopRepo.listByRouteId(routeId, tenantId);
    this.stopCache.set(routeId, stops);
    return stops;
  }
}
