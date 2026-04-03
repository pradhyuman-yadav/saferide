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
  it('uses the x-request-id header value when it is a valid UUID', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const req  = mockReq({ 'x-request-id': validUuid });
    const res  = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(req.requestId).toBe(validUuid);
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
    const req  = mockReq({ 'x-request-id': '00000000-0000-0000-0000-000000000001' });
    const res  = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('ignores a non-UUID x-request-id and generates a fresh UUID instead', () => {
    const injectedValue = '<script>alert(1)</script>';
    const req  = mockReq({ 'x-request-id': injectedValue });
    const res  = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    // Must NOT echo back the injected string
    expect(req.requestId).not.toBe(injectedValue);
    // Must generate a valid UUID
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
