import { Router }   from 'express';
import { z }        from 'zod';
import { verifyJwt, requireRole, readRateLimiter, validateBody } from '@saferide/middleware';
import { CreateRouteSchema, UpdateRouteSchema, CreateStopSchema, UpdateStopSchema } from '@saferide/types';
import { RouteController } from '../controllers/route.controller';
import { StopController }  from '../controllers/stop.controller';

const DirectionsSchema = z.object({
  origin:      z.object({ lat: z.number(), lon: z.number() }),
  destination: z.object({ lat: z.number(), lon: z.number() }),
});

const routeController = new RouteController();
const stopController  = new StopController();

export const routeRouter: Router = Router();

routeRouter.use(readRateLimiter);
routeRouter.use(verifyJwt);

// ── Route endpoints ───────────────────────────────────────────────────────

// GET /api/v1/routes
routeRouter.get(
  '/',
  requireRole('school_admin', 'manager', 'driver'),
  (req, res, next) => { routeController.list(req, res).catch(next); },
);

// POST /api/v1/routes/directions — driver: proxy Directions API call (no key in app bundle)
// Must be registered BEFORE /:id so "directions" is not consumed as an id param.
routeRouter.post(
  '/directions',
  requireRole('driver', 'school_admin', 'manager'),
  validateBody(DirectionsSchema),
  (req, res, next) => { routeController.getDirections(req, res).catch(next); },
);

// GET /api/v1/routes/:id
routeRouter.get(
  '/:id',
  requireRole('school_admin', 'manager', 'driver'),
  (req, res, next) => { routeController.getById(req, res).catch(next); },
);

// GET /api/v1/routes/:id/polyline — full route road-following polyline
routeRouter.get(
  '/:id/polyline',
  requireRole('school_admin', 'manager', 'driver'),
  (req, res, next) => { routeController.getPolyline(req, res).catch(next); },
);

// POST /api/v1/routes
routeRouter.post(
  '/',
  requireRole('school_admin', 'manager'),
  validateBody(CreateRouteSchema),
  (req, res, next) => { routeController.create(req, res).catch(next); },
);

// PATCH /api/v1/routes/:id
routeRouter.patch(
  '/:id',
  requireRole('school_admin', 'manager'),
  validateBody(UpdateRouteSchema),
  (req, res, next) => { routeController.update(req, res).catch(next); },
);

// DELETE /api/v1/routes/:id — soft deactivate
routeRouter.delete(
  '/:id',
  requireRole('school_admin'),
  (req, res, next) => { routeController.deactivate(req, res).catch(next); },
);

// ── Stop sub-resource endpoints ───────────────────────────────────────────

// GET /api/v1/routes/:routeId/stops
routeRouter.get(
  '/:routeId/stops',
  requireRole('school_admin', 'manager', 'driver'),
  (req, res, next) => { stopController.list(req, res).catch(next); },
);

// POST /api/v1/routes/:routeId/stops
routeRouter.post(
  '/:routeId/stops',
  requireRole('school_admin', 'manager'),
  validateBody(CreateStopSchema),
  (req, res, next) => { stopController.create(req, res).catch(next); },
);

// ── Flat stop endpoints (PATCH + DELETE) ──────────────────────────────────
// Mounted at /api/v1/stops via stopRouter in index.ts

export const stopRouter: Router = Router();
stopRouter.use(readRateLimiter);
stopRouter.use(verifyJwt);

// PATCH /api/v1/stops/:id
stopRouter.patch(
  '/:id',
  requireRole('school_admin', 'manager'),
  validateBody(UpdateStopSchema),
  (req, res, next) => { stopController.update(req, res).catch(next); },
);

// DELETE /api/v1/stops/:id
stopRouter.delete(
  '/:id',
  requireRole('school_admin'),
  (req, res, next) => { stopController.delete(req, res).catch(next); },
);
