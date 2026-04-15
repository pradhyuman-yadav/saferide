import type { Trip, StartTripInput } from '@saferide/types';
import { getRtdb } from '@saferide/firebase-admin';
import { createServiceLogger } from '@saferide/logger';
import { TripRepository } from '../repositories/trip.repository';
import { NotificationService } from './notification.service';
import { WebhookService } from './webhook.service';
import { BoardingService } from './boarding.service';

const log = createServiceLogger('trip');

const repo           = new TripRepository();
const notifications  = new NotificationService();
const webhooks       = new WebhookService();
const boardingService = new BoardingService();

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

  /** All recent trips for a tenant — for school_admin analytics. */
  listTenantTrips(tenantId: string, limit = 100): Promise<Trip[]> {
    return repo.listByTenant(tenantId, limit);
  }

  /** All recent trips across all tenants — for super_admin analytics. */
  listAllTrips(limit = 500): Promise<Trip[]> {
    return repo.listAll(limit);
  }

  async findTrip(id: string, tenantId: string): Promise<Trip | null> {
    const trip = await repo.findById(id, tenantId);
    if (trip === null) return null;
    // Defense-in-depth: verify tenantId even though the repo query already filters.
    // Prevents cross-tenant reads if a caller ever passes a stale or crafted ID.
    if (trip.tenantId !== tenantId) return null;
    return trip;
  }

  async getTrip(id: string, tenantId: string): Promise<Trip> {
    const trip = await this.findTrip(id, tenantId);
    if (trip === null) {
      log.warn({ tripId: id, tenantId }, 'trip not found');
      throw new Error('TRIP_NOT_FOUND');
    }
    return trip;
  }

  /**
   * Starts a new trip for the calling driver.
   * Rejects if the driver already has an active trip (prevents duplicate trips).
   */
  async startTrip(input: StartTripInput, driverId: string, tenantId: string): Promise<Trip> {
    const existing = await repo.findActiveByDriverId(driverId, tenantId);
    if (existing !== null) {
      log.warn({ driverId, tenantId, existingTripId: existing.id }, 'driver already has an active trip');
      throw new Error('TRIP_ALREADY_ACTIVE');
    }

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

    log.info(
      { tripId: created.id, driverId, busId: created.busId, routeId: created.routeId, tenantId },
      'trip started',
    );

    // Notify parents that the bus is on the way (fire-and-forget)
    void notifications.notifyParentsOfBus(
      created.busId, tenantId,
      'Bus is on the way',
      'Your child\'s bus has started. Track it live in SafeRide.',
    );

    void webhooks.deliverEvent('trip.started', {
      tripId:    created.id,
      busId:     created.busId,
      driverId:  created.driverId,
      startedAt: created.startedAt,
    }, tenantId);

    return created;
  }

  /**
   * Ends an active trip. Only the driver who started it may end it.
   * Clears the RTDB liveLocation node so parents see the bus go offline instantly.
   */
  async endTrip(tripId: string, driverId: string, tenantId: string): Promise<Trip> {
    const trip = await this.getTrip(tripId, tenantId);
    if (trip.driverId !== driverId) {
      log.warn({ tripId, driverId, ownerDriverId: trip.driverId, tenantId }, 'endTrip rejected — driver does not own this trip');
      throw new Error('TRIP_NOT_OWNED');
    }
    if (trip.status === 'ended') {
      log.warn({ tripId, tenantId }, 'endTrip rejected — trip already ended');
      throw new Error('TRIP_ALREADY_ENDED');
    }

    const endedAt = Date.now();
    await repo.update(tripId, tenantId, { status: 'ended', endedAt });

    // Remove RTDB node — connected clients receive null immediately,
    // which the mobile hook interprets as "bus offline"
    await getRtdb().ref(`liveLocation/${trip.busId}`).remove();

    // ── Boarding sweep — deboard any still-boarded students (fire-and-forget) ──
    void boardingService.sweepOnTripEnd(tripId, trip.busId, tenantId);

    // Notify parents the trip is over (fire-and-forget)
    void notifications.notifyParentsOfBus(
      trip.busId, tenantId,
      'Bus trip ended',
      'The bus has completed its route for today.',
    );

    const updated = await repo.findById(tripId, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated trip');

    const durationMinutes = trip.startedAt
      ? Math.round((endedAt - trip.startedAt) / 60_000)
      : null;
    log.info(
      { tripId, driverId, busId: trip.busId, routeId: trip.routeId, tenantId, durationMinutes },
      'trip ended',
    );

    void webhooks.deliverEvent('trip.ended', {
      tripId:    updated.id,
      busId:     updated.busId,
      driverId:  updated.driverId,
      startedAt: updated.startedAt,
      endedAt:   updated.endedAt,
    }, tenantId);

    return updated;
  }

  /**
   * Activates SOS for a trip. Only the owning driver on an active trip may call this.
   *
   * Side-effects (when notification service is wired in Phase 3):
   *   - Push notification → transport manager(s) in the same tenant
   *   - Audit event written by the caller (controller)
   *
   * The trip document gains `sosActive: true` and `sosTriggeredAt` so that:
   *   - Parent app can show a visual SOS indicator on the live map
   *   - Manager dashboard can highlight the bus immediately
   */
  async sendSOS(tripId: string, driverId: string, tenantId: string): Promise<Trip> {
    const trip = await this.getTrip(tripId, tenantId);
    if (trip.driverId !== driverId) {
      log.warn({ tripId, driverId, ownerDriverId: trip.driverId, tenantId }, 'sendSOS rejected — driver does not own this trip');
      throw new Error('TRIP_NOT_OWNED');
    }
    if (trip.status === 'ended') {
      log.warn({ tripId, tenantId }, 'sendSOS rejected — trip already ended');
      throw new Error('TRIP_ALREADY_ENDED');
    }

    const now = Date.now();
    await repo.setSosStatus(tripId, tenantId, true, now);

    // Notify managers of SOS (fire-and-forget)
    void notifications.notifyManagersOfTenant(
      tenantId,
      'SOS Alert',
      'A driver has triggered an SOS alert. Open SafeRide to respond.',
    );
    log.warn({ tripId, busId: trip.busId, driverId, tenantId }, 'SOS activated');

    const updated = await repo.findById(tripId, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated trip');

    void webhooks.deliverEvent('sos.triggered', {
      tripId:         updated.id,
      busId:          updated.busId,
      driverId:       updated.driverId,
      sosTriggeredAt: updated.sosTriggeredAt,
    }, tenantId);

    return updated;
  }

  /**
   * Cancels an active SOS. Only the owning driver may cancel.
   * Trip does not need to be active — a driver may cancel SOS just before ending the trip.
   */
  async cancelSOS(tripId: string, driverId: string, tenantId: string): Promise<Trip> {
    const trip = await this.getTrip(tripId, tenantId);
    if (trip.driverId !== driverId) {
      log.warn({ tripId, driverId, ownerDriverId: trip.driverId, tenantId }, 'cancelSOS rejected — driver does not own this trip');
      throw new Error('TRIP_NOT_OWNED');
    }

    await repo.setSosStatus(tripId, tenantId, false);

    // Notify managers SOS is cleared (fire-and-forget)
    void notifications.notifyManagersOfTenant(
      tenantId,
      'SOS Resolved',
      'The SOS alert has been cancelled by the driver.',
    );
    log.info({ tripId, busId: trip.busId, driverId, tenantId }, 'SOS cancelled');

    const updated = await repo.findById(tripId, tenantId);
    if (updated === null) throw new Error('Failed to retrieve updated trip');

    void webhooks.deliverEvent('sos.cancelled', {
      tripId:   updated.id,
      busId:    updated.busId,
      driverId: updated.driverId,
    }, tenantId);

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
