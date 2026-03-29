import type { Request, Response, NextFunction } from 'express';
import { getAdminAuth, getDb } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';
import { UserProfileSchema } from '@saferide/types';

export async function verifyJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or malformed authorization header.' } });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true); // checkRevoked = true

    const userSnap = await getDb().collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) {
      res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User profile not found.' } });
      return;
    }

    const parsed = UserProfileSchema.safeParse({ ...userSnap.data(), uid: decoded.uid });
    if (!parsed.success) {
      logger.warn({ uid: decoded.uid, issues: parsed.error.issues }, 'Invalid user profile in Firestore');
      res.status(401).json({ success: false, error: { code: 'INVALID_PROFILE', message: 'User profile is invalid.' } });
      return;
    }

    if (parsed.data.status === 'suspended') {
      res.status(403).json({ success: false, error: { code: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended.' } });
      return;
    }

    req.user = {
      uid:      decoded.uid,
      email:    decoded.email ?? '',
      role:     parsed.data.role,
      tenantId: parsed.data.tenantId,
    };

    next();
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/id-token-expired') {
      res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Your session has expired. Please sign in again.' } });
    } else if (code === 'auth/id-token-revoked') {
      res.status(401).json({ success: false, error: { code: 'TOKEN_REVOKED', message: 'Your session has been revoked. Please sign in again.' } });
    } else {
      logger.warn({ err, requestId: req.requestId }, 'JWT verification failed');
      res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid authorization token.' } });
    }
  }
}
