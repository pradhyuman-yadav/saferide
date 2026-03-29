import type { Request, Response } from 'express';
import { TripService } from '../services/trip.service';
import { auditLog } from '@saferide/logger';

const service = new TripService();

export class TripController {
  /** GET /api/v1/trips — driver's own trip history, newest first */
  async list(req: Request, res: Response): Promise<void> {
    const { uid: driverId, tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const trips = await service.listMyTrips(driverId, tenantId);
    res.json({ success: true, data: trips });
  }

  /** POST /api/v1/trips — driver starts a trip */
  async start(req: Request, res: Response): Promise<void> {
    const { uid: driverId, tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    try {
      const trip = await service.startTrip(req.body, driverId, tenantId);
      auditLog({
        action:    'TRIP_STARTED',
        actorId:   driverId,
        actorRole: req.user.role,
        tenantId,
        targetId:  trip.id,
        meta:      { busId: trip.busId, routeId: trip.routeId },
      });
      res.status(201).json({ success: true, data: trip });
    } catch (err) {
      if (err instanceof Error && err.message === 'TRIP_ALREADY_ACTIVE') {
        res.status(409).json({ success: false, error: { code: 'TRIP_ALREADY_ACTIVE', message: 'You already have an active trip. End it before starting a new one.' } });
        return;
      }
      throw err;
    }
  }

  /** POST /api/v1/trips/:id/end — driver ends their trip */
  async end(req: Request, res: Response): Promise<void> {
    const { uid: driverId, tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const { id } = req.params as { id: string };
    try {
      const trip = await service.endTrip(id, driverId, tenantId);
      auditLog({
        action:    'TRIP_ENDED',
        actorId:   driverId,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
        meta:      { busId: trip.busId, routeId: trip.routeId },
      });
      res.json({ success: true, data: trip });
    } catch (err) {
      if (err instanceof Error && err.message === 'TRIP_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'TRIP_NOT_FOUND', message: 'Trip not found.' } });
        return;
      }
      if (err instanceof Error && err.message === 'TRIP_NOT_OWNED') {
        res.status(403).json({ success: false, error: { code: 'TRIP_NOT_OWNED', message: 'You can only end your own trips.' } });
        return;
      }
      if (err instanceof Error && err.message === 'TRIP_ALREADY_ENDED') {
        res.status(409).json({ success: false, error: { code: 'TRIP_ALREADY_ENDED', message: 'This trip has already ended.' } });
        return;
      }
      throw err;
    }
  }

  /** GET /api/v1/trips/active — driver polls their own active trip */
  async getActive(req: Request, res: Response): Promise<void> {
    const { uid: driverId, tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const trip = await service.findActiveForDriver(driverId, tenantId);
    res.json({ success: true, data: trip });
  }

  /** GET /api/v1/trips/bus/:busId — trip history for a bus (parents, managers) */
  async listForBus(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const { busId } = req.params as { busId: string };
    const trips = await service.listTripsForBus(busId, tenantId);
    res.json({ success: true, data: trips });
  }

  /** GET /api/v1/trips/bus/:busId/active — parents poll bus location */
  async getActiveForBus(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const { busId } = req.params as { busId: string };
    const trip = await service.findActiveForBus(busId, tenantId);
    res.json({ success: true, data: trip });
  }
}
