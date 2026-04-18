/**
 * trip.client.ts
 * Mobile API client for the trip-service (port 4004).
 * Uses the Firebase Auth ID token for every request.
 */
import { getAuth } from 'firebase/auth';

const BASE_URL    = process.env['EXPO_PUBLIC_TRIP_SERVICE_URL'] ?? 'http://localhost:4004';
const TIMEOUT_MS  = 15_000;   // abort after 15 s — covers slow 3G without hanging GPS pings
const MAX_RETRIES = 2;        // retry up to 2× on network / timeout errors only

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

/** Wraps fetch with an AbortController timeout. */
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retries `fn` up to `retries` times on transient network or timeout errors.
 * Business-logic errors (4xx with success:false) are NOT retried.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const isNetwork = err instanceof TypeError;          // "Network request failed"
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if ((isNetwork || isTimeout) && retries > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return withRetry(async () => {
    const token = await getIdToken();
    const res   = await fetchWithTimeout(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (res.status === 204) return undefined as T;

    const json = await res.json() as { success: boolean; data?: T; error?: { code: string; message: string } };
    if (!json.success) {
      const msg = json.error?.message ?? 'An unexpected error occurred.';
      throw Object.assign(new Error(msg), { code: json.error?.code });
    }
    return json.data as T;
  });
}

// ── Types (mirror packages/types — kept local so mobile stays independent) ───

export interface Trip {
  id:                string;
  tenantId:          string;
  driverId:          string;
  busId:             string;
  routeId:           string;
  status:            'active' | 'ended';
  startedAt:         number;
  endedAt?:          number;
  latestLat?:        number;
  latestLon?:        number;
  latestSpeed?:      number;
  latestHeading?:    number;
  latestRecordedAt?: number;
  sosActive?:        boolean;
  sosTriggeredAt?:   number;
  createdAt:         number;
  updatedAt:         number;
}

export interface GpsTelemetry {
  id:         string;
  tripId:     string;
  lat:        number;
  lon:        number;
  speed?:     number;
  heading?:   number;
  accuracy?:  number;
  recordedAt: number;
  createdAt:  number;
}

export interface StartTripInput {
  busId:   string;
  routeId: string;
}

export interface LocationPing {
  lat:         number;
  lon:         number;
  speed?:      number;
  heading?:    number;
  accuracy?:   number;
  recordedAt:  number;
}

export type BoardingEventType = 'boarded' | 'deboarded';

export interface BoardingEvent {
  id:         string;
  tripId:     string;
  studentId:  string;
  busId:      string;
  stopId:     string | null;
  eventType:  BoardingEventType;
  method:     'manual';
  recordedAt: number;
  createdAt:  number;
}

export interface RecordBoardingInput {
  studentId:  string;
  stopId:     string | null;
  eventType:  BoardingEventType;
  method:     'manual';
  recordedAt: number;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const tripClient = {
  /** Driver: get own trip history, newest first. */
  listMyTrips: () =>
    apiFetch<Trip[]>('/api/v1/trips'),

  /** Driver: get own active trip (null if none). */
  getActive: () =>
    apiFetch<Trip | null>('/api/v1/trips/active'),

  /** Driver: start a new trip. */
  startTrip: (input: StartTripInput) =>
    apiFetch<Trip>('/api/v1/trips', { method: 'POST', body: JSON.stringify(input) }),

  /** Driver: end their active trip. */
  endTrip: (tripId: string) =>
    apiFetch<Trip>(`/api/v1/trips/${tripId}/end`, { method: 'POST' }),

  /** Driver: send a GPS ping. */
  recordLocation: (tripId: string, ping: LocationPing) =>
    apiFetch<GpsTelemetry>(`/api/v1/trips/${tripId}/location`, { method: 'POST', body: JSON.stringify(ping) }),

  /** Parent: get active trip for a bus. */
  getActiveForBus: (busId: string) =>
    apiFetch<Trip | null>(`/api/v1/trips/bus/${busId}/active`),

  /** Parent: trip history for a bus (newest first, limit 20). */
  listTripsForBus: (busId: string) =>
    apiFetch<Trip[]>(`/api/v1/trips/bus/${busId}`),

  /** Parent: latest GPS location for a trip. */
  getLatestLocation: (tripId: string) =>
    apiFetch<GpsTelemetry | null>(`/api/v1/trips/${tripId}/location/latest`),

  /** Driver: send an SOS alert for the active trip. */
  sendSOS: (tripId: string) =>
    apiFetch<void>(`/api/v1/trips/${tripId}/sos`, { method: 'POST' }),

  /** Driver: cancel an active SOS alert. */
  cancelSOS: (tripId: string) =>
    apiFetch<void>(`/api/v1/trips/${tripId}/sos/cancel`, { method: 'POST' }),

  /** Driver: record a boarding or deboarding event for a student. */
  recordBoarding: (tripId: string, input: RecordBoardingInput) =>
    apiFetch<{ id: string }>(`/api/v1/trips/${tripId}/boarding`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /** Manager / school_admin: list all boarding events for a trip. */
  listBoarding: (tripId: string) =>
    apiFetch<BoardingEvent[]>(`/api/v1/trips/${tripId}/boarding`),
};
