/**
 * push.ts
 * Expo Push Notification helpers for the SafeRide mobile app.
 *
 * Call `setupNotificationHandler()` once at module scope in _layout.tsx.
 * Call `registerForPushNotifications(uid)` after every successful sign-in.
 *
 * The Expo push token is stored on the user's Firestore document so that
 * backend services (trip-service) can target the device for push delivery.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { updateUserProfile } from '@/firebase/firestore';

/**
 * Configures how notifications behave when the app is in the foreground.
 * Must be called at module scope (outside any component) so it takes effect
 * before the first notification could arrive.
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });
}

/**
 * Requests permission, retrieves the Expo push token, and saves it to
 * Firestore so the backend can reach this device.
 *
 * Safe to call on every sign-in — if permission was already granted it
 * resolves immediately with the existing token.
 *
 * Returns the token string, or null if the user denied permission.
 */
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  // Android requires a notification channel to be created before use
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:       'SafeRide',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

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
    console.warn('[push] Could not register for push notifications:', err);
    return null;
  }
}
