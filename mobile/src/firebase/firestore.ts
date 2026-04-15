import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
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
 * Fetch the student record linked to a parent's Firebase UID.
 * Returns the child's name, assigned bus, stop, and Firestore student document ID.
 * Returns null if the parent has no linked student yet.
 */
export async function getStudentForParent(
  parentUid: string,
): Promise<{ studentId: string; busId: string; childName: string; stopId: string } | null> {
  const q    = query(collection(db, 'students'), where('parentFirebaseUid', '==', parentUid));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const doc  = snap.docs[0]!;
  const data = doc.data() as { name?: string; busId?: string; stopId?: string };
  return {
    studentId: doc.id,
    busId:     data.busId     ?? '',
    childName: data.name      ?? '',
    stopId:    data.stopId    ?? '',
  };
}
