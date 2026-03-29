import type { Request, Response } from 'express';
import { DriverService } from '../services/driver.service';
import { auditLog } from '@saferide/logger';

const service = new DriverService();

export class DriverController {
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const drivers = await service.listDrivers(tenantId);
    res.json({ success: true, data: drivers });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    const driver = await service.findDriver(id, tenantId);
    if (driver === null) {
      res.status(404).json({ success: false, error: { code: 'DRIVER_NOT_FOUND', message: 'Driver not found.' } });
      return;
    }
    res.json({ success: true, data: driver });
  }

  async create(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const driver = await service.createDriver(req.body, tenantId);
    auditLog({
      action:    'DRIVER_CREATED',
      actorId:   req.user.uid,
      actorRole: req.user.role,
      tenantId,
      targetId:  driver.id,
      meta:      { name: driver.name, firebaseUid: driver.firebaseUid },
    });
    res.status(201).json({ success: true, data: driver });
  }

  async update(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      const driver = await service.updateDriver(id, req.body, tenantId);
      auditLog({
        action:    'DRIVER_UPDATED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
      });
      res.json({ success: true, data: driver });
    } catch (err) {
      if (err instanceof Error && err.message === 'DRIVER_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'DRIVER_NOT_FOUND', message: 'Driver not found.' } });
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
      await service.deleteDriver(id, tenantId);
      auditLog({
        action:    'DRIVER_DELETED',
        actorId:   req.user.uid,
        actorRole: req.user.role,
        tenantId,
        targetId:  id,
      });
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'DRIVER_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'DRIVER_NOT_FOUND', message: 'Driver not found.' } });
        return;
      }
      throw err;
    }
  }
}
