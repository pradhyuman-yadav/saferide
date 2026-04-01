/**
 * app.config.js — dynamic Expo config
 *
 * Why this exists instead of app.json:
 * -------------------------------------
 * app.json does NOT substitute $VARIABLE references from .env files during
 * local development builds (expo run:android / expo prebuild).
 * That substitution only happens during EAS Cloud Build.
 *
 * app.config.js runs in Node at build time where Expo CLI has already loaded
 * .env into process.env, so we can read GOOGLE_MAPS_API_KEY directly.
 *
 * Expo Go note:
 * Expo Go ships its own Google Maps API key — your key is only needed when
 * running a local development build (expo run:android) or a production build.
 */

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name:        'SafeRide',
  slug:        'saferide',
  version:     '1.0.0',
  scheme:      'saferide',
  orientation: 'portrait',
  userInterfaceStyle: 'light',

  splash: {
    backgroundColor: '#404E3B',
    resizeMode:      'contain',
  },

  ios: {
    supportsTablet:   false,
    bundleIdentifier: 'in.saferide.app',
  },

  android: {
    package: 'in.saferide.app',
    minSdkVersion: 24,   // Android 7.0 (2016) — covers ~97% of active devices
    targetSdkVersion: 35,
    compileSdkVersion: 35,
    config: {
      googleMaps: {
        // Read from .env at build time — never embed a hardcoded key or the
        // literal "$GOOGLE_MAPS_API_KEY" string that app.json would produce.
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },

  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#404E3B',
        resizeMode:      'contain',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'SafeRide uses your location in the background to broadcast the bus position to parents during an active trip.',
        locationAlwaysPermission:
          'SafeRide uses your location in the background to broadcast the bus position to parents during an active trip.',
        locationWhenInUsePermission:
          'SafeRide uses your location to show parents where the bus is.',
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    'expo-secure-store',
  ],

  experiments: {
    typedRoutes: true,
  },
};

module.exports = { expo: config };
