import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireRole } from '../src/require-role';
import type { UserRole } from '@saferide/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReq(overrides: Partial<{
  user: { uid: string; email: string; role: UserRole; tenantId: string | null };
}> = {}): Partial<Request> {
  return {
    user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null },
    ...overrides,
  } as unknown as Partial<Request>;
}

function mockRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('requireRole', () => {
  it('calls next() when req.user.role matches the required role', () => {
    const req  = mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'super_admin', tenantId: null } });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireRole('super_admin')(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when req.user.role does not match', () => {
    const req  = mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'driver', tenantId: null } });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireRole('super_admin')(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when req.user is undefined', () => {
    const req  = { headers: {}, requestId: 'test-id' } as unknown as Request;
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireRole('super_admin')(req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows any of the listed roles', () => {
    const roles: UserRole[] = ['super_admin', 'school_admin'];
    for (const role of roles) {
      const req  = mockReq({ user: { uid: 'u1', email: 'a@b.com', role, tenantId: null } });
      const res  = mockRes();
      const next = vi.fn() as unknown as NextFunction;

      requireRole('super_admin', 'school_admin')(req as Request, res as unknown as Response, next);

      expect(next).toHaveBeenCalledOnce();
    }
  });

  it('returns 403 when role is not in the allowed list', () => {
    const req  = mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'parent', tenantId: null } });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireRole('super_admin', 'school_admin')(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns error with FORBIDDEN code', () => {
    const req  = mockReq({ user: { uid: 'u1', email: 'a@b.com', role: 'manager', tenantId: null } });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireRole('super_admin')(req as Request, res as unknown as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });
});
