import type { UserRole } from '@saferide/types';

declare global {
  namespace Express {
    interface Request {
      user: {
        uid:      string;
        email:    string;
        role:     UserRole;
        tenantId: string | null;
      };
      requestId: string;
    }
  }
}
