import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../src/error-handler';

// ---------------------------------------------------------------------------
// We need to mock @saferide/logger before importing errorHandler
// ---------------------------------------------------------------------------
vi.mock('@saferide/logger', () => {
  const errorFn = vi.fn();
  return {
    logger: {
      error: errorFn,
      info:  vi.fn(),
      warn:  vi.fn(),
    },
    auditLog: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReq(): Request {
  return {
    headers:   {},
    requestId: 'test-req-id',
    path:      '/api/v1/tenants',
  } as unknown as Request;
}

function mockRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('errorHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 500 status', () => {
    const err  = new Error('Something went wrong');
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns INTERNAL_ERROR code in the response body', () => {
    const err  = new Error('Something went wrong');
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error:   expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
    );
  });

  it('logs the error via logger.error', async () => {
    const { logger } = await import('@saferide/logger');

    const err  = new Error('db down');
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res as unknown as Response, next);

    expect(logger.error).toHaveBeenCalledOnce();
    const [logObj] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0] as [Record<string, unknown>];
    expect(logObj).toMatchObject({ err, requestId: 'test-req-id' });
  });

  it('handles non-Error thrown values gracefully', () => {
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler('string error', req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ── statusCode propagation ─────────────────────────────────────────────────

  it('uses statusCode from the error when it is a 4xx', () => {
    const err  = Object.assign(new Error('Not found.'), { statusCode: 404, code: 'NOT_FOUND' });
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('uses the error code field for 4xx responses', () => {
    const err  = Object.assign(new Error('Unauthorized.'), { statusCode: 401, code: 'UNAUTHORIZED' });
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error:   expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    );
  });

  it('exposes the error message for 4xx responses', () => {
    const err  = Object.assign(new Error('Forbidden — insufficient role.'), { statusCode: 403, code: 'FORBIDDEN' });
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Forbidden — insufficient role.' }),
      }),
    );
  });

  it('hides the original message for 5xx errors (generic message only)', () => {
    const err  = Object.assign(new Error('DB connection string leaked here.'), { statusCode: 503 });
    const req  = mockReq();
    const res  = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res as unknown as Response, next);

    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0] as [{ error: { message: string } }];
    expect(call[0].error.message).not.toContain('DB connection string');
  });
});
