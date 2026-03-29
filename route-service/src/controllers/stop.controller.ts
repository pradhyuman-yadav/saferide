import type { Request, Response } from 'express';
import { StopService } from '../services/stop.service';
import { auditLog } from '@saferide/logger';

const service = new StopService();

export class StopController {
  /** GET /routes/:routeId/stops */
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { routeId } = req.params as { routeId: string };
    try {
      const stops = await service.listStops(routeId, tenantId);
      res.json({ success: true, data: stops });
    } catch (err) {
      if (err instanceof Error && err.message === 'ROUTE_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
        return;
      }
      throw err;
    }
  }

  /** POST /routes/:routeId/stops */
  async create(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { routeId } = req.params as { routeId: string };
    try {
      const stop = await service.addStop(routeId, req.body, tenantId);
      auditLog({
        action:    'STOP_CREATED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  stop.id,
        meta:      { routeId, stopName: stop.name },
      });
      res.status(201).json({ success: true, data: stop });
    } catch (err) {
      if (err instanceof Error && err.message === 'ROUTE_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
        return;
      }
      throw err;
    }
  }

  /** PATCH /stops/:id */
  async update(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      const stop = await service.updateStop(id, req.body, tenantId);
      auditLog({ action: 'STOP_UPDATED', actorId: req.user.uid, actorRole: req.user.role, tenantId, targetId: id });
      res.json({ success: true, data: stop });
    } catch (err) {
      if (err instanceof Error && err.message === 'STOP_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'STOP_NOT_FOUND', message: 'Stop not found.' } });
        return;
      }
      throw err;
    }
  }

  /** DELETE /stops/:id */
  async delete(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      await service.deleteStop(id, tenantId);
      auditLog({ action: 'STOP_DELETED', actorId: req.user.uid, actorRole: req.user.role, tenantId, targetId: id });
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'STOP_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'STOP_NOT_FOUND', message: 'Stop not found.' } });
        return;
      }
      throw err;
    }
  }
}
