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
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { tripClient } from '@/api/trip.client';

export const LOCATION_TASK_NAME = 'saferide-background-location';

const ACTIVE_TRIP_KEY = 'saferide_active_trip_id';

// ── Task definition ────────────────────────────────────────────────────────────
// Must be called at module scope (top level of a file imported by the app root)
// before any navigation or async work.

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[LocationTask] error:', error.message);
    return;
  }

  const locationData = data as { locations: Location.LocationObject[] };
  const locations    = locationData?.locations;
  if (!locations || locations.length === 0) return;

  const tripId = await SecureStore.getItemAsync(ACTIVE_TRIP_KEY);
  if (!tripId) return; // trip ended while we were sleeping

  // Use the most recent location in the batch
  const loc = locations[locations.length - 1];
  if (!loc) return;

  const ping = {
    lat:        loc.coords.latitude,
    lon:        loc.coords.longitude,
    speed:      loc.coords.speed   !== null ? loc.coords.speed   * 3.6 : undefined, // m/s → km/h
    heading:    loc.coords.heading !== null ? loc.coords.heading        : undefined,
    accuracy:   loc.coords.accuracy !== null ? loc.coords.accuracy      : undefined,
    recordedAt: loc.timestamp,
  };

  try {
    await tripClient.recordLocation(tripId, ping);
  } catch (err) {
    // Log and continue — GPS should never crash the background task
    console.warn('[LocationTask] failed to send ping:', (err as Error).message);
  }
});

// ── Public API ─────────────────────────────────────────────────────────────────

/** Call once at app startup to register the task definition with Expo. */
export function registerLocationTask(): void {
  // The task is already registered via defineTask above — this is a no-op
  // kept for clarity so callers know to import this module at startup.
}

/**
 * Requests location permissions and starts the background task.
 * Stores `tripId` in SecureStore so the task can reference it.
 * Returns `true` if tracking started, `false` if permissions were denied.
 */
export async function startLocationTracking(tripId: string): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') return false;

  await SecureStore.setItemAsync(ACTIVE_TRIP_KEY, tripId);

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy:               Location.Accuracy.High,
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
