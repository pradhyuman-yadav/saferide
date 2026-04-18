/**
 * push.ts
 * Expo Push Notification helpers for the SafeRide mobile app.
 *
 * Call `setupNotificationHandler()` once at module scope in _layout.tsx.
 * Call `setupNotificationChannels()` once at app startup (Android only).
 * Call `registerForPushNotifications(uid)` after every successful sign-in.
 *
 * The Expo push token is stored on the user's Firestore document so that
 * backend services (trip-service) can target the device for push delivery.
 *
 * ── Android notification channels ────────────────────────────────────────────
 *
 *  saferide-trips   HIGH importance — bus departed / arrived / ETA updates
 *  saferide-alerts  MAX  importance — SOS, driver offline, safety events
 *  saferide-general DEFAULT          — invites, system messages
 *
 * Channel IDs are exposed via CHANNELS for backend services to reference when
 * building push payloads.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { updateUserProfile } from '@/firebase/firestore';

// ── Channel identifiers ───────────────────────────────────────────────────────

export const CHANNELS = {
  trips:   'saferide-trips',
  alerts:  'saferide-alerts',
  general: 'saferide-general',
} as const;

// ── Handler config ────────────────────────────────────────────────────────────

/**
 * Configures how notifications behave when the app is in the foreground.
 * Must be called at module scope (outside any component) so it takes effect
 * before the first notification could arrive.
 *
 * Note: we set shouldShowAlert: false here because the in-app SRToast banner
 * (via useNotificationListeners) provides a branded foreground experience.
 * The OS banner still shows when the app is backgrounded or killed.
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false, // suppressed in foreground — SRToast handles it
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });
}

// ── Android channels ──────────────────────────────────────────────────────────

/**
 * Creates all Android notification channels. Safe to call on every startup —
 * existing channels are updated in place; no duplicates are created.
 * No-op on iOS.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNELS.trips, {
      name:             'Trip updates',
      description:      'Bus departure, arrival, and ETA notifications.',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound:            'default',
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.alerts, {
      name:             'Safety alerts',
      description:      'SOS emergencies, driver offline, and critical safety events.',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      sound:            'default',
      enableLights:     true,
      lightColor:       '#C2A878', // gold — never red per brand guidelines
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.general, {
      name:             'General',
      description:      'Account updates, invitations, and system messages.',
      importance:       Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
    }),
  ]);
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Requests permission (if not already granted), retrieves the Expo push token,
 * and saves it to Firestore so the backend can reach this device.
 *
 * Safe to call on every sign-in — if permission was already granted it
 * resolves immediately with the existing token.
 *
 * Returns the token string, or null if the user denied permission.
 */
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  await setupNotificationChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token     = tokenData.data;

    // Persist token — backend reads this to send targeted pushes
    await updateUserProfile(uid, { expoPushToken: token } as never);

    return token;
  } catch (err) {
    // FCM not configured (missing google-services.json / APNs key).
    // Push notifications will be unavailable but the app continues normally.
    if (__DEV__) console.warn('[push] Could not register for push notifications:', err);
    return null;
  }
}

// ── Permission check (no request) ────────────────────────────────────────────

/** Returns true if push notification permission is already granted. */
export async function hasPushPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
