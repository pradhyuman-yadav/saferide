import { getDb } from '@saferide/firebase-admin';
import type { TenantPlan, UserProfile } from '@saferide/types';

export class AuthRepository {
  async findProfile(uid: string): Promise<Record<string, unknown> | null> {
    const snap = await getDb().collection('users').doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as Record<string, unknown>;
  }

  async findInvite(inviteKey: string): Promise<Record<string, unknown> | null> {
    const snap = await getDb().collection('pendingInvites').doc(inviteKey).get();
    if (!snap.exists) return null;
    return snap.data() as Record<string, unknown>;
  }

  /**
   * Atomically create the user profile and delete the invite in a single
   * Firestore transaction to prevent TOCTOU races where two concurrent
   * requests could both read the invite before either deletes it.
   */
  async claimInviteAtomically(
    uid: string,
    inviteKey: string,
    profileData: Omit<UserProfile, 'uid'>,
  ): Promise<void> {
    const db         = getDb();
    const userRef    = db.collection('users').doc(uid);
    const inviteRef  = db.collection('pendingInvites').doc(inviteKey);

    await db.runTransaction(async (tx) => {
      tx.set(userRef, profileData);
      tx.delete(inviteRef);
    });
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
