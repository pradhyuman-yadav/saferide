/**
 * SpeedAlertService
 *
 * Called fire-and-forget after every GPS ping that includes a speed value.
 * Performs two independent checks:
 *
 * 1. **Speeding** — speed > 60 km/h → alert managers + parents on bus.
 * 2. **Rash driving** — |currentSpeed - previousSpeed| > 20 km/h → alert managers only.
 *
 * Both checks have a 5-minute (300 s) per-trip cooldown stored as
 * `lastSpeedingAlertAt` / `lastRashDrivingAlertAt` on the trip document.
 * The cooldown timestamp is written before notifications fire so concurrent
 * pings do not cause duplicate alerts.
 *
 * Safety: the entire check() method swallows all errors — it must never
 * propagate exceptions to the caller (telemetry recordPing is latency-sensitive).
 */
import { createServiceLogger } from '@saferide/logger';
import type { Trip } from '@saferide/types';
import { TripRepository } from '../repositories/trip.repository';
import { NotificationService } from './notification.service';
import { WebhookService } from './webhook.service';

const log = createServiceLogger('speed-alert');

const SPEED_LIMIT_KMH      = 60;
const RASH_DELTA_KMH       = 20;
const COOLDOWN_MS          = 300_000; // 5 minutes

export class SpeedAlertService {
  private readonly tripRepo      = new TripRepository();
  private readonly notifications = new NotificationService();
  private readonly webhooks      = new WebhookService();

  /**
   * Main entry point. Called fire-and-forget — never throws.
   *
   * @param trip         The active trip document (pre-fetched by recordPing).
   * @param currentSpeed Speed from the current GPS ping, in km/h.
   * @param tenantId     Tenant owning the trip.
   */
  async check(trip: Trip, currentSpeed: number, tenantId: string): Promise<void> {
    try {
      const now          = Date.now();
      const previousSpeed = trip.latestSpeed; // undefined on the first ping

      await Promise.all([
        this.checkSpeeding(trip, currentSpeed, now, tenantId),
        this.checkRashDriving(trip, currentSpeed, previousSpeed, now, tenantId),
      ]);
    } catch (err) {
      log.error({ err, tripId: trip.id, tenantId }, 'SpeedAlertService.check failed — suppressed');
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async checkSpeeding(
    trip:         Trip,
    speed:        number,
    now:          number,
    tenantId:     string,
  ): Promise<void> {
    if (speed <= SPEED_LIMIT_KMH) return;

    const lastAlertAt = trip.lastSpeedingAlertAt ?? 0;
    if (now - lastAlertAt <= COOLDOWN_MS) return;

    log.warn({ tripId: trip.id, busId: trip.busId, speed, tenantId }, 'Speeding detected');

    // Write cooldown timestamp before firing notifications to prevent races
    await this.tripRepo.update(trip.id, tenantId, { lastSpeedingAlertAt: now });

    const title  = 'Speeding Alert';
    const body   = `Bus ${trip.busId} is travelling at ${Math.round(speed)} km/h — above the 60 km/h limit.`;
    void this.notifications.notifyManagersOfTenant(tenantId, title, body);
    void this.notifications.notifyParentsOfBus(trip.busId, tenantId, title, body);
    void this.webhooks.deliverEvent(
      'bus.speeding',
      { tripId: trip.id, busId: trip.busId, speed },
      tenantId,
    );
  }

  private async checkRashDriving(
    trip:          Trip,
    currentSpeed:  number,
    previousSpeed: number | undefined,
    now:           number,
    tenantId:      string,
  ): Promise<void> {
    if (previousSpeed === undefined) return; // first ping — no delta to compute

    const delta = Math.abs(currentSpeed - previousSpeed);
    if (delta <= RASH_DELTA_KMH) return;

    const lastAlertAt = trip.lastRashDrivingAlertAt ?? 0;
    if (now - lastAlertAt <= COOLDOWN_MS) return;

    log.warn(
      { tripId: trip.id, busId: trip.busId, previousSpeed, currentSpeed, delta, tenantId },
      'Rash driving detected',
    );

    await this.tripRepo.update(trip.id, tenantId, { lastRashDrivingAlertAt: now });

    const title = 'Rash Driving Alert';
    const body  = `Bus ${trip.busId} shows sudden speed change of ${Math.round(delta)} km/h.`;
    void this.notifications.notifyManagersOfTenant(tenantId, title, body);
    // Parents are NOT notified for rash driving — only for speeding (manager-only alert)
    void this.webhooks.deliverEvent(
      'bus.rash_driving',
      { tripId: trip.id, busId: trip.busId, speedDelta: delta },
      tenantId,
    );
  }
}
