import type { Trip, StartTripInput } from '@saferide/types';
import { getRtdb } from '@saferide/firebase-admin';
import { TripRepository } from '../repositories/trip.repository';

const repo = new TripRepository();

export class TripService {
  /** Recent trips for the calling driver, newest first. */
  listMyTrips(driverId: string, tenantId: string, limit = 30): Promise<Trip[]> {
    return repo.listByDriverId(driverId, tenantId, limit);
  }

  /** Active trip for the calling driver. Returns null if no active trip. */
  findActiveForDriver(driverId: string, tenantId: string): Promise<Trip | null> {
    return repo.findActiveByDriverId(driverId, tenantId);
  }

  /** Active trip for a bus — REST fallback for parents without RTDB connection. */
  findActiveForBus(busId: string, tenantId: string): Promise<Trip | null> {
    return repo.findActiveByBusId(busId, tenantId);
  }

  /** Recent trip history for a bus — for parent history screen. */
  listTripsForBus(busId: string, tenantId: string, limit = 20): Promise<Trip[]> {
    return repo.listByBusId(busId, tenantId, limit);
  }

  async findTrip(id: string, tenantId: string): Promise<Trip | null> {
    return repo.findById(id, tenantId);
  }

  async getTrip(id: string, tenantId: string): Promise<Trip> {
    const trip = await this.findTrip(id, tenantId);
    if (trip === null) throw new Error('TRIP_NOT_FOUND');
    return trip;
  }

  /**
   * Starts a new trip for the calling driver.
   * Rejects if the driver already has an active trip (prevents duplicate trips).
   */
  async startTrip(input: StartTripInput, driverId: string, tenantId: string): Promise<Trip> {
    const existing = await repo.findActiveByDriverId(driverId, tenantId);
    if (existing !== null) throw new Error('TRIP_ALREADY_ACTIVE');

    const now    = Date.now();
    const tripId = await repo.create({
      tenantId,
      driverId,
      busId:     input.busId,
      routeId:   input.routeId,
      status:    'active',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const created = await repo.findById(tripId, tenantId);
    if (created === null) throw new Error('Failed to retrieve created trip');
    return created;
  }

  /**
   * Ends an active trip. Only the driver who started it may end it.
   * Clears the RTDB liveLocation node so parents see the bus go offline instantly.
   */
  async endTrip(tripId: string, driverId: string, tenantId: string): Promise<Trip> {
    const trip = await this.getTrip(tripId, tenantId);
    if (trip.driverId !== driverId) throw new Error('TRIP_NOT_OWNED');
    if (trip.status === 'ended') throw new Error('TRIP_ALREADY_ENDED');

    await repo.update(tripId, tenantId, { status: 'ended', endedAt: Date.now() });

    // Remove RTDB node — connected clients receive null immediately,
    // which the mobile hook interprets as "bus offline"
    await getRtdb().ref(`liveLocation/${trip.busId}`).remove();

    const updated = await repo.findById(tripId, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated trip');
    return updated;
  }

  /**
   * Stamps the latest GPS location onto the RTDB trip document.
   * Used as a polling fallback for clients not connected to RTDB live listener.
   */
  async updateLatestLocation(
    tripId:     string,
    tenantId:   string,
    lat:        number,
    lon:        number,
    speed:      number | undefined,
    heading:    number | undefined,
    recordedAt: number,
  ): Promise<void> {
    await repo.update(tripId, tenantId, {
      latestLat:        lat,
      latestLon:        lon,
      latestSpeed:      speed,
      latestHeading:    heading,
      latestRecordedAt: recordedAt,
    });
  }
}
