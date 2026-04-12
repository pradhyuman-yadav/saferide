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
import { authRouter } from './routes/auth.routes';

const app: express.Application = express();

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

// ── Body parsing + request ID + HTTP logging ─────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(requestId);
app.use(httpLogger);

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { service: 'auth-service', status: 'ok' } });
});

// ── System status aggregator (no auth, server-side fan-out) ──────────────────
// The web-admin status page polls this single endpoint.
// Auth-service checks all sibling services internally — their URLs never
// reach the browser. Auth-service itself is implicitly operational
// (it is serving this very request).
const STATUS_SERVICES = [
  { key: 'tenant',    label: 'School management',    getUrl: () => config.TENANT_SERVICE_URL },
  { key: 'route',     label: 'Routes & fleet',        getUrl: () => config.ROUTE_SERVICE_URL  },
  { key: 'trip',      label: 'Trip tracking',         getUrl: () => config.TRIP_SERVICE_URL   },
  { key: 'livetrack', label: 'Live tracking gateway', getUrl: () => config.LIVETRACK_URL      },
];

app.get('/api/v1/status', (_req, res) => {
  const TIMEOUT_MS = 5_000;

  const checks = STATUS_SERVICES.map(async (svc) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${svc.getUrl()}/health`, { signal: controller.signal });
      return { key: svc.key, label: svc.label, status: r.ok ? 'operational' : 'down' } as const;
    } catch {
      return { key: svc.key, label: svc.label, status: 'down' } as const;
    } finally {
      clearTimeout(timer);
    }
  });

  void Promise.all(checks).then((results) => {
    const services: { key: string; label: string; status: 'operational' | 'down' }[] = [
      { key: 'auth', label: 'Authentication', status: 'operational' },
      ...results,
    ];
    const overall = services.every(s => s.status === 'operational') ? 'operational' : 'down';
    res.json({ success: true, data: { overall, services, checkedAt: Date.now() } });
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

export { app };
