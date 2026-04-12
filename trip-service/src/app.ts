/**
 * app.ts — Express app factory.
 * Exported separately from index.ts so integration tests can import the app
 * without triggering Firebase initialization or port binding.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestId, errorHandler, httpLogger } from '@saferide/middleware';
import { config } from './config';
import { tripRouter } from './routes/trip.routes';
import { webhookRouter } from './routes/webhook.routes';

const app: express.Application = express();

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = config.CORS_ORIGINS.split(',').map((o) => o.trim());
const isLocalhost = (origin: string) => /^https?:\/\/localhost:\d+$/.test(origin);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) { cb(null, true); return; }
    if (config.NODE_ENV !== 'production' && isLocalhost(origin)) { cb(null, true); return; }
    if (allowedOrigins.includes(origin)) { cb(null, true); return; }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Body parsing + request ID + HTTP logging ───────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(requestId);
app.use(httpLogger);

// ── Health check (no auth) ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { service: 'trip-service', status: 'ok' } });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/v1/trips', tripRouter);
app.use('/api/v1/webhooks', webhookRouter);

// ── Error handler (must be last) ───────────────────────────────────────────────
app.use(errorHandler);

export { app };
