import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV:                      z.enum(['development', 'production', 'test']).default('development'),
  ROUTE_SERVICE_PORT:            z.coerce.number().default(4003),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).refine(
    (v) => { try { JSON.parse(v); return true; } catch { return false; } },
    { message: 'FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON' },
  ),
  CORS_ORIGINS:                  z.string().default('http://localhost:5173'),
  LOG_LEVEL:                     z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  NODE_ENV:                      parsed.data.NODE_ENV,
  PORT:                          parsed.data.ROUTE_SERVICE_PORT,
  FIREBASE_SERVICE_ACCOUNT_JSON: parsed.data.FIREBASE_SERVICE_ACCOUNT_JSON,
  CORS_ORIGINS:                  parsed.data.CORS_ORIGINS,
  LOG_LEVEL:                     parsed.data.LOG_LEVEL,
};
