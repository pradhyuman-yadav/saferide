import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import type { UserProfile, UserRole } from '@/types/user';

const USERS_COLLECTION = 'users';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function createUserProfile(
  uid: string,
  data: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const ref = doc(db, USERS_COLLECTION, uid);
  await setDoc(ref, {
    ...data,
    uid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>,
): Promise<void> {
  const ref = doc(db, USERS_COLLECTION, uid);
  await updateDoc(ref, {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  return updateUserProfile(uid, { role });
}

/**
 * Check if a pending invite exists for this email (set by school admin via web dashboard).
 * If found, auto-creates the user profile and marks the invite as used.
 * Returns the created profile, or null if no invite exists.
 */
export async function claimPendingInviteByEmail(
  uid: string,
  email: string,
  displayName: string,
): Promise<UserProfile | null> {
  const inviteKey = email.replace(/[@.]/g, '_');
  const inviteRef = doc(db, 'pendingInvites', inviteKey);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) return null;

  const invite = inviteSnap.data() as { tenantId: string; role: UserRole };
  await createUserProfile(uid, {
    role:     invite.role,
    name:     displayName,
    email,
    tenantId: invite.tenantId,
  });
  // Mark invite as used
  await updateDoc(inviteRef, { status: 'used', usedByUid: uid, updatedAt: Date.now() });
  return getUserProfile(uid);
}

/**
 * Redeem a short invite code (e.g. "SR-XYZABC") entered by a parent or driver.
 * Codes are stored in the top-level `inviteCodes/{code}` collection by the school admin.
 * Returns the created profile, or throws a descriptive error.
 */
export async function redeemInviteCode(
  uid: string,
  email: string,
  displayName: string,
  code: string,
): Promise<UserProfile> {
  const normalized = code.trim().toUpperCase();
  const codeRef  = doc(db, 'inviteCodes', normalized);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) throw new Error('Invalid invite code. Check with your school admin.');

  const data = codeSnap.data() as {
    tenantId: string;
    role: UserRole;
    status: string;
    expiresAt: number;
    studentId?: string;
  };

  if (data.status === 'used')    throw new Error('This invite code has already been used.');
  if (data.status === 'expired') throw new Error('This invite code has expired. Ask your school admin for a new one.');
  if (Date.now() > data.expiresAt) throw new Error('This invite code has expired. Ask your school admin for a new one.');

  await createUserProfile(uid, {
    role:     data.role,
    name:     displayName,
    email,
    tenantId: data.tenantId,
    ...(data.studentId ? { busId: data.studentId } : {}),
  });
  await updateDoc(codeRef, { status: 'used', usedByUid: uid, updatedAt: Date.now() });

  const profile = await getUserProfile(uid);
  if (!profile) throw new Error('Something went wrong. Please try again.');
  return profile;
}
