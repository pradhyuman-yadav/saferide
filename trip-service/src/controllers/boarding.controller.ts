import type { Request, Response } from 'express';
import { BoardingService } from '../services/boarding.service';

const service = new BoardingService();

export class BoardingController {
  /** POST /api/v1/trips/:id/boarding — driver records a boarding/deboarding event */
  async record(req: Request, res: Response): Promise<void> {
    const { uid: driverId, tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const tripId = req.params['id'] as string;

    try {
      const id = await service.recordBoarding(tripId, req.body, driverId, tenantId);
      res.status(201).json({ success: true, data: { id } });
    } catch (err) {
      if (!(err instanceof Error)) throw err;

      const errorMap: Record<string, { status: number; code: string; message: string }> = {
        TRIP_NOT_FOUND:    { status: 404, code: 'TRIP_NOT_FOUND',    message: 'Trip not found.' },
        TRIP_NOT_ACTIVE:   { status: 409, code: 'TRIP_NOT_ACTIVE',   message: 'Trip is not active.' },
        TRIP_NOT_OWNED:    { status: 403, code: 'TRIP_NOT_OWNED',    message: 'You do not own this trip.' },
        STUDENT_NOT_FOUND: { status: 404, code: 'STUDENT_NOT_FOUND', message: 'Student not found.' },
        STUDENT_NOT_ON_BUS:{ status: 422, code: 'STUDENT_NOT_ON_BUS',message: 'Student is not assigned to this bus.' },
        ALREADY_BOARDED:   { status: 409, code: 'ALREADY_BOARDED',   message: 'Student is already marked as boarded on this trip.' },
      };

      const mapped = errorMap[err.message];
      if (mapped) {
        res.status(mapped.status).json({ success: false, error: { code: mapped.code, message: mapped.message } });
        return;
      }
      throw err;
    }
  }

  /** GET /api/v1/trips/:id/boarding — manager / school_admin lists boarding events */
  async list(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.user;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }

    const tripId = req.params['id'] as string;
    const events = await service.listBoarding(tripId, tenantId);
    res.json({ success: true, data: events });
  }
}
