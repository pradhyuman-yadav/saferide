import type { Request, Response, NextFunction } from 'express';
import { logger } from '@saferide/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err, requestId: req.requestId, path: req.path }, 'Unhandled error');

  const statusCode = (err instanceof Error && typeof (err as unknown as { statusCode?: unknown }).statusCode === 'number')
    ? (err as unknown as { statusCode: number }).statusCode
    : 500;

  const is4xx = statusCode >= 400 && statusCode < 500;

  const code = is4xx && err instanceof Error && typeof (err as unknown as { code?: unknown }).code === 'string'
    ? (err as unknown as { code: string }).code
    : 'INTERNAL_ERROR';

  const message = is4xx && err instanceof Error
    ? err.message
    : 'An unexpected error occurred. Please try again.';

  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}
