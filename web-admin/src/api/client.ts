import { getAuth } from 'firebase/auth';

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function apiFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getIdToken();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    // Network-level failure: service is down, wrong port, or CORS preflight blocked
    throw Object.assign(
      new Error(`Cannot connect to ${baseUrl}. Make sure all backend services are running with \`pnpm dev\`.`),
      { code: 'SERVICE_UNAVAILABLE' },
    );
  }

  // 204 No Content — DELETE/PATCH endpoints that return no body
  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json() as { success: boolean; data?: T; error?: { code: string; message: string } };

  if (!json.success) {
    const msg = json.error?.message ?? 'An unexpected error occurred.';
    throw Object.assign(new Error(msg), { code: json.error?.code });
  }

  return json.data as T;
}

import type { Bus, CreateBusInput } from '@/types/bus';
import type { Route, CreateRouteInput } from '@/types/route';
import type { Stop, CreateStopInput } from '@/types/stop';
import type { Driver, CreateDriverInput } from '@/types/driver';
import type { Student, CreateStudentInput } from '@/types/student';
import type { Trip } from '@/types/trip';
import type { GpsTelemetry } from '@/types/telemetry';

const TENANT_URL = import.meta.env['VITE_TENANT_SERVICE_URL'] as string ?? 'http://localhost:4002';
const AUTH_URL   = import.meta.env['VITE_AUTH_SERVICE_URL']   as string ?? 'http://localhost:4001';
const ROUTE_URL  = import.meta.env['VITE_ROUTE_SERVICE_URL']  as string ?? 'http://localhost:4003';
const TRIP_URL   = import.meta.env['VITE_TRIP_SERVICE_URL']   as string ?? 'http://localhost:4004';

export const tenantApi = {
  list:       ()               => apiFetch<{ id: string; name: string; status: string }[]>(TENANT_URL, '/api/v1/tenants'),
  getById:    (id: string)     => apiFetch<unknown>(TENANT_URL, `/api/v1/tenants/${id}`),
  create:     (body: unknown)  => apiFetch<unknown>(TENANT_URL, '/api/v1/tenants', { method: 'POST', body: JSON.stringify(body) }),
  suspend:    (id: string)     => apiFetch<void>(TENANT_URL, `/api/v1/tenants/${id}/suspend`, { method: 'PATCH' }),
  reactivate: (id: string)     => apiFetch<void>(TENANT_URL, `/api/v1/tenants/${id}/reactivate`, { method: 'PATCH' }),
};

export const authApi = {
  claimInvite: (idToken: string) => apiFetch<{ role: string; tenantId: string }>(AUTH_URL, '/api/v1/auth/invites/claim', { method: 'POST', body: JSON.stringify({ idToken }) }),
  getMe:       ()                => apiFetch<unknown>(AUTH_URL, '/api/v1/auth/me'),
};

// ── Route Service ─────────────────────────────────────────────────────────

export const routeApi = {
  // Buses
  listBuses:  () =>
    apiFetch<Bus[]>(ROUTE_URL, '/api/v1/buses'),
  createBus:  (body: CreateBusInput) =>
    apiFetch<Bus>(ROUTE_URL, '/api/v1/buses', { method: 'POST', body: JSON.stringify(body) }),
  deleteBus:      (id: string) =>
    apiFetch<void>(ROUTE_URL, `/api/v1/buses/${id}`, { method: 'DELETE' }),
  assignBusDriver: (id: string, driverId: string | null) =>
    apiFetch<Bus>(ROUTE_URL, `/api/v1/buses/${id}/assign-driver`, { method: 'PATCH', body: JSON.stringify({ driverId }) }),
  assignBusRoute:  (id: string, routeId: string | null) =>
    apiFetch<Bus>(ROUTE_URL, `/api/v1/buses/${id}/assign-route`, { method: 'PATCH', body: JSON.stringify({ routeId }) }),

  // Routes
  listRoutes:       () =>
    apiFetch<Route[]>(ROUTE_URL, '/api/v1/routes'),
  createRoute:      (body: CreateRouteInput) =>
    apiFetch<Route>(ROUTE_URL, '/api/v1/routes', { method: 'POST', body: JSON.stringify(body) }),
  deactivateRoute:  (id: string) =>
    apiFetch<void>(ROUTE_URL, `/api/v1/routes/${id}`, { method: 'DELETE' }),

  // Stops
  listStops:  (routeId: string) =>
    apiFetch<Stop[]>(ROUTE_URL, `/api/v1/routes/${routeId}/stops`),
  createStop: (routeId: string, body: CreateStopInput) =>
    apiFetch<Stop>(ROUTE_URL, `/api/v1/routes/${routeId}/stops`, { method: 'POST', body: JSON.stringify(body) }),
  updateStop: (id: string, body: { sequence?: number; name?: string; estimatedOffsetMinutes?: number }) =>
    apiFetch<Stop>(ROUTE_URL, `/api/v1/stops/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteStop: (id: string) =>
    apiFetch<void>(ROUTE_URL, `/api/v1/stops/${id}`, { method: 'DELETE' }),

  // Drivers
  listDrivers:  () =>
    apiFetch<Driver[]>(ROUTE_URL, '/api/v1/drivers'),
  createDriver: (body: CreateDriverInput) =>
    apiFetch<Driver>(ROUTE_URL, '/api/v1/drivers', { method: 'POST', body: JSON.stringify(body) }),
  updateDriver: (id: string, body: { busId?: string | null; isActive?: boolean }) =>
    apiFetch<Driver>(ROUTE_URL, `/api/v1/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDriver: (id: string) =>
    apiFetch<void>(ROUTE_URL, `/api/v1/drivers/${id}`, { method: 'DELETE' }),

  // Students
  listStudents:   () =>
    apiFetch<Student[]>(ROUTE_URL, '/api/v1/students'),
  createStudent:  (body: CreateStudentInput) =>
    apiFetch<Student>(ROUTE_URL, '/api/v1/students', { method: 'POST', body: JSON.stringify(body) }),
  updateStudent:  (id: string, body: { busId?: string | null; stopId?: string | null; isActive?: boolean }) =>
    apiFetch<Student>(ROUTE_URL, `/api/v1/students/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteStudent:  (id: string) =>
    apiFetch<void>(ROUTE_URL, `/api/v1/students/${id}`, { method: 'DELETE' }),
};

// ── Trip Service (webhook management) ─────────────────────────────────────

import type { Webhook, WebhookDelivery, CreateWebhookInput } from '@/types/webhook';

export const webhookApi = {
  list:           ()                         => apiFetch<Webhook[]>(TRIP_URL, '/api/v1/webhooks'),
  create:         (body: CreateWebhookInput) => apiFetch<Webhook>(TRIP_URL, '/api/v1/webhooks', { method: 'POST', body: JSON.stringify(body) }),
  delete:         (id: string)               => apiFetch<void>(TRIP_URL, `/api/v1/webhooks/${id}`, { method: 'DELETE' }),
  listDeliveries: (id: string)               => apiFetch<WebhookDelivery[]>(TRIP_URL, `/api/v1/webhooks/${id}/deliveries`),
};

// ── Trip Service ───────────────────────────────────────────────────────────────

export const tripApi = {
  listAllHistory: () =>
    apiFetch<Trip[]>(TRIP_URL, '/api/v1/trips/all-history'),
  listTenantHistory: () =>
    apiFetch<Trip[]>(TRIP_URL, '/api/v1/trips/tenant-history'),
  // Manager/admin views
  getActiveForBus: (busId: string) =>
    apiFetch<Trip | null>(TRIP_URL, `/api/v1/trips/bus/${busId}/active`),
  getLatestLocation: (tripId: string) =>
    apiFetch<GpsTelemetry | null>(TRIP_URL, `/api/v1/trips/${tripId}/location/latest`),
};
