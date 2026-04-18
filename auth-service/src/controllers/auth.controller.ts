import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { auditLog } from '@saferide/logger';
import { CreateInviteInputSchema } from '@saferide/types';

const service = new AuthService();

export class AuthController {
  async claimInvite(req: Request, res: Response): Promise<void> {
    const { idToken } = req.body as { idToken: string };
    const result = await service.claimInvite(idToken);
    if (result === null) {
      // Return 401 (not 404) to prevent email enumeration — a 404 would
      // reveal whether an email address has a pending invite or not.
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired invitation.' } });
      return;
    }
    auditLog({
      action:    'INVITE_CLAIMED',
      actorId:   result.uid,
      actorRole: result.role,
      tenantId:  result.tenantId,
    });
    res.status(201).json({ success: true, data: { role: result.role, tenantId: result.tenantId } });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const profile = await service.getProfile(req.user.uid);
    if (profile === null) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User profile not found.' } });
      return;
    }
    res.json({ success: true, data: profile });
  }

  async createInvite(req: Request, res: Response): Promise<void> {
    const input  = CreateInviteInputSchema.parse(req.body);
    const invite = await service.createInvite(input);
    auditLog({
      action:      'INVITE_CREATED',
      actorId:     req.user.uid,
      targetEmail: input.email,
      role:        input.role,
      tenantId:    input.tenantId ?? null,
    });
    res.status(201).json({ success: true, data: invite });
  }
}
