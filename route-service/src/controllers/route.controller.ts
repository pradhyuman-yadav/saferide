import type { Request, Response } from 'express';
import { RouteService } from '../services/route.service';
import { auditLog } from '@saferide/logger';

const service = new RouteService();

export class RouteController {
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const routes = await service.listRoutes(tenantId);
    res.json({ success: true, data: routes });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    const route = await service.findRoute(id, tenantId);
    if (route === null) {
      res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
      return;
    }
    res.json({ success: true, data: route });
  }

  async create(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const route = await service.createRoute(req.body, tenantId);
    auditLog({
      action:    'ROUTE_CREATED',
      actorId:   req.user.uid,
      actorRole: req.user.role,
      tenantId,
      targetId:  route.id,
      meta:      { routeName: route.name },
    });
    res.status(201).json({ success: true, data: route });
  }

  async update(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      const route = await service.updateRoute(id, req.body, tenantId);
      auditLog({ action: 'ROUTE_UPDATED', actorId: req.user.uid, actorRole: req.user.role, tenantId, targetId: id });
      res.json({ success: true, data: route });
    } catch (err) {
      if (err instanceof Error && err.message === 'ROUTE_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
        return;
      }
      throw err;
    }
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    const tenantId = req.user.tenantId;
    if (tenantId === null) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'A school context is required.' } });
      return;
    }
    const { id } = req.params as { id: string };
    try {
      await service.deactivateRoute(id, tenantId);
      auditLog({ action: 'ROUTE_DEACTIVATED', actorId: req.user.uid, actorRole: req.user.role, tenantId, targetId: id });
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'ROUTE_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
        return;
      }
      throw err;
    }
  }
}
