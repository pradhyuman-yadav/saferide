import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@saferide/types';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code:    'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        },
      });
      return;
    }
    next();
  };
}
