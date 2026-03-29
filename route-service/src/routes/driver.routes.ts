import { Router } from 'express';
import { verifyJwt, requireRole, readRateLimiter, validateBody } from '@saferide/middleware';
import { CreateDriverSchema, UpdateDriverSchema } from '@saferide/types';
import { DriverController } from '../controllers/driver.controller';

const controller = new DriverController();
export const driverRouter = Router();

// All driver routes require authentication + standard rate limiting
driverRouter.use(readRateLimiter);
driverRouter.use(verifyJwt);

// GET /api/v1/drivers
driverRouter.get(
  '/',
  requireRole('school_admin', 'manager'),
  (req, res, next) => { controller.list(req, res).catch(next); },
);

// GET /api/v1/drivers/:id
driverRouter.get(
  '/:id',
  requireRole('school_admin', 'manager'),
  (req, res, next) => { controller.getById(req, res).catch(next); },
);

// POST /api/v1/drivers
driverRouter.post(
  '/',
  requireRole('school_admin', 'manager'),
  validateBody(CreateDriverSchema),
  (req, res, next) => { controller.create(req, res).catch(next); },
);

// PATCH /api/v1/drivers/:id
driverRouter.patch(
  '/:id',
  requireRole('school_admin', 'manager'),
  validateBody(UpdateDriverSchema),
  (req, res, next) => { controller.update(req, res).catch(next); },
);

// DELETE /api/v1/drivers/:id — soft delete (isActive → false)
driverRouter.delete(
  '/:id',
  requireRole('school_admin'),
  (req, res, next) => { controller.delete(req, res).catch(next); },
);
