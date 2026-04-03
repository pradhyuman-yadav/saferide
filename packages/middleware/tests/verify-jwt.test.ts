import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------

const {
  mockVerifyIdToken,
  mockUserDocGet,
  mockTenantDocGet,
  mockAdminAuth,
  mockDb,
} = vi.hoisted(() => {
  const mockVerifyIdToken = vi.fn();
  const mockUserDocGet    = vi.fn();
  const mockTenantDocGet  = vi.fn();

  const mockAdminAuth = { verifyIdToken: mockVerifyIdToken };

  const mockDb = {
    collection: vi.fn((col: string) => ({
      doc: vi.fn(() => ({
        get: col === 'users' ? mockUserDocGet : mockTenantDocGet,
      })),
    })),
  };

  return { mockVerifyIdToken, mockUserDocGet, mockTenantDocGet, mockAdminAuth, mockDb };
});

vi.mock('@saferide/firebase-admin', () => ({
  getAdminAuth: vi.fn(() => mockAdminAuth),
  getDb:        vi.fn(() => mockDb),
}));

vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { verifyJwt } from '../src/verify-jwt';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    requestId: 'test-request-id',
  } as Partial<Request>;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json:   vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function validUserSnap(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      email:     'user@school.edu',
      name:      'Test User',
      role:      'school_admin',
      tenantId:  'tenant-001',
      status:    'active',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      ...overrides,
    }),
  };
}

function activeTenantSnap(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({ status: 'active', ...overrides }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyJwt middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  // ── Missing / malformed header ────────────────────────────────────────────

  it('returns 401 when Authorization header is absent', async () => {
    const req = makeReq();
    const res = makeRes();

    await verifyJwt(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = makeReq('Token abc123');
    const res = makeRes();

    await verifyJwt(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Token verification failures ───────────────────────────────────────────

  it('returns 401 with TOKEN_EXPIRED when token is expired', async () => {
    mockVerifyIdToken.mockRejectedValue(Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }));
    const res = makeRes();

    await verifyJwt(makeReq('Bearer expired-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'TOKEN_EXPIRED' }) }),
    );
  });

  it('returns 401 with TOKEN_REVOKED when token is revoked', async () => {
    mockVerifyIdToken.mockRejectedValue(Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' }));
    const res = makeRes();

    await verifyJwt(makeReq('Bearer revoked-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'TOKEN_REVOKED' }) }),
    );
  });

  it('returns 401 with INVALID_TOKEN for other token errors', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('malformed token'));
    const res = makeRes();

    await verifyJwt(makeReq('Bearer bad-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_TOKEN' }) }),
    );
  });

  // ── User profile checks ───────────────────────────────────────────────────

  it('returns 401 when user profile does not exist in Firestore', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue({ exists: false });
    const res = makeRes();

    await verifyJwt(makeReq('Bearer valid-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'USER_NOT_FOUND' }) }),
    );
  });

  it('returns 401 when user profile fails schema validation', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'invalid_role', status: 'active' }), // missing required fields
    });
    const res = makeRes();

    await verifyJwt(makeReq('Bearer valid-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_PROFILE' }) }),
    );
  });

  it('returns 403 when user account is suspended', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap({ status: 'suspended' }));
    const res = makeRes();

    await verifyJwt(makeReq('Bearer valid-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }) }),
    );
  });

  // ── Tenant checks ─────────────────────────────────────────────────────────

  it('returns 403 when tenant document does not exist', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap());
    mockTenantDocGet.mockResolvedValue({ exists: false });
    const res = makeRes();

    await verifyJwt(makeReq('Bearer valid-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'TENANT_NOT_FOUND' }) }),
    );
  });

  it('returns 403 when tenant is suspended', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap());
    mockTenantDocGet.mockResolvedValue(activeTenantSnap({ status: 'suspended' }));
    const res = makeRes();

    await verifyJwt(makeReq('Bearer valid-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'TENANT_SUSPENDED' }) }),
    );
  });

  it('returns 403 when tenant is cancelled', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap());
    mockTenantDocGet.mockResolvedValue(activeTenantSnap({ status: 'cancelled' }));
    const res = makeRes();

    await verifyJwt(makeReq('Bearer valid-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'TENANT_SUSPENDED' }) }),
    );
  });

  it('returns 403 when tenant trial has expired', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap());
    mockTenantDocGet.mockResolvedValue(activeTenantSnap({ status: 'trial', trialEndsAt: 1000 }));
    const res = makeRes();

    await verifyJwt(makeReq('Bearer valid-token') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'TRIAL_EXPIRED' }) }),
    );
  });

  it('calls next() when tenant trial is active (trialEndsAt in the future)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap());
    mockTenantDocGet.mockResolvedValue(activeTenantSnap({ status: 'trial', trialEndsAt: Date.now() + 86400000 }));
    const req = makeReq('Bearer valid-token');
    const res = makeRes();

    await verifyJwt(req as Request, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next() when tenant trial has no end date (trialEndsAt null)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap());
    mockTenantDocGet.mockResolvedValue(activeTenantSnap({ status: 'trial', trialEndsAt: null }));
    const req = makeReq('Bearer valid-token');
    const res = makeRes();

    await verifyJwt(req as Request, res, next);

    expect(next).toHaveBeenCalled();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('sets req.user and calls next() for a valid active user with active tenant', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-001', email: 'user@school.edu' });
    mockUserDocGet.mockResolvedValue(validUserSnap());
    mockTenantDocGet.mockResolvedValue(activeTenantSnap());
    const req = makeReq('Bearer valid-token');
    const res = makeRes();

    await verifyJwt(req as Request, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as Request).user).toMatchObject({
      uid:      'uid-001',
      email:    'user@school.edu',
      role:     'school_admin',
      tenantId: 'tenant-001',
    });
  });

  it('skips tenant check and calls next() for super_admin (tenantId is null)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'super-001', email: 'super@saferide.io' });
    mockUserDocGet.mockResolvedValue(validUserSnap({ role: 'super_admin', tenantId: null }));
    const req = makeReq('Bearer super-token');
    const res = makeRes();

    await verifyJwt(req as Request, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockTenantDocGet).not.toHaveBeenCalled();
    expect((req as Request).user).toMatchObject({ role: 'super_admin', tenantId: null });
  });
});
