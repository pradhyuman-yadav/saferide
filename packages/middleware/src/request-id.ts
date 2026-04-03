import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers['x-request-id'] as string | undefined;
  req.requestId = (header !== undefined && UUID_RE.test(header)) ? header : randomUUID();
  next();
}
