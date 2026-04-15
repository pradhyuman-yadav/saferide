import type { GpsTelemetry, CreateTelemetryInput } from '@saferide/types';
import { getRtdb } from '@saferide/firebase-admin';
import { createServiceLogger } from '@saferide/logger';
import { TelemetryRepository } from '../repositories/telemetry.repository';
import { TripService } from './trip.service';
import { GeofenceService } from './geofence.service';
import { SpeedAlertService } from './speed-alert.service';

const log = createServiceLogger('telemetry');

const repo              = new TelemetryRepository();
const tripService       = new TripService();
const geofenceService   = new GeofenceService();
const speedAlertService = new SpeedAlertService();

export class TelemetryService {
  /** Latest telemetry for a trip (parent read path — REST fallback). */
  findLatest(tripId: string, tenantId: string): Promise<GpsTelemetry | null> {
    return repo.findLatestByTripId(tripId, tenantId);
  }

  /**
   * Persists a GPS ping to RTDB (history) and pushes the latest location
   * to RTDB liveLocation (live — sub-second propagation to all connected mobile clients).
   * The trip must be active and owned by the calling driver.
   */
  async recordPing(
    tripId:   string,
    input:    CreateTelemetryInput,
    driverId: string,
    busId:    string,
    tenantId: string,
  ): Promise<GpsTelemetry> {
    // Verify the trip exists, is active, and belongs to this driver
    const trip = await tripService.findTrip(tripId, tenantId);
    if (trip === null) {
      log.warn({ tripId, driverId, tenantId }, 'GPS ping rejected — trip not found');
      throw new Error('TRIP_NOT_FOUND');
    }
    if (trip.driverId !== driverId) {
      log.warn({ tripId, driverId, ownerDriverId: trip.driverId, tenantId }, 'GPS ping rejected — driver does not own this trip');
      throw new Error('TRIP_NOT_OWNED');
    }
    if (trip.status !== 'active') {
      log.warn({ tripId, driverId, status: trip.status, tenantId }, 'GPS ping rejected — trip not active');
      throw new Error('TRIP_NOT_ACTIVE');
    }

    const now = Date.now();

    // ── 1. Persist full ping to RTDB (history + audit trail) ──────────────
    const id = await repo.create({
      tenantId,
      tripId,
      driverId,
      busId,
      lat:        input.lat,
      lon:        input.lon,
      speed:      input.speed,
      heading:    input.heading,
      accuracy:   input.accuracy,
      recordedAt: input.recordedAt,
      createdAt:  now,
    });

    // ── 2. Denormalize onto RTDB trip doc (polling fallback) ───────────────
    await tripService.updateLatestLocation(
      tripId,
      tenantId,
      input.lat,
      input.lon,
      input.speed,
      input.heading,
      input.recordedAt,
    );

    log.debug(
      { telemetryId: id, tripId, driverId, busId, tenantId, lat: input.lat, lon: input.lon, speed: input.speed ?? null, accuracy: input.accuracy ?? null },
      'GPS ping recorded',
    );

    // ── 3. Push to RTDB liveLocation — overwrites previous value, fires onValue instantly ──
    // Structure: liveLocation/{busId} — clients subscribe by busId, not tripId,
    // so parents don't need to know the tripId up front.
    await getRtdb()
      .ref(`liveLocation/${busId}`)
      .set({
        tripId,
        lat:        input.lat,
        lon:        input.lon,
        speed:      input.speed   ?? null,
        heading:    input.heading ?? null,
        accuracy:   input.accuracy ?? null,
        recordedAt: input.recordedAt,
        updatedAt:  now,
      });

    // ── 4. Geofence check — fire-and-forget (never blocks the response) ──────
    void geofenceService.check(trip, input.lat, input.lon, tenantId);

    // ── 5. Speed / rash-driving alerts — fire-and-forget ─────────────────────
    if (input.speed !== undefined) {
      void speedAlertService.check(trip, input.speed, tenantId);
    }

    return {
      id,
      tenantId,
      tripId,
      driverId,
      busId,
      lat:        input.lat,
      lon:        input.lon,
      speed:      input.speed,
      heading:    input.heading,
      accuracy:   input.accuracy,
      recordedAt: input.recordedAt,
      createdAt:  now,
    };
  }
}
