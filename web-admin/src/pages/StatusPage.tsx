/**
 * StatusPage — public system status dashboard.
 *
 * Architecture:
 *   Browser  →  GET /api/v1/status  →  auth-service
 *                                           ↓ (server-side fan-out)
 *                                      tenant / route / trip / livetrack /health
 *
 * The browser makes ONE request every 30 s. Internal service URLs never
 * leave the server. Auth-service is implicitly operational if it responds.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import './status.css';

// ── Types ─────────────────────────────────────────────────────────────────

type ServiceStatus = 'operational' | 'down';
type OverallStatus = 'checking' | 'operational' | 'down';

interface ServiceResult {
  key:    string;
  label:  string;
  status: ServiceStatus;
}

interface StatusData {
  overall:   'operational' | 'down';
  services:  ServiceResult[];
  checkedAt: number;
}

// ── Fetch ─────────────────────────────────────────────────────────────────

const STATUS_URL =
  `${(import.meta.env['VITE_AUTH_SERVICE_URL'] as string | undefined) ?? 'http://localhost:4001'}/api/v1/status`;

async function fetchStatus(): Promise<StatusData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res  = await fetch(STATUS_URL, { signal: controller.signal });
    const json = await res.json() as { success: boolean; data: StatusData };
    return json.success ? json.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Page ─────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;

export function StatusPage() {
  usePageTitle('System Status — SafeRide');

  const [overall,     setOverall]     = useState<OverallStatus>('checking');
  const [services,    setServices]    = useState<ServiceResult[]>([]);
  const [checkedAt,   setCheckedAt]   = useState<number | null>(null);
  const [nextCheckIn, setNextCheckIn] = useState(POLL_MS / 1000);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCheck = useCallback(async () => {
    setOverall('checking');
    setNextCheckIn(POLL_MS / 1000);

    const data = await fetchStatus();

    if (data) {
      setOverall(data.overall);
      setServices(data.services);
      setCheckedAt(data.checkedAt);
    } else {
      // Auth-service itself is unreachable
      setOverall('down');
      setServices([]);
      setCheckedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    void runCheck();
    const poll = setInterval(() => { void runCheck(); }, POLL_MS);
    return () => clearInterval(poll);
  }, [runCheck]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextCheckIn(n => (n > 1 ? n - 1 : 0));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  return (
    <div className="status-page">

      {/* ── Nav ── */}
      <header className="status-nav">
        <div className="status-nav-inner">
          <Link to="/">
            <img src="/logo.svg" alt="SafeRide" className="status-nav-logo" />
          </Link>
          <Link to="/login" className="status-nav-signin">Sign in</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={`status-hero status-hero--${overall}`}>
        <div className="status-hero-inner">
          <div className={`status-hero-orb status-hero-orb--${overall}`} aria-hidden="true" />

          <h1 className="status-hero-title">
            {overall === 'checking'    && 'Checking services\u2026'}
            {overall === 'operational' && 'All systems operational'}
            {overall === 'down'        && 'Service disruption'}
          </h1>

          {checkedAt !== null ? (
            <p className="status-hero-meta">
              Last checked {formatTime(checkedAt)}
              {' \u00B7 '}
              Next check in {nextCheckIn}s
            </p>
          ) : (
            <p className="status-hero-meta">&nbsp;</p>
          )}

          <button
            type="button"
            className="status-refresh-btn"
            onClick={() => { void runCheck(); }}
            disabled={overall === 'checking'}
          >
            Refresh now
          </button>
        </div>
      </section>

      {/* ── Services ── */}
      {services.length > 0 && (
        <main className="status-main">
          <div className="status-main-inner">
            <p className="status-section-label">Services</p>
            <div className="status-service-list">
              {services.map((svc) => (
                <div key={svc.key} className="status-service-row">
                  <p className="status-service-name">{svc.label}</p>
                  <span className={`status-pill status-pill--${svc.status}`}>
                    <span className={`status-dot status-dot--${svc.status}`} aria-hidden="true" />
                    {svc.status === 'operational' ? 'Operational' : 'Unavailable'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="status-footer">
        <p className="status-footer-text">
          SafeRide
          {' \u00B7 '}
          <Link to="/" className="status-footer-link">Home</Link>
          {' \u00B7 '}
          <Link to="/privacy" className="status-footer-link">Privacy</Link>
          {' \u00B7 '}
          <Link to="/terms" className="status-footer-link">Terms</Link>
          {' \u00B7 '}
          <Link to="/login" className="status-footer-link">Admin portal</Link>
        </p>
      </footer>

    </div>
  );
}
