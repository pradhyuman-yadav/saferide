/**
 * Security: Auth bypass
 *
 * Asserts that every protected endpoint returns 401 when called without
 * a valid Authorization header.
 * /health is the only exempt route.
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { buildFirebaseMock } from '../helpers/firebase-mock';

vi.mock('@saferide/firebase-admin', () => buildFirebaseMock());
vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog: vi.fn(),
}));

// Service mocks — we're only testing auth enforcement, not business logic
vi.mock('../../src/services/bus.service',     () => ({ BusService:     vi.fn().mockImplementation(() => ({})) }));
vi.mock('../../src/services/driver.service',  () => ({ DriverService:  vi.fn().mockImplementation(() => ({})) }));
vi.mock('../../src/services/route.service',   () => ({ RouteService:   vi.fn().mockImplementation(() => ({})) }));
vi.mock('../../src/services/stop.service',    () => ({ StopService:    vi.fn().mockImplementation(() => ({})) }));
vi.mock('../../src/services/student.service', () => ({ StudentService: vi.fn().mockImplementation(() => ({})) }));

import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Every protected route must return 401 with no auth header
// ---------------------------------------------------------------------------

const PROTECTED_ROUTES: Array<[string, string]> = [
  ['GET',    '/api/v1/buses'],
  ['GET',    '/api/v1/buses/some-id'],
  ['POST',   '/api/v1/buses'],
  ['PATCH',  '/api/v1/buses/some-id'],
  ['DELETE', '/api/v1/buses/some-id'],
  ['PATCH',  '/api/v1/buses/some-id/assign-driver'],
  ['PATCH',  '/api/v1/buses/some-id/assign-route'],
  ['GET',    '/api/v1/routes'],
  ['GET',    '/api/v1/routes/some-id'],
  ['POST',   '/api/v1/routes'],
  ['PATCH',  '/api/v1/routes/some-id'],
  ['DELETE', '/api/v1/routes/some-id'],
  ['GET',    '/api/v1/stops'],
  ['POST',   '/api/v1/stops'],
  ['PATCH',  '/api/v1/stops/some-id'],
  ['DELETE', '/api/v1/stops/some-id'],
  ['GET',    '/api/v1/drivers'],
  ['GET',    '/api/v1/drivers/some-id'],
  ['POST',   '/api/v1/drivers'],
  ['PATCH',  '/api/v1/drivers/some-id'],
  ['DELETE', '/api/v1/drivers/some-id'],
  ['GET',    '/api/v1/students'],
  ['GET',    '/api/v1/students/some-id'],
  ['POST',   '/api/v1/students'],
  ['PATCH',  '/api/v1/students/some-id'],
  ['DELETE', '/api/v1/students/some-id'],
];

describe('Security: auth bypass — no token', () => {
  it.each(PROTECTED_ROUTES)(
    '%s %s → 401 UNAUTHORIZED',
    async (method, path) => {
      const req = request(app)[method.toLowerCase() as 'get'](path);
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    },
  );
});

describe('Security: auth bypass — malformed Authorization header', () => {
  it.each([
    'token-without-bearer-prefix',
    'Basic dXNlcjpwYXNz',
    '',
  ] as const)(
    'Authorization: "%s" → 401',
    async (headerValue) => {
      const res = await request(app)
        .get('/api/v1/buses')
        .set('Authorization', headerValue);
      expect(res.status).toBe(401);
    },
  );
});

describe('Security: /health is exempt from auth', () => {
  it('GET /health → 200 without token', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
