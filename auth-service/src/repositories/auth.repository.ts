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

  async inviteExists(inviteKey: string): Promise<boolean> {
    const snap = await getDb().collection('pendingInvites').doc(inviteKey).get();
    return snap.exists;
  }

  async createInvite(inviteKey: string, data: Record<string, unknown>): Promise<void> {
    await getDb().collection('pendingInvites').doc(inviteKey).set(data);
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
   *
   * Guards: no-ops if tenantId is null (super_admin invites) or if the
   * tenant is already active/trial (manual invite for an existing school).
   */
  async activateTenant(tenantId: string | null, plan: TenantPlan): Promise<void> {
    if (!tenantId) return;

    const ref  = getDb().collection('tenants').doc(tenantId);
    const snap = await ref.get();
    if (!snap.exists) return;

    // Only activate if still pending — don't reset an already-live tenant
    if ((snap.data() as Record<string, unknown>)['status'] !== 'pending') return;

    const isTrial     = plan === 'trial';
    const now         = Date.now();
    const trialEndsAt = isTrial ? now + 30 * 24 * 60 * 60 * 1000 : null;
    await ref.update({
      status:      isTrial ? 'trial' : 'active',
      trialEndsAt,
      updatedAt:   now,
    });
  }
}
