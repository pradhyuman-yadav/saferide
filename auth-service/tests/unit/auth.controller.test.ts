import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { UserProfile, UserRole } from '@saferide/types';

// ---------------------------------------------------------------------------
// Use vi.hoisted so serviceMock is available inside the vi.mock factory
// ---------------------------------------------------------------------------
const serviceMock = vi.hoisted(() => ({
  claimInvite: vi.fn(),
  getProfile:  vi.fn(),
}));

vi.mock('../../src/services/auth.service', () => ({
  AuthService: vi.fn().mockImplementation(() => serviceMock),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { AuthController } from '../../src/controllers/auth.controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid:       'firebase-uid-001',
    email:     'admin@school.edu',
    name:      'Ramesh Kumar',
    role:      'school_admin',
    tenantId:  'tenant-001',
    status:    'active',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function mockReq(overrides: Partial<{
  body: unknown;
  user: { uid: string; email: string; role: UserRole; tenantId: string | null };
}> = {}): Request {
  return {
    body:      { idToken: 'some-firebase-token' },
    headers:   {},
    requestId: 'test-req-id',
    user:      { uid: 'firebase-uid-001', email: 'admin@school.edu', role: 'school_admin', tenantId: 'tenant-001' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): {
  status: ReturnType<typeof vi.fn>;
  json:   ReturnType<typeof vi.fn>;
  send:   ReturnType<typeof vi.fn>;
} {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController();
  });

  // -------------------------------------------------------------------------
  // claimInvite
  // -------------------------------------------------------------------------
  describe('claimInvite()', () => {
    it('returns 201 with { role, tenantId } on success', async () => {
      const claimResult = { uid: 'firebase-uid-001', role: 'school_admin' as const, tenantId: 'tenant-001' };
      serviceMock.claimInvite.mockResolvedValue(claimResult);

      const req = mockReq({ body: { idToken: 'valid-token' } });
      const res = mockRes();

      await controller.claimInvite(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data:    { role: 'school_admin', tenantId: 'tenant-001' },
      });
    });

    it('returns 404 when service returns null (no invite found)', async () => {
      serviceMock.claimInvite.mockResolvedValue(null);

      const req = mockReq({ body: { idToken: 'valid-token' } });
      const res = mockRes();

      await controller.claimInvite(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error:   expect.objectContaining({ code: 'INVITE_NOT_FOUND' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getMe
  // -------------------------------------------------------------------------
  describe('getMe()', () => {
    it('returns 200 with profile on success', async () => {
      const profile = makeProfile();
      serviceMock.getProfile.mockResolvedValue(profile);

      const req = mockReq();
      const res = mockRes();

      await controller.getMe(req, res as unknown as Response);

      expect(serviceMock.getProfile).toHaveBeenCalledWith('firebase-uid-001');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: profile });
    });

    it('returns 404 when profile not found', async () => {
      serviceMock.getProfile.mockResolvedValue(null);

      const req = mockReq();
      const res = mockRes();

      await controller.getMe(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'USER_NOT_FOUND' }),
        }),
      );
    });
  });
});
