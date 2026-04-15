import type { UserProfile, UserRole, CreateInviteInput, PendingInvite } from '@saferide/types';
import { UserProfileSchema, PendingInviteSchema } from '@saferide/types';
import { getAdminAuth, getDb } from '@saferide/firebase-admin';
import { AuthRepository } from '../repositories/auth.repository';
import { logger, auditLog } from '@saferide/logger';

const repo = new AuthRepository();

/** Max failed claim attempts before temporary lockout. */
const MAX_CLAIM_ATTEMPTS = 5;
/** Lockout duration: 15 minutes. */
const LOCKOUT_MS = 15 * 60 * 1_000;

/**
 * Per-UID claim attempt counter stored in Firestore `claimAttempts/{uid}`.
 * Guards against token-replay abuse of the claimInvite endpoint.
 * Firebase Auth already rate-limits sign-in attempts at the platform level;
 * this adds a server-side defence for the claim flow specifically.
 */
async function checkAndRecordClaimAttempt(uid: string, success: boolean): Promise<void> {
  const now = Date.now();
  const ref = getDb().collection('claimAttempts').doc(uid);

  if (success) {
    // Reset counter on successful claim
    await ref.delete();
    return;
  }

  const snap = await ref.get();
  const doc  = snap.exists ? (snap.data() as { attempts: number; lockedUntil: number | null }) : { attempts: 0, lockedUntil: null };

  // Still locked?
  if (doc.lockedUntil !== null && doc.lockedUntil > now) {
    throw Object.assign(
      new Error('Too many failed attempts. Try again later.'),
      { statusCode: 429, code: 'ACCOUNT_LOCKED' },
    );
  }

  const newAttempts = (doc.attempts ?? 0) + 1;
  const lockedUntil = newAttempts >= MAX_CLAIM_ATTEMPTS ? now + LOCKOUT_MS : null;

  await ref.set({ attempts: newAttempts, lockedUntil, updatedAt: now });

  if (lockedUntil !== null) {
    auditLog({ action: 'CLAIM_LOCKOUT', actorId: uid, actorRole: 'unknown', meta: { attempts: newAttempts } });
    throw Object.assign(
      new Error('Too many failed attempts. Try again later.'),
      { statusCode: 429, code: 'ACCOUNT_LOCKED' },
    );
  }
}

export class AuthService {
  async claimInvite(idToken: string): Promise<{ uid: string; role: UserRole; tenantId: string | null } | null> {
    // Verify the Firebase ID token
    let decoded: { uid: string; email?: string };
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken, true);
    } catch (err) {
      logger.warn({ err }, 'claimInvite: invalid ID token');
      throw Object.assign(new Error('Invalid or expired token.'), { statusCode: 401, code: 'INVALID_TOKEN' });
    }

    if (!decoded.email) {
      await checkAndRecordClaimAttempt(decoded.uid, false);
      throw Object.assign(new Error('Account must have an email address.'), { statusCode: 400, code: 'NO_EMAIL' });
    }

    // Check if invite exists
    const inviteKey  = decoded.email.replace(/[@.]/g, '_');
    const inviteData = await repo.findInvite(inviteKey);

    if (inviteData === null) {
      // Record failed attempt — prevents probing for valid invite emails
      await checkAndRecordClaimAttempt(decoded.uid, false);
      return null;
    }

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

    await repo.claimInviteAtomically(decoded.uid, inviteKey, profile);

    // Activate the tenant: pending → trial/active. Trial clock starts now.
    // activateTenant no-ops if tenantId is null or tenant is already active.
    if (invite.role === 'school_admin') {
      await repo.activateTenant(invite.tenantId, invite.plan);
    }

    // Successful claim — reset the attempt counter
    await checkAndRecordClaimAttempt(decoded.uid, true);

    return { uid: decoded.uid, role: invite.role, tenantId: invite.tenantId };
  }

  async getProfile(uid: string): Promise<UserProfile | null> {
    const data = await repo.findProfile(uid);
    if (data === null) return null;
    const result = UserProfileSchema.safeParse({ ...data, uid });
    if (!result.success) return null;
    return result.data;
  }

  async createInvite(input: CreateInviteInput): Promise<PendingInvite> {
    const inviteKey = input.email.replace(/[@.]/g, '_');

    const exists = await repo.inviteExists(inviteKey);
    if (exists) {
      throw Object.assign(
        new Error('An active invite already exists for this email address.'),
        { statusCode: 409, code: 'INVITE_EXISTS' },
      );
    }

    const now    = Date.now();
    const invite: PendingInvite = {
      tenantId:    input.tenantId ?? null,
      email:       input.email,
      role:        input.role,
      // plan is only meaningful when school_admin claims and activates their tenant.
      // For manually-created invites on existing schools, activateTenant will no-op.
      plan:        'pro',
      contactName: input.name,
      createdAt:   now,
      updatedAt:   now,
    };

    await repo.createInvite(inviteKey, invite as unknown as Record<string, unknown>);

    return invite;
  }
}
