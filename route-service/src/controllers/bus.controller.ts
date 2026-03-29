import type { Request, Response } from 'express';
import { BusService } from '../services/bus.service';
import { auditLog } from '@saferide/logger';

const service = new BusService();

export class BusController {
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const buses = await service.listBuses(tenantId);
    res.json({ success: true, data: buses });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    const bus = await service.findBus(id, tenantId);
    if (bus === null) {
      res.status(404).json({ success: false, error: { code: 'BUS_NOT_FOUND', message: 'Bus not found.' } });
      return;
    }
    res.json({ success: true, data: bus });
  }

  async create(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const bus = await service.createBus(req.body, tenantId);
    auditLog({
      action:    'BUS_CREATED',
      actorId:   req.user.uid,
      actorRole: req.user.role,
      tenantId,
      targetId:  bus.id,
      meta:      { registrationNumber: bus.registrationNumber },
    });
    res.status(201).json({ success: true, data: bus });
  }

  async update(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      const bus = await service.updateBus(id, req.body, tenantId);
      auditLog({
        action:    'BUS_UPDATED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
      });
      res.json({ success: true, data: bus });
    } catch (err) {
      if (err instanceof Error && err.message === 'BUS_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'BUS_NOT_FOUND', message: 'Bus not found.' } });
        return;
      }
      throw err;
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      await service.deleteBus(id, tenantId);
      auditLog({
        action:    'BUS_DELETED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
      });
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'BUS_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'BUS_NOT_FOUND', message: 'Bus not found.' } });
        return;
      }
      throw err;
    }
  }

  async assignDriver(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    const { driverId } = req.body as { driverId: string | null };
    try {
      const bus = await service.assignDriver(id, driverId, tenantId);
      auditLog({
        action:    'BUS_DRIVER_ASSIGNED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
        meta:      { driverId },
      });
      res.json({ success: true, data: bus });
    } catch (err) {
      if (err instanceof Error && err.message === 'BUS_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'BUS_NOT_FOUND', message: 'Bus not found.' } });
        return;
      }
      if (err instanceof Error && err.message === 'DRIVER_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'DRIVER_NOT_FOUND', message: 'Driver not found.' } });
        return;
      }
      throw err;
    }
  }

  async assignRoute(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    const { routeId } = req.body as { routeId: string | null };
    try {
      const bus = await service.assignRoute(id, routeId, tenantId);
      auditLog({
        action:    'BUS_ROUTE_ASSIGNED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
        meta:      { routeId },
      });
      res.json({ success: true, data: bus });
    } catch (err) {
      if (err instanceof Error && err.message === 'BUS_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'BUS_NOT_FOUND', message: 'Bus not found.' } });
        return;
      }
      if (err instanceof Error && err.message === 'ROUTE_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
        return;
      }
      if (err instanceof Error && err.message === 'ROUTE_ALREADY_HAS_BUS') {
        res.status(409).json({ success: false, error: { code: 'ROUTE_ALREADY_HAS_BUS', message: 'Another bus is already assigned to this route.' } });
        return;
      }
      throw err;
    }
  }
}
