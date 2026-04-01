import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { UserProfile, UserRole } from '@/types/user';
import { subscribeToAuthState, signOut as firebaseSignOut } from '@/firebase/auth';
import { getUserProfile, claimPendingInviteByEmail, getStudentForParent } from '@/firebase/firestore';
import { stopLocationTracking } from '@/tasks/location.task';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  // Actions
  initialize: () => () => void;  // returns unsubscribe fn
  setProfile: (profile: UserProfile) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:      null,
  profile:   null,
  role:      null,
  isLoading: true,

  initialize: () => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (!firebaseUser) {
        // No session — ensure any stale background location task is stopped
        // (covers token expiry, force sign-out from another device, etc.)
        void stopLocationTracking();
        set({ user: null, profile: null, role: null, isLoading: false });
        return;
      }

      set({ user: firebaseUser, isLoading: true });

      try {
        let profile = await getUserProfile(firebaseUser.uid);

        // No profile yet — check if admin pre-invited this email (drivers/staff)
        if (!profile && firebaseUser.email) {
          profile = await claimPendingInviteByEmail(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName ?? firebaseUser.email,
          );
        }

        // For parents: fetch their child's bus assignment from the students collection
        // (busId + childName live on the student doc, not the user doc)
        if (profile?.role === 'parent' && !profile.busId) {
          const student = await getStudentForParent(firebaseUser.uid);
          if (student) profile = { ...profile, ...student };
        }

        set({
          profile,
          role: profile?.role ?? null,
          isLoading: false,
        });
      } catch {
        set({ profile: null, role: null, isLoading: false });
      }
    });

    return unsubscribe;
  },

  setProfile: (profile) => {
    set({ profile, role: profile.role });
  },

  signOut: async () => {
    // Stop GPS tracking before signing out — driver may still have an active trip
    await stopLocationTracking();
    await firebaseSignOut();
    set({ user: null, profile: null, role: null });
  },
}));
