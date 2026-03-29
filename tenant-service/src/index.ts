import './config'; // validate env first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initFirebaseAdmin } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';
import { requestId, errorHandler } from '@saferide/middleware';
import { config } from './config';
import { tenantsRouter } from './routes/tenants.routes';

// Initialize Firebase Admin SDK before anything else
initFirebaseAdmin();

const app = express();

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
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

// ── Body parsing + request ID ─────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(requestId);

// ── Health check (no auth) ────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { service: 'tenant-service', status: 'ok' } });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/tenants', tenantsRouter);

// ── Error handler (must be last) ─────────────────────────────────────────
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'tenant-service started');
});

export default app;
