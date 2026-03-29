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
});
