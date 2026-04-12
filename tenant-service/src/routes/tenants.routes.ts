import { Router } from 'express';
import { verifyJwt, requireRole, adminRateLimiter, validateBody } from '@saferide/middleware';
import { CreateTenantSchema } from '@saferide/types';
import { TenantsController } from '../controllers/tenants.controller';

const controller = new TenantsController();
export const tenantsRouter: Router = Router();

// All tenant routes require authentication + rate limiting
tenantsRouter.use(adminRateLimiter);
tenantsRouter.use(verifyJwt);

// Only super_admin can manage tenants
tenantsRouter.get(
  '/',
  requireRole('super_admin'),
  (req, res, next) => { controller.list(req, res).catch(next); },
);

tenantsRouter.get(
  '/:id',
  requireRole('super_admin', 'school_admin'),
  (req, res, next) => { controller.getById(req, res).catch(next); },
);

tenantsRouter.post(
  '/',
  requireRole('super_admin'),
  validateBody(CreateTenantSchema),
  (req, res, next) => { controller.create(req, res).catch(next); },
);

tenantsRouter.patch(
  '/:id/suspend',
  requireRole('super_admin'),
  (req, res, next) => { controller.suspend(req, res).catch(next); },
);

tenantsRouter.patch(
  '/:id/reactivate',
  requireRole('super_admin'),
  (req, res, next) => { controller.reactivate(req, res).catch(next); },
);
