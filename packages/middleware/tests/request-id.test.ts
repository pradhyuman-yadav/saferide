import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestId } from '../src/request-id';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReq(headers: Record<string, string> = {}): Request {
  return { headers, requestId: '' } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('requestId', () => {
  it('uses the x-request-id header value when present', () => {
    const req  = mockReq({ 'x-request-id': 'my-fixed-id' });
    const res  = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(req.requestId).toBe('my-fixed-id');
    expect(next).toHaveBeenCalledOnce();
  });

  it('generates a UUID when x-request-id header is absent', () => {
    const req  = mockReq({});
    const res  = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(req.requestId).toBeTruthy();
    expect(typeof req.requestId).toBe('string');
    expect(next).toHaveBeenCalledOnce();
  });

  it('generated ID matches UUID format (36 chars with dashes)', () => {
    const req  = mockReq({});
    const res  = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(req.requestId).toHaveLength(36);
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('always calls next()', () => {
    const req  = mockReq({ 'x-request-id': 'explicit-id' });
    const res  = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
