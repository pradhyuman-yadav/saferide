import type { UserProfile, UserRole } from '@saferide/types';
import { UserProfileSchema, PendingInviteSchema } from '@saferide/types';
import { getAdminAuth } from '@saferide/firebase-admin';
import { AuthRepository } from '../repositories/auth.repository';
import { logger } from '@saferide/logger';

const repo = new AuthRepository();

export class AuthService {
  async claimInvite(idToken: string): Promise<{ uid: string; role: UserRole; tenantId: string } | null> {
    // Verify the Firebase ID token
    let decoded: { uid: string; email?: string };
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken, true);
    } catch (err) {
      logger.warn({ err }, 'claimInvite: invalid ID token');
      throw Object.assign(new Error('Invalid or expired token.'), { statusCode: 401, code: 'INVALID_TOKEN' });
    }

    if (!decoded.email) {
      throw Object.assign(new Error('Account must have an email address.'), { statusCode: 400, code: 'NO_EMAIL' });
    }

    // Check if invite exists
    const inviteKey  = decoded.email.replace(/[@.]/g, '_');
    const inviteData = await repo.findInvite(inviteKey);

    if (inviteData === null) return null;

    const invite = PendingInviteSchema.parse(inviteData);
    const name   = invite.contactName ?? decoded.email.split('@')[0] ?? 'Admin';
    const now    = Date.now();

    // Create Firestore profile
    const profile: Omit<UserProfile, 'uid'> = {
      email:     decoded.email,
      name,
      role:      invite.role,
      tenantId:  invite.tenantId,
      status:    'active',
      createdAt: now,
      updatedAt: now,
    };

    await repo.createProfile(decoded.uid, profile);
    await repo.deleteInvite(inviteKey);

    // Activate the tenant: pending → trial/active. Trial clock starts now.
    if (invite.role === 'school_admin') {
      await repo.activateTenant(invite.tenantId, invite.plan);
    }

    return { uid: decoded.uid, role: invite.role, tenantId: invite.tenantId };
  }

  async getProfile(uid: string): Promise<UserProfile | null> {
    const data = await repo.findProfile(uid);
    if (data === null) return null;
    const result = UserProfileSchema.safeParse({ ...data, uid });
    if (!result.success) return null;
    return result.data;
  }
}
