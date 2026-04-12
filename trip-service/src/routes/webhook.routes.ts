import { Router } from 'express';
import { verifyJwt, requireRole, validateBody, readRateLimiter } from '@saferide/middleware';
import { CreateWebhookSchema } from '@saferide/types';
import { WebhookController } from '../controllers/webhook.controller';

const ctrl = new WebhookController();

export const webhookRouter: Router = Router();

webhookRouter.use(readRateLimiter);
webhookRouter.use(verifyJwt);
webhookRouter.use(requireRole('school_admin'));

// GET  /api/v1/webhooks
webhookRouter.get(
  '/',
  (req, res, next) => ctrl.list(req, res).catch(next),
);

// POST /api/v1/webhooks
webhookRouter.post(
  '/',
  validateBody(CreateWebhookSchema),
  (req, res, next) => ctrl.create(req, res).catch(next),
);

// DELETE /api/v1/webhooks/:id
webhookRouter.delete(
  '/:id',
  (req, res, next) => ctrl.delete(req, res).catch(next),
);

// GET /api/v1/webhooks/:id/deliveries
webhookRouter.get(
  '/:id/deliveries',
  (req, res, next) => ctrl.listDeliveries(req, res).catch(next),
);
