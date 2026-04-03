/**
 * Integration tests — /health + /api/v1/auth routes
 *
 * Covers app.ts (health check, middleware wiring) and auth.routes.ts.
 * AuthService is mocked so no real Firebase calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mocks — must be registered before app import
// ---------------------------------------------------------------------------

// Bypass rate limiters so repeated calls in tests don't get 429
vi.mock('@saferide/middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@saferide/middleware')>();
  const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    ...actual,
    authRateLimiter:          passThrough,
    createAccountRateLimiter: passThrough,
    readRateLimiter:          passThrough,
  };
});

const serviceMock = vi.hoisted(() => ({
  claimInvite: vi.fn(),
  getProfile:  vi.fn(),
}));

vi.mock('../../src/services/auth.service', () => ({
  AuthService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/firebase-admin', () => ({
  initFirebaseAdmin: vi.fn(),
  getAdminAuth:      vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      uid:   'firebase-uid-001',
      email: 'admin@school.edu',
    }),
  })),
  getDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            uid:       'firebase-uid-001',
            email:     'admin@school.edu',
            name:      'Test User',
            role:      'school_admin',
            tenantId:  'tenant-001',
            status:    'active',
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          }),
        }),
      })),
    })),
  })),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog: vi.fn(),
}));

import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with service name (no auth required)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe('auth-service');
  });
});

describe('POST /api/v1/auth/invites/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 with role and tenantId on success', async () => {
    serviceMock.claimInvite.mockResolvedValue({
      uid:      'firebase-uid-001',
      role:     'school_admin',
      tenantId: 'tenant-001',
    });

    const res = await request(app)
      .post('/api/v1/auth/invites/claim')
      .send({ idToken: 'valid-firebase-token' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ role: 'school_admin', tenantId: 'tenant-001' });
  });

  it('returns 401 when no invite found (prevents email enumeration)', async () => {
    serviceMock.claimInvite.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/invites/claim')
      .send({ idToken: 'valid-firebase-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when body is missing idToken', async () => {
    const res = await request(app)
      .post('/api/v1/auth/invites/claim')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when idToken is an empty string', async () => {
    const res = await request(app)
      .post('/api/v1/auth/invites/claim')
      .send({ idToken: '' });

    expect(res.status).toBe(400);
  });

  it('propagates 401 thrown by service (invalid token)', async () => {
    serviceMock.claimInvite.mockRejectedValue(
      Object.assign(new Error('Invalid or expired token.'), { statusCode: 401, code: 'INVALID_TOKEN' }),
    );

    const res = await request(app)
      .post('/api/v1/auth/invites/claim')
      .send({ idToken: 'expired-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('GET /api/v1/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with profile when authenticated', async () => {
    const profile = {
      uid:       'firebase-uid-001',
      email:     'admin@school.edu',
      name:      'Test User',
      role:      'school_admin' as const,
      tenantId:  'tenant-001',
      status:    'active' as const,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    serviceMock.getProfile.mockResolvedValue(profile);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uid).toBe('firebase-uid-001');
  });

  it('returns 404 when profile does not exist', async () => {
    serviceMock.getProfile.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});
