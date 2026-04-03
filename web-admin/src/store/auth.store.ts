import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { signOut as firebaseSignOut, subscribeToAuthState } from '@/firebase/auth';
import { claimPendingInvite } from '@/firebase/invites';
import { getTenant } from '@/firebase/tenants';
import type { User } from 'firebase/auth';
import type { UserProfile, UserRole } from '@/types/user';

interface AuthState {
  user:      User | null;
  profile:   UserProfile | null;
  isLoading: boolean;
  authError: string | null;  // set when sign-in is rejected post-auth (wrong role, no profile)
}

interface AuthActions {
  initialize:     () => () => void;  // returns unsubscribe fn
  signOut:        () => Promise<void>;
  clearAuthError: () => void;
}

type AuthStore = AuthState & AuthActions;

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'school_admin'];

function buildProfile(uid: string, data: Record<string, unknown>, tenantName: string | null = null): UserProfile {
  return {
    uid,
    email:      data['email']     as string,
    name:       data['name']      as string,
    role:       data['role']      as UserProfile['role'],
    tenantId:   (data['tenantId'] as string | null) ?? null,
    tenantName,
    createdAt:  data['createdAt'] as number,
    updatedAt:  data['updatedAt'] as number,
  };
}

/** Resolve the school name for a school_admin before committing to the store. */
async function resolveTenantName(profile: UserProfile): Promise<string | null> {
  if (profile.role !== 'school_admin' || profile.tenantId === null) return null;
  const tenant = await getTenant(profile.tenantId);
  return tenant?.name ?? null;
}

export const useAuthStore = create<AuthStore>((set) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  user:      null,
  profile:   null,
  isLoading: true,
  authError: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to Firebase auth state.
   * On each auth change:
   *   1. Fetch the Firestore profile.
   *   2. If no profile → try to claim a pending invite (new school admin setup).
   *   3. Enforce role: only super_admin and school_admin may use this portal.
   * Returns the Firebase unsubscribe function (call on component unmount).
   */
  initialize(): () => void {
    set({ isLoading: true });

    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser === null) {
        set({ user: null, profile: null, isLoading: false });
        return;
      }

      try {
        const profileSnap = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (!profileSnap.exists()) {
          // No Firestore profile — new account. Try to claim a pending invite.
          // Get the Firebase ID token and send it to the auth-service for verification.
          const idToken = await firebaseUser.getIdToken();
          const claimed = await claimPendingInvite(idToken);

          if (claimed === null) {
            await firebaseSignOut();
            set({
              user: null, profile: null, isLoading: false,
              authError: 'Invalid or expired invitation. Contact your administrator.',
            });
            return;
          }

          // Re-fetch the freshly written profile
          const refetchedSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (!refetchedSnap.exists()) {
            await firebaseSignOut();
            set({
              user: null, profile: null, isLoading: false,
              authError: 'Unable to load your account. Check your connection and try again.',
            });
            return;
          }

          const reProfile = buildProfile(firebaseUser.uid, refetchedSnap.data());

          if (!ALLOWED_ROLES.includes(reProfile.role)) {
            await firebaseSignOut();
            set({
              user: null, profile: null, isLoading: false,
              authError: 'Access denied. This portal is for school administrators only.',
            });
            return;
          }

          const reTenantName = await resolveTenantName(reProfile);
          set({ user: firebaseUser, profile: { ...reProfile, tenantName: reTenantName }, isLoading: false });
          return;
        }

        // Profile exists — validate role and proceed
        const profile = buildProfile(firebaseUser.uid, profileSnap.data());

        if (!ALLOWED_ROLES.includes(profile.role)) {
          await firebaseSignOut();
          set({
            user: null, profile: null, isLoading: false,
            authError: 'Access denied. This portal is for school administrators only.',
          });
          return;
        }

        const tenantName = await resolveTenantName(profile);
        set({ user: firebaseUser, profile: { ...profile, tenantName }, isLoading: false });

      } catch {
        // Network error or Firestore rule rejection — fail safe
        await firebaseSignOut();
        set({
          user: null, profile: null, isLoading: false,
          authError: 'Unable to load your account. Check your connection and try again.',
        });
      }
    });

    return unsubscribe;
  },

  async signOut(): Promise<void> {
    await firebaseSignOut();
    set({ user: null, profile: null, authError: null });
  },

  clearAuthError(): void {
    set({ authError: null });
  },
}));
