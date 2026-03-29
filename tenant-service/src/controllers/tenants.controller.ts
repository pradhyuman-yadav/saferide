import type { Request, Response } from 'express';
import { TenantsService } from '../services/tenants.service';
import { auditLog } from '@saferide/logger';

const service = new TenantsService();

export class TenantsController {
  async list(_req: Request, res: Response): Promise<void> {
    const tenants = await service.listTenants();
    res.json({ success: true, data: tenants });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    // school_admin can only access their own tenant
    if (req.user.role === 'school_admin' && req.user.tenantId !== id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only access your own school.' } });
      return;
    }
    const tenant = await service.getTenant(id);
    if (tenant === null) {
      res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'School not found.' } });
      return;
    }
    res.json({ success: true, data: tenant });
  }

  async create(req: Request, res: Response): Promise<void> {
    const tenant = await service.createTenant(req.body);
    auditLog({
      action:    'TENANT_CREATED',
      actorId:   req.user.uid,
      actorRole: req.user.role,
      targetId:  tenant.id,
      meta:      { tenantName: tenant.name, plan: tenant.plan },
    });
    res.status(201).json({ success: true, data: tenant });
  }

  async suspend(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    const tenant = await service.getTenant(id);
    if (tenant === null) {
      res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'School not found.' } });
      return;
    }
    if (tenant.status === 'suspended') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_SUSPENDED', message: 'This school is already suspended.' } });
      return;
    }
    await service.suspendTenant(id);
    auditLog({
      action:    'TENANT_SUSPENDED',
      actorId:   req.user.uid,
      actorRole: req.user.role,
      targetId:  id,
      tenantId:  id,
    });
    res.status(204).send();
  }

  async reactivate(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    const tenant = await service.getTenant(id);
    if (tenant === null) {
      res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'School not found.' } });
      return;
    }
    if (tenant.status === 'active') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_ACTIVE', message: 'This school is already active.' } });
      return;
    }
    await service.reactivateTenant(id);
    auditLog({
      action:    'TENANT_REACTIVATED',
      actorId:   req.user.uid,
      actorRole: req.user.role,
      targetId:  id,
      tenantId:  id,
    });
    res.status(204).send();
  }
}
