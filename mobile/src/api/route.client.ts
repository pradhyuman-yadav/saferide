/**
 * route.client.ts
 * Mobile API client for the route-service (port 4003).
 * Uses the Firebase Auth ID token for every request.
 */
import { getAuth } from 'firebase/auth';

const BASE_URL = process.env['EXPO_PUBLIC_ROUTE_SERVICE_URL'] ?? 'http://localhost:4003';

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

export interface Bus {
  id:                 string;
  tenantId:           string;
  registrationNumber: string;
  make:               string;
  model:              string;
  year:               number;
  capacity:           number;
  status:             'active' | 'inactive' | 'maintenance';
  driverId:           string | null;
  routeId:            string | null;
  createdAt:          number;
  updatedAt:          number;
}

export interface Route {
  id:          string;
  tenantId:    string;
  name:        string;
  description: string | null;
  isActive:    boolean;
  createdAt:   number;
  updatedAt:   number;
}

export interface Stop {
  id:                      string;
  tenantId:                string;
  routeId:                 string;
  name:                    string;
  sequence:                number;
  lat:                     number;
  lon:                     number;
  estimatedOffsetMinutes:  number;
  createdAt:               number;
  updatedAt:               number;
}

export interface Driver {
  id:            string;
  tenantId:      string;
  firebaseUid:   string;
  email:         string;
  name:          string;
  phone:         string;
  licenseNumber: string;
  busId:         string | null;
  isActive:      boolean;
  createdAt:     number;
  updatedAt:     number;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const routeClient = {
  /** Get a single bus by ID. */
  getBus: (id: string) =>
    apiFetch<Bus>(`/api/v1/buses/${id}`),

  /** Get a single route by ID. */
  getRoute: (id: string) =>
    apiFetch<Route>(`/api/v1/routes/${id}`),

  /** Get all stops for a route, ordered by sequence. */
  listStops: (routeId: string) =>
    apiFetch<Stop[]>(`/api/v1/routes/${routeId}/stops`),

  /** Get a single driver by ID. */
  getDriver: (id: string) =>
    apiFetch<Driver>(`/api/v1/drivers/${id}`),
};
