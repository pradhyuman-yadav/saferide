/**
 * app.ts — Express app factory.
 * Exported separately from index.ts so integration tests can import the app
 * without triggering Firebase initialization or port binding.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@saferide/logger';
import { requestId, errorHandler, httpLogger } from '@saferide/middleware';
import { config } from './config';
import { busRouter } from './routes/bus.routes';
import { routeRouter, stopRouter } from './routes/route.routes';
import { driverRouter } from './routes/driver.routes';
import { studentRouter } from './routes/student.routes';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
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

// ── Body parsing + request ID + HTTP logging ──────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(requestId);
app.use(httpLogger);

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { service: 'route-service', status: 'ok' } });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/buses',    busRouter);
app.use('/api/v1/routes',   routeRouter);
app.use('/api/v1/stops',    stopRouter);
app.use('/api/v1/drivers',  driverRouter);
app.use('/api/v1/students', studentRouter);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

export { app };
logger.debug({ env: config.NODE_ENV }, 'route-service app configured');
