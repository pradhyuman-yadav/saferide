import { Router } from 'express';
import { verifyJwt, requireRole, validateBody, readRateLimiter, gpsRateLimiter } from '@saferide/middleware';
import { StartTripInputSchema, CreateTelemetryInputSchema } from '@saferide/types';
import { TripController } from '../controllers/trip.controller';
import { TelemetryController } from '../controllers/telemetry.controller';

const tripCtrl      = new TripController();
const telemetryCtrl = new TelemetryController();

export const tripRouter = Router();

// All trip endpoints — rate limited then authenticated
tripRouter.use(readRateLimiter);
tripRouter.use(verifyJwt);

// ── Trip lifecycle ─────────────────────────────────────────────────────────────

// GET /api/v1/trips — driver's own trip history (newest first)
tripRouter.get(
  '/',
  requireRole('driver'),
  (req, res, next) => tripCtrl.list(req, res).catch(next),
);

// GET /api/v1/trips/active — driver's own active trip
// Defined before /:id routes so "active" is never treated as a document ID
tripRouter.get(
  '/active',
  requireRole('driver'),
  (req, res, next) => tripCtrl.getActive(req, res).catch(next),
);

// GET /api/v1/trips/bus/:busId — trip history for a bus (parents + managers)
// Defined before /bus/:busId/active so the more specific path wins
tripRouter.get(
  '/bus/:busId',
  requireRole('parent', 'manager', 'school_admin'),
  (req, res, next) => tripCtrl.listForBus(req, res).catch(next),
);

// GET /api/v1/trips/bus/:busId/active — active trip for a bus (parents + managers)
tripRouter.get(
  '/bus/:busId/active',
  requireRole('parent', 'manager', 'school_admin'),
  (req, res, next) => tripCtrl.getActiveForBus(req, res).catch(next),
);

// POST /api/v1/trips — driver starts a trip
tripRouter.post(
  '/',
  requireRole('driver'),
  validateBody(StartTripInputSchema),
  (req, res, next) => tripCtrl.start(req, res).catch(next),
);

// POST /api/v1/trips/:id/end — driver ends their trip
tripRouter.post(
  '/:id/end',
  requireRole('driver'),
  (req, res, next) => tripCtrl.end(req, res).catch(next),
);

// POST /api/v1/trips/:id/sos — driver triggers SOS alert
// Note: sos/cancel must be registered before /:id/sos so Express doesn't treat
// "cancel" as a second path segment under a different route pattern.
tripRouter.post(
  '/:id/sos/cancel',
  requireRole('driver'),
  (req, res, next) => tripCtrl.cancelSOS(req, res).catch(next),
);

tripRouter.post(
  '/:id/sos',
  requireRole('driver'),
  (req, res, next) => tripCtrl.sos(req, res).catch(next),
);

// ── GPS telemetry ──────────────────────────────────────────────────────────────

// POST /api/v1/trips/:id/location — driver sends GPS ping (60/min per device)
tripRouter.post(
  '/:id/location',
  requireRole('driver'),
  gpsRateLimiter,
  validateBody(CreateTelemetryInputSchema),
  (req, res, next) => telemetryCtrl.recordPing(req, res).catch(next),
);

// GET /api/v1/trips/:id/location/latest — latest GPS ping for a trip
tripRouter.get(
  '/:id/location/latest',
  requireRole('parent', 'driver', 'manager', 'school_admin'),
  (req, res, next) => telemetryCtrl.getLatest(req, res).catch(next),
);
