import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny, ZodError } from 'zod';

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        success: false,
        error: {
          code:    'VALIDATION_ERROR',
          message: 'Request body is invalid.',
          details: zodError.flatten().fieldErrors,
        },
      });
      return;
    }
    req.body = result.data as unknown;
    next();
  };
}
