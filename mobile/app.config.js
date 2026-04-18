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
 *
 * ── Icon file guide ─────────────────────────────────────────────────────────
 *
 *  assets/images/icon-ios.png
 *    • 1024 × 1024 px, RGB (NO alpha channel — App Store rejects transparent icons)
 *    • S-mark centred on a solid #404E3B (forest) background, filling the canvas
 *    • Apple adds rounded corners automatically — do NOT pre-round the corners
 *
 *  assets/images/icon-foreground.png
 *    • 1024 × 1024 px, RGBA (transparent outer border required)
 *    • S-mark centred in the INNER 66 % of the canvas (≈ 680 × 680 px centred)
 *    • Outer ~172 px on each side must be fully transparent
 *    • Android renders this on top of backgroundColor (#404E3B), then clips to
 *      the device's icon shape (circle / squircle). Without the safe-zone
 *      padding the mark fills the full shape and appears zoomed in.
 *
 *  assets/images/icon.png  (existing — keep as-is)
 *    • Used only for the in-app splash screen overlay (expo-splash-screen)
 */

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name:        'SafeRide',
  slug:        'sfrapp',
  owner:       'saferidein',
  version:     '1.0.0',
  scheme:      'saferide',
  orientation: 'portrait',
  userInterfaceStyle: 'light',

  // iOS App Store icon — solid background, no alpha (see guide above)
  icon: './assets/images/icon-ios.png',

  splash: {
    // Forest background with SafeRide wordmark — the JS layer renders AppLogo on top
    image:           './assets/images/logo.png',
    resizeMode:      'contain',
    backgroundColor: '#404E3B',
  },

  ios: {
    supportsTablet:   false,
    bundleIdentifier: 'in.saferide.app',
    // buildNumber managed by EAS autoIncrement — do not hardcode here

    // Explicit UIBackgroundModes so expo-location plugin doesn't need to infer it.
    // Required by App Store Review for apps that use location in the background.
    infoPlist: {
      UIBackgroundModes: ['location'],
      // Declare encryption usage for App Store export compliance.
      // The app uses only standard iOS HTTPS/TLS networking (exempt from US export regs).
      // Set to false to avoid manual export compliance step on every TestFlight upload.
      ITSAppUsesNonExemptEncryption: false,
    },


    // ── Apple Privacy Manifest (required since May 2024) ─────────────────────
    // Apple rejects apps without this. Declare every data type we collect and
    // every privacy-sensitive API we call (UserDefaults, file timestamps, etc.)
    // Docs: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files
    privacyManifests: {
      // This app does NOT serve ads or use cross-app tracking
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],

      // ── Data collected by this app ────────────────────────────────────────
      NSPrivacyCollectedDataTypes: [
        {
          // Firebase UID — links all data to the user account
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Parent and driver display name
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Login email address
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Optional contact phone number
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Driver GPS — precise location broadcast to parents during active trip only
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePreciseLocation',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
      ],

      // ── Privacy-sensitive APIs used by app or third-party SDKs ────────────
      // Reason codes: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api
      NSPrivacyAccessedAPITypes: [
        {
          // NSUserDefaults — used by Firebase SDK and Expo internally
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: [
            'CA92.1', // Access info from same app that wrote it
          ],
        },
        {
          // File timestamps — used by Expo and React Native bundler
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: [
            'C617.1', // Provide the file timestamp to the user
          ],
        },
        {
          // System boot time — used by React Native bridge for timing
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: [
            '35F9.1', // Measure elapsed time
          ],
        },
        {
          // Disk space — used by Expo modules and Firebase offline cache for cache management.
          // Reason 85F4.1: write or delete file to manage disk space of the app — correct for cache use.
          // E174.1 (display disk space to user) would be incorrect here.
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: [
            '85F4.1', // Cache app data to disk — correct reason for SDK cache management
          ],
        },
      ],
    },
  },

  android: {
    package:             'in.saferide.app',
    googleServicesFile:  './google-services.json',
    // versionCode managed by EAS autoIncrement (written to app.json) — do not hardcode here
    // minSdkVersion / targetSdkVersion / compileSdkVersion are NOT valid Expo config keys;
    // Expo SDK 55 sets these automatically. Setting them here causes Gradle build failures.
    // Adaptive icon: foreground has safe-zone padding so the mark isn't clipped
    adaptiveIcon: {
      foregroundImage: './assets/images/icon-foreground.png',
      backgroundColor: '#404E3B',
    },
    config: {
      googleMaps: {
        // Read from .env at build time — never embed a hardcoded key or the
        // literal "$GOOGLE_MAPS_API_KEY" string that app.json would produce.
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
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
        // Splash uses the original icon.png (no safe-zone constraint on splash)
        image:           './assets/images/icon.png',
        imageWidth:      200,
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
        // CRITICAL: without this, expo-location does NOT add UIBackgroundModes: ['location']
        // to Info.plist, and background GPS silently stops on iOS when the driver locks the screen.
        isIosBackgroundLocationEnabled: true,
      },
    ],
    'expo-secure-store',
    [
      '@sentry/react-native/expo',
      {
        organization: 'saferide',
        project:      'saferide-mobile',
        // Upload source maps on every production EAS build so stack traces are readable.
        // Sentry DSN is stored as an EAS Secret and read via EXPO_PUBLIC_SENTRY_DSN.
      },
    ],
    [
      'expo-notifications',
      {
        // White monochrome icon at 96 × 96 px on a transparent background.
        // Android 13+ requires a monochrome small icon — the launcher icon cannot be used.
        // TODO: replace with a properly designed monochrome icon before final App Store submission.
        icon:           './assets/images/notification-icon.png',
        color:          '#404E3B',   // forest — shown as the notification accent colour
        defaultChannel: 'saferide-general',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      projectId: '92700ed6-a859-442d-b1d8-f63ad6daec5d',
    },
  },
};

module.exports = { expo: config };
