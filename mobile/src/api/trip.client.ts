/**
 * trip.client.ts
 * Mobile API client for the trip-service (port 4004).
 * Uses the Firebase Auth ID token for every request.
 */
import { getAuth } from 'firebase/auth';

const BASE_URL = process.env['EXPO_PUBLIC_TRIP_SERVICE_URL'] ?? 'http://localhost:4004';

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const res   = await fetch(`${BASE_URL}${path}`, {
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
};
