import { authApi } from '@/api/client';
import type { UserRole } from '@/types/user';

/**
 * Attempt to claim a pending invite using a Firebase ID token.
 *
 * The auth-service verifies the token, finds the matching pendingInvite,
 * creates the Firestore user profile, and deletes the invite — all via
 * the Admin SDK (bypassing Firestore security rules that block client writes).
 *
 * Returns { role, tenantId, name } on success, or null if no invite exists.
 */
export async function claimPendingInvite(
  idToken: string,
): Promise<{ role: UserRole; tenantId: string; name: string } | null> {
  try {
    const result = await authApi.claimInvite(idToken);
    // After claim, the profile exists in Firestore — auth store re-fetches it.
    // name is not returned by the API (it's on the profile); return empty string
    // so callers that need it can re-fetch from Firestore.
    return { role: result.role as UserRole, tenantId: result.tenantId, name: '' };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'INVITE_NOT_FOUND') return null;
    throw err;
  }
}
