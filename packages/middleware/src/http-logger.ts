/**
 * http-logger.ts
 *
 * Logs every HTTP request on completion. Wire it after `requestId` so that
 * req.requestId is already populated, and after `express.json()` so body
 * parsing errors are still captured.
 *
 * Log levels:
 *   5xx → error   (server fault — always visible)
 *   4xx → warn    (client fault — visible at info+)
 *   2xx/3xx → info (happy path)
 *   /health → skipped (too noisy in production)
 */
import type { Request, Response, NextFunction } from 'express';
import { logger } from '@saferide/logger';

export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip health checks — they fire every 30s from load balancers and add noise
  if (req.path === '/health') { next(); return; }

  const startMs = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    const status     = res.statusCode;

    const level: 'error' | 'warn' | 'info' =
      status >= 500 ? 'error' :
      status >= 400 ? 'warn'  :
      'info';

    logger[level]({
      requestId:  req.requestId,
      method:     req.method,
      path:       req.path,
      // Include non-empty query strings so you can reconstruct the full request
      query:      Object.keys(req.query).length > 0 ? req.query : undefined,
      status,
      durationMs,
      // User context — only present after verifyJwt runs
      uid:        req.user?.uid,
      tenantId:   req.user?.tenantId,
      role:       req.user?.role,
      // Network context for abuse / anomaly detection
      ip:         req.ip ?? req.socket.remoteAddress,
      userAgent:  req.headers['user-agent'],
    }, `${req.method} ${req.path} ${status} ${durationMs}ms`);
  });

  next();
}
