import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from '@/store/auth.store';
import * as firebaseAuth from '@/firebase/auth';
import * as firestore from '@/firebase/firestore';
import type { UserProfile } from '@/types/user';

const MOCK_PROFILE: UserProfile = {
  uid:       'user_123',
  role:      'parent',
  name:      'Priya Sharma',
  email:     'priya@example.com',
  tenantId:  'school_dps',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Reset store to initial state before each test
beforeEach(() => {
  useAuthStore.setState({ user: null, profile: null, role: null, isLoading: true });
});

describe('useAuthStore — initial state', () => {
  it('starts with null user and role', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useAuthStore — initialize', () => {
  it('sets isLoading to false when no user is signed in', async () => {
    (firebaseAuth.subscribeToAuthState as jest.Mock).mockImplementation((cb) => {
      cb(null);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { result.current.initialize(); });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('fetches Firestore profile when user is signed in', async () => {
    const fakeUser = { uid: 'user_123', email: 'priya@example.com' };
    (firebaseAuth.subscribeToAuthState as jest.Mock).mockImplementation((cb) => {
      cb(fakeUser);
      return jest.fn();
    });
    (firestore.getUserProfile as jest.Mock).mockResolvedValueOnce(MOCK_PROFILE);

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { result.current.initialize(); });
    // Allow async profile fetch to resolve
    await act(async () => {});

    expect(firestore.getUserProfile).toHaveBeenCalledWith('user_123');
    expect(result.current.role).toBe('parent');
    expect(result.current.profile?.name).toBe('Priya Sharma');
  });

  it('sets role to null when user has no Firestore profile yet', async () => {
    const fakeUser = { uid: 'new_user_456' };
    (firebaseAuth.subscribeToAuthState as jest.Mock).mockImplementation((cb) => {
      cb(fakeUser);
      return jest.fn();
    });
    (firestore.getUserProfile as jest.Mock).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { result.current.initialize(); });
    await act(async () => {});

    expect(result.current.role).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns an unsubscribe function', () => {
    const unsubscribeMock = jest.fn();
    (firebaseAuth.subscribeToAuthState as jest.Mock).mockReturnValue(unsubscribeMock);

    const { result } = renderHook(() => useAuthStore());
    let unsubscribe: (() => void) | undefined;
    act(() => { unsubscribe = result.current.initialize(); });

    expect(typeof unsubscribe).toBe('function');
  });
});

describe('useAuthStore — setProfile', () => {
  it('updates profile and role in store', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => { result.current.setProfile(MOCK_PROFILE); });

    expect(result.current.profile).toEqual(MOCK_PROFILE);
    expect(result.current.role).toBe('parent');
  });

  it('correctly sets driver role', () => {
    const driverProfile: UserProfile = { ...MOCK_PROFILE, uid: 'd1', role: 'driver', name: 'Raju' };
    const { result } = renderHook(() => useAuthStore());

    act(() => { result.current.setProfile(driverProfile); });

    expect(result.current.role).toBe('driver');
  });
});

describe('useAuthStore — signOut', () => {
  it('clears user, profile, and role', async () => {
    useAuthStore.setState({ user: { uid: 'user_123' } as any, profile: MOCK_PROFILE, role: 'parent', isLoading: false });
    (firebaseAuth.signOut as jest.Mock).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signOut(); });

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('calls Firebase signOut', async () => {
    (firebaseAuth.signOut as jest.Mock).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuthStore());

    await act(async () => { await result.current.signOut(); });

    expect(firebaseAuth.signOut).toHaveBeenCalledTimes(1);
  });
});
