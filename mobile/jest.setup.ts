import '@testing-library/jest-native/extend-expect';

// ── Firebase mocks ────────────────────────────────────────────────────────────
jest.mock('@/firebase/config', () => ({
  auth: { currentUser: null },
  db:   {},
}));

jest.mock('@/firebase/auth', () => ({
  subscribeToAuthState: jest.fn((cb) => { cb(null); return jest.fn(); }),
  signInWithEmail:      jest.fn(),
  createAccount:        jest.fn(),
  signOut:              jest.fn(),
}));

jest.mock('@/firebase/firestore', () => ({
  getUserProfile:              jest.fn().mockResolvedValue(null),
  createUserProfile:           jest.fn().mockResolvedValue(undefined),
  updateUserProfile:           jest.fn().mockResolvedValue(undefined),
  setUserRole:                 jest.fn().mockResolvedValue(undefined),
  claimPendingInviteByEmail:   jest.fn().mockResolvedValue(null),
  redeemInviteCode:            jest.fn().mockResolvedValue(undefined),
}));

// ── Expo modules ──────────────────────────────────────────────────────────────
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync:            jest.fn(),
}));

jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(),
}));

jest.mock('@expo-google-fonts/dm-sans', () => ({
  DMSans_300Light:   'DMSans_300Light',
  DMSans_400Regular: 'DMSans_400Regular',
  DMSans_500Medium:  'DMSans_500Medium',
}));

jest.mock('@expo-google-fonts/dm-serif-display', () => ({
  DMSerifDisplay_400Regular: 'DMSerifDisplay_400Regular',
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// ── Expo Router ───────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter:    jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
  usePathname:  jest.fn(() => '/'),
  useSegments:  jest.fn(() => []),
  Redirect:     ({ href }: { href: string }) => null,
  Stack:        ({ children }: { children: React.ReactNode }) => children,
  Tabs:         ({ children }: { children: React.ReactNode }) => children,
  Link:         ({ children }: { children: React.ReactNode }) => children,
}));

// ── react-native-maps ─────────────────────────────────────────────────────────
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  // forwardRef so mapRef.current is a real object with imperative methods
  const MapView = React.forwardRef(({ children, testID, ...p }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
      animateCamera:   jest.fn(),
      fitToElements:   jest.fn(),
      fitToCoordinates: jest.fn(),
    }));
    return React.createElement(View, { testID: testID ?? 'map-view', ...p }, children);
  });
  const Marker      = ({ children }: any) => React.createElement(View, {}, children);
  const Polyline    = () => null;
  const Circle      = () => null;
  MapView.Animated  = MapView;
  return { __esModule: true, default: MapView, Marker, Polyline, Circle };
});

// ── react-native-safe-area-context ────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView:      ({ children, ...p }: any) => React.createElement(View, p, children),
    SafeAreaProvider:  ({ children }: any) => children,
    useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
  };
});

// ── lucide-react-native ───────────────────────────────────────────────────────
jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: () => () => null }),
);

// ── AsyncStorage ──────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ── Reset zustand stores between tests ───────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});
