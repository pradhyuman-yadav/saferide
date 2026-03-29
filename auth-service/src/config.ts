import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV:                      z.enum(['development', 'production', 'test']).default('development'),
  PORT:                          z.coerce.number().default(4001),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  CORS_ORIGINS:                  z.string().default('http://localhost:5173'),
  LOG_LEVEL:                     z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
