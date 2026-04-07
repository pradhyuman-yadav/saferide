import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  // Redact auth tokens and sensitive fields from all logs everywhere
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

/**
 * Returns a child logger pre-tagged with the service name.
 * Every log line emitted by the child automatically carries { service }.
 * Use once at the top of each service/repository module:
 *
 *   const log = createServiceLogger('bus');
 */
export function createServiceLogger(service: string): pino.Logger {
  return logger.child({ service });
}

// Audit logger — structured log for sensitive operations.
// Written at INFO level with audit:true so it can be filtered separately
// in CloudWatch (e.g. filterPattern: "{ $.audit = true }").
export function auditLog(params: {
  action:    string;
  actorId:   string;
  actorRole: string;
  tenantId?: string | null;
  targetId?: string;
  meta?:     Record<string, unknown>;
}): void {
  logger.info({ audit: true, ...params }, `AUDIT: ${params.action}`);
}
