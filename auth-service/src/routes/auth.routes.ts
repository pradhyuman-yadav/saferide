import { Router } from 'express';
import { verifyJwt, requireRole, authRateLimiter, createAccountRateLimiter, readRateLimiter, validateBody } from '@saferide/middleware';
import { ClaimInviteSchema, CreateInviteInputSchema } from '@saferide/types';
import { AuthController } from '../controllers/auth.controller';

const controller = new AuthController();
export const authRouter: Router = Router();

// POST /api/v1/auth/invites/claim — rate limited, no pre-auth required (new user)
authRouter.post(
  '/invites/claim',
  createAccountRateLimiter,
  validateBody(ClaimInviteSchema),
  (req, res, next) => { controller.claimInvite(req, res).catch(next); },
);

// POST /api/v1/auth/invites — super_admin only; create a manual account invite
authRouter.post(
  '/invites',
  readRateLimiter,
  verifyJwt,
  requireRole('super_admin'),
  validateBody(CreateInviteInputSchema),
  (req, res, next) => { controller.createInvite(req, res).catch(next); },
);

// GET /api/v1/auth/me — requires valid JWT
authRouter.get(
  '/me',
  readRateLimiter,
  verifyJwt,
  (req, res, next) => { controller.getMe(req, res).catch(next); },
);
