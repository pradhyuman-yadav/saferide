import { getAdminAuth, getDb } from '@saferide/firebase-admin';
import { UserProfileSchema, type UserProfile } from '@saferide/types';
import { logger } from '@saferide/logger';

/**
 * Verifies a Firebase ID token and returns the full user profile from Firestore.
 * Returns null if the token is invalid, the user does not exist, or the account
 * is not in `active` status.
 *
 * This is the WebSocket equivalent of the `verifyJwt` Express middleware — we
 * can't use Express middleware on the HTTP upgrade event, so auth runs here
 * before the WebSocket handshake is completed.
 */
export async function verifyToken(token: string): Promise<UserProfile | null> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);

    const snap = await getDb().collection('users').doc(decoded.uid).get();
    if (!snap.exists) return null;

    const raw  = { uid: decoded.uid, ...snap.data() };
    const parsed = UserProfileSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ uid: decoded.uid, issues: parsed.error.issues }, 'User profile failed schema validation');
      return null;
    }

    if (parsed.data.status !== 'active') return null;

    return parsed.data;
  } catch (err) {
    logger.debug({ err }, 'Token verification failed');
    return null;
  }
}

/**
 * Extracts the bearer token from an HTTP upgrade request.
 * Checks the Authorization header first, then the ?token= query param
 * (needed for environments where WebSocket clients cannot set custom headers).
 */
export function extractToken(
  headers: Record<string, string | string[] | undefined>,
  query:   Record<string, string | string[] | undefined>,
): string | null {
  const authHeader = headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const queryToken = query['token'];
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }

  return null;
}
