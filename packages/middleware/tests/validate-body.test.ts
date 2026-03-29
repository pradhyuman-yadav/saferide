import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../src/validate-body';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReq(body: unknown): Request {
  return { body, headers: {}, requestId: 'test-id' } as unknown as Request;
}

function mockRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const TestSchema = z.object({
  name:  z.string().min(1),
  email: z.string().email(),
  age:   z.number().int().positive().optional(),
});

describe('validateBody', () => {
  it('calls next() and replaces req.body with parsed data for valid input', () => {
    const req  = mockReq({ name: 'Priya', email: 'priya@school.edu' });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(TestSchema)(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: 'Priya', email: 'priya@school.edu' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with VALIDATION_ERROR code for invalid input', () => {
    const req  = mockReq({ name: '', email: 'not-an-email' });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(TestSchema)(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
    );
  });

  it('includes field-level errors in details', () => {
    const req  = mockReq({ name: 'Priya', email: 'bademail' });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(TestSchema)(req, res as unknown as Response, next);

    const [[responseBody]] = res.json.mock.calls as [[{ error: { details: Record<string, unknown> } }]];
    expect(responseBody.error.details).toHaveProperty('email');
  });

  it('strips extra fields not in the schema', () => {
    const req  = mockReq({ name: 'Priya', email: 'priya@school.edu', extraField: 'should-be-stripped' });
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(TestSchema)(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).not.toHaveProperty('extraField');
  });

  it('returns 400 when body is null', () => {
    const req  = mockReq(null);
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(TestSchema)(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when required fields are missing', () => {
    const req  = mockReq({});
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(TestSchema)(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
