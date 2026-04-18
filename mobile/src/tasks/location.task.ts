/**
 * location.task.ts
 * Expo background location task — sends GPS pings to trip-service while the
 * driver is on an active trip. Runs even when the app is backgrounded.
 *
 * Registration: call `registerLocationTask()` at app startup (e.g. in _layout.tsx).
 * Starting:     call `startLocationTracking(tripId)` when a trip begins.
 * Stopping:     call `stopLocationTracking()` when a trip ends.
 *
 * The `tripId` is stored in `expo-secure-store` so the background task can
 * read it without a closure (background tasks run in a separate JS context).
 */
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { tripClient } from '@/api/trip.client';

export const LOCATION_TASK_NAME = 'saferide-background-location';

const ACTIVE_TRIP_KEY = 'saferide_active_trip_id';

// ── Accuracy constants ────────────────────────────────────────────────────────

/** Horizontal accuracy ceiling (metres). Fixes worse than this come from
 *  urban canyons, tunnels, or cold GPS starts. Sending them would put the
 *  bus marker in the wrong location on the parent's map. */
const MAX_ACCURACY_METRES = 50;

/** Maximum plausible speed for a school bus (km/h). Anything higher is a
 *  GPS position jump — the device briefly thought it teleported. */
const MAX_SPEED_KMH = 120;

/** Minimum speed to trust the compass heading (km/h). Below this the bus is
 *  effectively stationary and the heading reading is unreliable noise. */
const MIN_SPEED_FOR_HEADING_KMH = 3;

// ── Task definition ────────────────────────────────────────────────────────────
// Must be called at module scope (top level of a file imported by the app root)
// before any navigation or async work.

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.error('[LocationTask] error:', error.message);
    return;
  }

  const locationData = data as { locations: Location.LocationObject[] };
  const locations    = locationData?.locations;
  if (!locations || locations.length === 0) return;

  const tripId = await SecureStore.getItemAsync(ACTIVE_TRIP_KEY);
  if (!tripId) return; // trip ended while we were sleeping

  // Pick the most accurate fix in the batch (lowest accuracy radius = best fix)
  const best = locations.reduce((prev, curr) => {
    const pa = prev.coords.accuracy ?? Infinity;
    const ca = curr.coords.accuracy ?? Infinity;
    return ca < pa ? curr : prev;
  });

  // Discard fixes that are too imprecise (urban canyons, tunnels, cold GPS start)
  if (best.coords.accuracy !== null && best.coords.accuracy > MAX_ACCURACY_METRES) return;

  const speedKmh = best.coords.speed !== null ? best.coords.speed * 3.6 : undefined;

  // Discard implausible position jumps (GPS glitch — bus cannot move this fast)
  if (speedKmh !== undefined && speedKmh > MAX_SPEED_KMH) return;

  const ping = {
    lat:        best.coords.latitude,
    lon:        best.coords.longitude,
    speed:      speedKmh,
    // Heading is unreliable noise when the bus is stationary — omit it
    heading:    (speedKmh !== undefined && speedKmh >= MIN_SPEED_FOR_HEADING_KMH && best.coords.heading !== null)
                  ? best.coords.heading
                  : undefined,
    accuracy:   best.coords.accuracy !== null ? best.coords.accuracy : undefined,
    recordedAt: best.timestamp,
  };

  try {
    await tripClient.recordLocation(tripId, ping);
  } catch (err) {
    const msg = (err as Error).message;

    if (msg === 'Not authenticated') {
      // No valid Firebase session — stale key left over from a crash or force-kill.
      // Self-heal: clear the key and stop the task so it never fires again until
      // the driver explicitly starts a new trip.
      if (__DEV__) console.warn('[LocationTask] no active session — clearing stale trip key and stopping task');
      await SecureStore.deleteItemAsync(ACTIVE_TRIP_KEY);
      try {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch {
        // Ignore — task may already be stopping
      }
      return;
    }

    // Transient network/server error — swallow silently in production; next interval will retry
    if (__DEV__) console.warn('[LocationTask] failed to send ping:', msg);
  }
});

// ── Public API ─────────────────────────────────────────────────────────────────

/** Call once at app startup to register the task definition with Expo. */
export function registerLocationTask(): void {
  // The task is already registered via defineTask above — this is a no-op
  // kept for clarity so callers know to import this module at startup.
}

/**
 * Google Play policy: a prominent in-app disclosure must appear before
 * `requestBackgroundPermissionsAsync` so the user understands WHY the app
 * needs "Allow all the time" location access.  An Alert dialog satisfies
 * "prominent disclosure" per the Play Location Permissions policy.
 *
 * Returns true if the user acknowledges the disclosure, false if they dismiss.
 */
function showBackgroundLocationDisclosure(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Background location access',
      'SafeRide needs to access your location at all times during an active trip ' +
      'so parents can see where the bus is, even when your screen is locked.\n\n' +
      'Your location is only shared while a trip is active. End the trip to stop sharing.',
      [
        { text: 'Not now',  style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', style: 'default', onPress: () => resolve(true)  },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Requests location permissions and starts the background task.
 * Stores `tripId` in SecureStore so the task can reference it.
 * Returns `true` if tracking started, `false` if permissions were denied.
 */
export async function startLocationTracking(tripId: string): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;

  // Show prominent disclosure before requesting "Always" background location.
  // Required by Google Play Location Permissions policy.
  // On iOS, skip disclosure — iOS already shows a separate OS-level dialog explaining
  // "Always" access and does not require an additional in-app disclosure.
  if (Platform.OS === 'android') {
    const { status: existing } = await Location.getBackgroundPermissionsAsync();
    if (existing !== 'granted') {
      const disclosed = await showBackgroundLocationDisclosure();
      if (!disclosed) return false;
    }
  }

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') return false;

  await SecureStore.setItemAsync(ACTIVE_TRIP_KEY, tripId);

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy:               Location.Accuracy.BestForNavigation,
    timeInterval:           10_000, // 10 seconds — well within 60/min rate limit
    distanceInterval:       0,      // always fire on interval, not distance
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle:   'SafeRide — Trip active',
      notificationBody:    'GPS is broadcasting. Parents can see the bus live.',
      notificationColor:   '#7B9669',
    },
  });

  return true;
}

/**
 * Stops the background task and clears the stored tripId.
 * Safe to call even if tracking is not running.
 */
export async function stopLocationTracking(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_TRIP_KEY);

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  }
}
