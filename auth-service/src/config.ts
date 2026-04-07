import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV:                      z.enum(['development', 'production', 'test']).default('development'),
  AUTH_SERVICE_PORT:             z.coerce.number().default(4001),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).refine(
    (v) => { try { JSON.parse(v); return true; } catch { return false; } },
    { message: 'FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON' },
  ),
  CORS_ORIGINS:                  z.string().default('http://localhost:5173'),
  LOG_LEVEL:                     z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  // Internal service URLs — used server-side only for the /api/v1/status aggregator.
  // These never leave the server. Clients hit /api/v1/status on auth-service only.
  TENANT_SERVICE_URL:            z.string().default('http://localhost:4002'),
  ROUTE_SERVICE_URL:             z.string().default('http://localhost:4003'),
  TRIP_SERVICE_URL:              z.string().default('http://localhost:4004'),
  LIVETRACK_URL:                 z.string().default('http://localhost:4005'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  NODE_ENV:                      parsed.data.NODE_ENV,
  PORT:                          parsed.data.AUTH_SERVICE_PORT,
  FIREBASE_SERVICE_ACCOUNT_JSON: parsed.data.FIREBASE_SERVICE_ACCOUNT_JSON,
  CORS_ORIGINS:                  parsed.data.CORS_ORIGINS,
  LOG_LEVEL:                     parsed.data.LOG_LEVEL,
  TENANT_SERVICE_URL:            parsed.data.TENANT_SERVICE_URL,
  ROUTE_SERVICE_URL:             parsed.data.ROUTE_SERVICE_URL,
  TRIP_SERVICE_URL:              parsed.data.TRIP_SERVICE_URL,
  LIVETRACK_URL:                 parsed.data.LIVETRACK_URL,
};
