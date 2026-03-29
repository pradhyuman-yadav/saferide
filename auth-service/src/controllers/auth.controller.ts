import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { auditLog } from '@saferide/logger';

const service = new AuthService();

export class AuthController {
  async claimInvite(req: Request, res: Response): Promise<void> {
    const { idToken } = req.body as { idToken: string };
    const result = await service.claimInvite(idToken);
    if (result === null) {
      res.status(404).json({ success: false, error: { code: 'INVITE_NOT_FOUND', message: 'No invitation found for this email address.' } });
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
}
