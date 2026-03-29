import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

// Audit logger — structured log for sensitive operations
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
