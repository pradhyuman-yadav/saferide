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

    // ── Tenant-level access gate ─────────────────────────────────────────────
    // super_admin has tenantId === null and is exempt from this check.
    if (parsed.data.tenantId !== null) {
      const tenantSnap = await getDb().collection('tenants').doc(parsed.data.tenantId).get();

      if (!tenantSnap.exists) {
        res.status(403).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Organisation not found.' } });
        return;
      }

      const td     = tenantSnap.data()!;
      const status = td['status'] as string;

      if (status === 'suspended' || status === 'cancelled') {
        res.status(403).json({ success: false, error: { code: 'TENANT_SUSPENDED', message: 'Your organisation\'s account has been suspended. Contact your administrator.' } });
        return;
      }

      if (status === 'trial') {
        const trialEndsAt = td['trialEndsAt'] as number | null;
        if (trialEndsAt !== null && trialEndsAt < Date.now()) {
          res.status(403).json({ success: false, error: { code: 'TRIAL_EXPIRED', message: 'Your organisation\'s trial has expired. Please upgrade to continue.' } });
          return;
        }
      }
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
