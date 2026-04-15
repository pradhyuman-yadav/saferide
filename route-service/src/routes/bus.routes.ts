import { Router } from 'express';
import { verifyJwt, requireRole, readRateLimiter, validateBody } from '@saferide/middleware';
import { CreateBusSchema, UpdateBusSchema, AssignBusDriverSchema, AssignBusRouteSchema } from '@saferide/types';
import { BusController } from '../controllers/bus.controller';

const controller = new BusController();
export const busRouter: Router = Router();

// All bus routes require authentication + standard rate limiting
busRouter.use(readRateLimiter);
busRouter.use(verifyJwt);

// GET /api/v1/buses
busRouter.get(
  '/',
  requireRole('school_admin', 'manager', 'driver'),
  (req, res, next) => { controller.list(req, res).catch(next); },
);

// GET /api/v1/buses/:id
busRouter.get(
  '/:id',
  requireRole('school_admin', 'manager', 'driver'),
  (req, res, next) => { controller.getById(req, res).catch(next); },
);

// POST /api/v1/buses
busRouter.post(
  '/',
  requireRole('school_admin', 'manager'),
  validateBody(CreateBusSchema),
  (req, res, next) => { controller.create(req, res).catch(next); },
);

// PATCH /api/v1/buses/:id
busRouter.patch(
  '/:id',
  requireRole('school_admin', 'manager'),
  validateBody(UpdateBusSchema),
  (req, res, next) => { controller.update(req, res).catch(next); },
);

// DELETE /api/v1/buses/:id — soft delete (status → inactive)
busRouter.delete(
  '/:id',
  requireRole('school_admin'),
  (req, res, next) => { controller.delete(req, res).catch(next); },
);

// PATCH /api/v1/buses/:id/assign-driver
busRouter.patch(
  '/:id/assign-driver',
  requireRole('school_admin', 'manager'),
  validateBody(AssignBusDriverSchema),
  (req, res, next) => { controller.assignDriver(req, res).catch(next); },
);

// PATCH /api/v1/buses/:id/assign-route
busRouter.patch(
  '/:id/assign-route',
  requireRole('school_admin', 'manager'),
  validateBody(AssignBusRouteSchema),
  (req, res, next) => { controller.assignRoute(req, res).catch(next); },
);

// GET /api/v1/buses/:id/students — list active students assigned to this bus
busRouter.get(
  '/:id/students',
  requireRole('driver', 'manager', 'school_admin'),
  (req, res, next) => { controller.listStudents(req, res).catch(next); },
);
