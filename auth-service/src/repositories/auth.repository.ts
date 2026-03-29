import { getDb } from '@saferide/firebase-admin';
import type { TenantPlan, UserProfile } from '@saferide/types';

export class AuthRepository {
  async findProfile(uid: string): Promise<Record<string, unknown> | null> {
    const snap = await getDb().collection('users').doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as Record<string, unknown>;
  }

  async createProfile(uid: string, data: Omit<UserProfile, 'uid'>): Promise<void> {
    await getDb().collection('users').doc(uid).set(data);
  }

  async findInvite(inviteKey: string): Promise<Record<string, unknown> | null> {
    const snap = await getDb().collection('pendingInvites').doc(inviteKey).get();
    if (!snap.exists) return null;
    return snap.data() as Record<string, unknown>;
  }

  async deleteInvite(inviteKey: string): Promise<void> {
    await getDb().collection('pendingInvites').doc(inviteKey).delete();
  }

  /**
   * Move a tenant from 'pending' → 'trial' or 'active' when the school
   * admin claims their invite. Trial clock starts NOW, not at onboarding.
   */
  async activateTenant(tenantId: string, plan: TenantPlan): Promise<void> {
    const isTrial     = plan === 'trial';
    const now         = Date.now();
    const trialEndsAt = isTrial ? now + 30 * 24 * 60 * 60 * 1000 : null;
    await getDb().collection('tenants').doc(tenantId).update({
      status:      isTrial ? 'trial' : 'active',
      trialEndsAt,
      updatedAt:   now,
    });
  }
}
