import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV:                      z.enum(['development', 'production', 'test']).default('development'),
  PORT:                          z.coerce.number().default(4005),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  CORS_ORIGINS:                  z.string().default('http://localhost:5173'),
  LOG_LEVEL:                     z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  /** How often to send a keepalive ping to each client (ms). */
  WS_PING_INTERVAL_MS: z.coerce.number().default(30_000),
  /** How long to wait for a pong before closing the connection (ms). */
  WS_PONG_TIMEOUT_MS:  z.coerce.number().default(10_000),
});

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
