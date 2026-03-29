import type { GpsTelemetry, CreateTelemetryInput } from '@saferide/types';
import { getRtdb } from '@saferide/firebase-admin';
import { TelemetryRepository } from '../repositories/telemetry.repository';
import { TripService } from './trip.service';

const repo        = new TelemetryRepository();
const tripService = new TripService();

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
    if (trip === null) throw new Error('TRIP_NOT_FOUND');
    if (trip.driverId !== driverId) throw new Error('TRIP_NOT_OWNED');
    if (trip.status !== 'active') throw new Error('TRIP_NOT_ACTIVE');

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
