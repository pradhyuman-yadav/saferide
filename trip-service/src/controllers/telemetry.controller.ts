import type { Request, Response } from 'express';
import { TelemetryService } from '../services/telemetry.service';
import { TripService } from '../services/trip.service';

const telemetryService = new TelemetryService();
const tripService      = new TripService();

export class TelemetryController {
  /**
   * POST /api/v1/trips/:id/location
   * Driver sends a GPS ping. Rate-limited to 60 req/min per device (applied in routes).
   */
  async recordPing(req: Request, res: Response): Promise<void> {
    const { uid: driverId, tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const { id: tripId } = req.params as { id: string };

    try {
      // We need the busId to denormalize onto the telemetry doc
      const trip = await tripService.findTrip(tripId, tenantId);
      if (trip === null) {
        res.status(404).json({ success: false, error: { code: 'TRIP_NOT_FOUND', message: 'Trip not found.' } });
        return;
      }

      const ping = await telemetryService.recordPing(tripId, req.body, driverId, trip.busId, tenantId);
      res.status(201).json({ success: true, data: ping });
    } catch (err) {
      if (err instanceof Error && err.message === 'TRIP_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'TRIP_NOT_FOUND', message: 'Trip not found.' } });
        return;
      }
      if (err instanceof Error && err.message === 'TRIP_NOT_OWNED') {
        res.status(403).json({ success: false, error: { code: 'TRIP_NOT_OWNED', message: 'You can only submit location updates for your own trips.' } });
        return;
      }
      if (err instanceof Error && err.message === 'TRIP_NOT_ACTIVE') {
        res.status(409).json({ success: false, error: { code: 'TRIP_NOT_ACTIVE', message: 'Location updates can only be submitted for active trips.' } });
        return;
      }
      throw err;
    }
  }

  /**
   * GET /api/v1/trips/:id/location/latest
   * Parents poll the latest GPS ping for a trip.
   * The denormalized location on the trip doc is faster, but this gives the
   * full telemetry object (speed, heading, accuracy) when needed.
   */
  async getLatest(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const { id: tripId } = req.params as { id: string };

    // Verify trip belongs to tenant before returning telemetry
    const trip = await tripService.findTrip(tripId, tenantId);
    if (trip === null) {
      res.status(404).json({ success: false, error: { code: 'TRIP_NOT_FOUND', message: 'Trip not found.' } });
      return;
    }

    const latest = await telemetryService.findLatest(tripId, tenantId);
    res.json({ success: true, data: latest });
  }
}
