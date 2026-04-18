import '@testing-library/jest-native/extend-expect';

// ── i18n mock — returns last key segment as the visible string ────────────────
// e.g. t('auth.continue') → 'Continue',  t('history.heading') → 'Trip history'
// We load the real en.json so tests match production text exactly.
jest.mock('react-i18next', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const en = require('./src/i18n/locales/en.json');

  // Resolve dot-separated key paths (e.g. 'auth.continue') into their value.
  function resolve(obj: Record<string, unknown>, key: string): string {
    const parts = key.split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === 'string' ? cur : key;
  }

  const t = (key: string, opts?: Record<string, unknown>): string => {
    let val = resolve(en, key);
    // Replace {{var}} placeholders if opts provided
    if (opts) {
      val = val.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) =>
        opts[k] != null ? String(opts[k]) : `{{${k}}}`,
      );
    }
    return val;
  };

  return {
    useTranslation: () => ({ t, i18n: { language: 'en', changeLanguage: jest.fn() } }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: jest.fn() },
  };
});

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
  getStudentForParent:         jest.fn().mockResolvedValue(null),
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

// ── Expo Location ─────────────────────────────────────────────────────────────
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync:           jest.fn().mockResolvedValue({ coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 10 } }),
  watchPositionAsync:                jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy:                          { Balanced: 3, High: 4, BestForNavigation: 6 },
}));

// ── Expo Task Manager ─────────────────────────────────────────────────────────
jest.mock('expo-task-manager', () => ({
  defineTask:     jest.fn(),
  isTaskRegistered: jest.fn().mockResolvedValue(false),
  unregisterAllTasksAsync: jest.fn().mockResolvedValue(undefined),
}));

// ── Expo Secure Store ─────────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn().mockResolvedValue(null),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// ── Expo Notifications ────────────────────────────────────────────────────────
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync:       jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync:         jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationHandler:        jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync:     jest.fn().mockResolvedValue('notification-id'),
}));

// ── Expo Linking ──────────────────────────────────────────────────────────────
jest.mock('expo-linking', () => ({
  openURL:    jest.fn().mockResolvedValue(undefined),
  canOpenURL: jest.fn().mockResolvedValue(true),
}));

// ── Expo Localization ─────────────────────────────────────────────────────────
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', regionCode: 'US', languageTag: 'en-US' }]),
  getCalendars: jest.fn(() => []),
  locale: 'en-US',
  locales: [{ languageCode: 'en', regionCode: 'US', languageTag: 'en-US' }],
  timezone: 'UTC',
}));

// ── Location tracking task ────────────────────────────────────────────────────
jest.mock('@/tasks/location.task', () => ({
  startLocationTracking: jest.fn().mockResolvedValue(true),
  stopLocationTracking:  jest.fn().mockResolvedValue(undefined),
}));

// ── API clients (src/api/*.client.ts) ─────────────────────────────────────────
// Mock at the module level so screens that import these don't need firebase/auth resolved.
jest.mock('@/api/trip.client', () => ({
  tripClient: {
    getActive:   jest.fn().mockResolvedValue(null),
    startTrip:   jest.fn().mockResolvedValue({ id: 'trip_001', status: 'active', startedAt: Date.now() }),
    endTrip:     jest.fn().mockResolvedValue({ id: 'trip_001', status: 'completed' }),
    sendSOS:     jest.fn().mockResolvedValue(undefined),
    cancelSOS:   jest.fn().mockResolvedValue(undefined),
    recordLocation: jest.fn().mockResolvedValue(undefined),
    listTripsForBus: jest.fn().mockResolvedValue([]),
    listDriverTrips: jest.fn().mockResolvedValue([]),
    getActiveTripForBus: jest.fn().mockResolvedValue(null),
    getLatestLocation: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/api/route.client', () => ({
  routeClient: {
    listRoutes:    jest.fn().mockResolvedValue([]),
    getRoute:      jest.fn().mockResolvedValue(null),
    listStops:     jest.fn().mockResolvedValue([]),
    getStops:      jest.fn().mockResolvedValue([]),
    getBus:        jest.fn().mockResolvedValue(null),
    listBuses:     jest.fn().mockResolvedValue([]),
    listDrivers:   jest.fn().mockResolvedValue([]),
    getDriver:     jest.fn().mockResolvedValue(null),
    listStudents:  jest.fn().mockResolvedValue([]),
    getStudent:    jest.fn().mockResolvedValue(null),
    createBus:     jest.fn().mockResolvedValue({}),
    updateBus:     jest.fn().mockResolvedValue({}),
    deleteBus:     jest.fn().mockResolvedValue(undefined),
    createRoute:   jest.fn().mockResolvedValue({}),
    updateRoute:   jest.fn().mockResolvedValue({}),
    deleteRoute:   jest.fn().mockResolvedValue(undefined),
    getDirection:  jest.fn().mockResolvedValue(null),
  },
}));

// ── Reset zustand stores between tests ───────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});
