import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { UserProfile, UserRole } from '@/types/user';
import { subscribeToAuthState, signOut as firebaseSignOut } from '@/firebase/auth';
import { getUserProfile, claimPendingInviteByEmail } from '@/firebase/firestore';

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
    await firebaseSignOut();
    set({ user: null, profile: null, role: null });
  },
}));
