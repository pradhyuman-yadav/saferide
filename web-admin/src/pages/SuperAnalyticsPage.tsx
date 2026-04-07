import { useEffect, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { tripApi, tenantApi } from '@/api/client';
import type { Trip } from '@/types/trip';
import './school/analytics.css';

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function last7Days(): Array<{ label: string; dayStart: number }> {
  const result: Array<{ label: string; dayStart: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    result.push({ label: DAY_LABELS[d.getDay()] ?? '?', dayStart: startOfDay(d) });
  }
  return result;
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── SVG bar chart ─────────────────────────────────────────────────────────────

interface BarDay { label: string; count: number }

function BarChart({ days }: { days: BarDay[] }) {
  const max   = Math.max(...days.map(d => d.count), 1);
  const BAR_W = 40;
  const GAP   = 16;
  const H     = 80;
  const WIDTH = days.length * (BAR_W + GAP) - GAP;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${H + 28}`}
      style={{ width: '100%', maxWidth: '560px', display: 'block' }}
      aria-label="Trips per day"
    >
      {days.map(({ label, count }, i) => {
        const barH = count === 0 ? 3 : Math.max(8, Math.round((count / max) * H));
        const x    = i * (BAR_W + GAP);
        const y    = H - barH;
        return (
          <g key={label}>
            <rect x={x} y={y} width={BAR_W} height={barH} fill={count === 0 ? '#E6E6E6' : '#7B9669'} rx="3" />
            {count > 0 && (
              <text x={x + BAR_W / 2} y={y - 6} textAnchor="middle" fontSize="11"
                fill="#404E3B" fontFamily="DM Sans, sans-serif" fontWeight="500">
                {count}
              </text>
            )}
            <text x={x + BAR_W / 2} y={H + 20} textAnchor="middle" fontSize="11"
              fill="#6C8480" fontFamily="DM Sans, sans-serif">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Per-school breakdown ──────────────────────────────────────────────────────

interface SchoolRow {
  tenantId:    string;
  name:        string;
  trips:       number;
  completed:   number;
  avgDuration: number | null;
  sosCount:    number;
  lastTripAt:  number | null;
}

function computeSchoolRows(
  trips: Trip[],
  tenants: { id: string; name: string }[],
): SchoolRow[] {
  const tenantMap = new Map(tenants.map(t => [t.id, t.name]));
  const rowMap    = new Map<string, SchoolRow>();

  for (const trip of trips) {
    let row = rowMap.get(trip.tenantId);
    if (!row) {
      row = {
        tenantId:    trip.tenantId,
        name:        tenantMap.get(trip.tenantId) ?? trip.tenantId,
        trips:       0,
        completed:   0,
        avgDuration: null,
        sosCount:    0,
        lastTripAt:  null,
      };
      rowMap.set(trip.tenantId, row);
    }

    row.trips += 1;
    if (row.lastTripAt === null || trip.startedAt > row.lastTripAt) row.lastTripAt = trip.startedAt;
    if (trip.sosTriggeredAt !== undefined) row.sosCount += 1;
    if (trip.status === 'ended' && trip.endedAt !== undefined) {
      row.completed += 1;
      const dur = trip.endedAt - trip.startedAt;
      row.avgDuration = row.avgDuration === null
        ? dur
        : Math.round((row.avgDuration * (row.completed - 1) + dur) / row.completed);
    }
  }

  return [...rowMap.values()].sort((a, b) => b.trips - a.trips);
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d';

export function SuperAnalyticsPage() {
  usePageTitle('Analytics');

  const [allTrips,  setAllTrips]  = useState<Trip[]>([]);
  const [tenants,   setTenants]   = useState<{ id: string; name: string }[]>([]);
  const [period,    setPeriod]    = useState<Period>('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([tripApi.listAllHistory(), tenantApi.list()])
      .then(([trips, ts]) => {
        if (cancelled) return;
        setAllTrips(trips);
        setTenants(ts);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load analytics.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Filter by period ──────────────────────────────────────────────────────

  const periodMs = period === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
  const cutoff   = Date.now() - periodMs;
  const trips    = allTrips.filter(t => t.startedAt >= cutoff);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalTrips     = trips.length;
  const completedTrips = trips.filter(t => t.status === 'ended');
  const sosIncidents   = trips.filter(t => t.sosTriggeredAt !== undefined).length;

  const durationsMs = completedTrips
    .filter((t): t is Trip & { endedAt: number } => t.endedAt !== undefined)
    .map(t => t.endedAt - t.startedAt);
  const avgDurationMs = durationsMs.length > 0
    ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length
    : null;

  // ── Bar chart (always last 7 days) ────────────────────────────────────────

  const days7 = last7Days();
  const barDays: BarDay[] = days7.map(({ label, dayStart }) => ({
    label,
    count: allTrips.filter(t => startOfDay(new Date(t.startedAt)) === dayStart).length,
  }));

  // ── School breakdown ──────────────────────────────────────────────────────

  const schoolRows = computeSchoolRows(trips, tenants);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">Platform-wide trip performance across all schools.</p>
        </div>
        <div className="analytics-period-toggle">
          <button
            type="button"
            className={`period-btn${period === '7d' ? ' period-btn--active' : ''}`}
            onClick={() => setPeriod('7d')}
          >
            7 days
          </button>
          <button
            type="button"
            className={`period-btn${period === '30d' ? ' period-btn--active' : ''}`}
            onClick={() => setPeriod('30d')}
          >
            30 days
          </button>
        </div>
      </div>

      {error !== null && <p className="page-error">{error}</p>}

      {isLoading ? (
        <div className="analytics-loading">
          <span className="spinner spinner--md" />
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="kpi-row">
            <div className="kpi-card">
              <p className="kpi-label">Total trips</p>
              <p className="kpi-value">{totalTrips}</p>
              <p className="kpi-sub">in the last {period === '7d' ? '7 days' : '30 days'}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Completed</p>
              <p className="kpi-value">{completedTrips.length}</p>
              <p className="kpi-sub">
                {totalTrips > 0
                  ? `${Math.round((completedTrips.length / totalTrips) * 100)}% completion rate`
                  : 'no trips yet'}
              </p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Avg trip duration</p>
              <p className="kpi-value">
                {avgDurationMs !== null ? formatDuration(avgDurationMs) : '—'}
              </p>
              <p className="kpi-sub">across completed trips</p>
            </div>
            <div className="kpi-card kpi-card--alert">
              <p className="kpi-label">SOS incidents</p>
              <p className="kpi-value">{sosIncidents}</p>
              <p className="kpi-sub">
                {sosIncidents === 0 ? 'none in this period' : 'requires attention'}
              </p>
            </div>
          </div>

          {/* ── Trips per day chart ── */}
          <div className="analytics-card">
            <div className="analytics-card-header">
              <h2 className="analytics-card-heading">Trips per day — last 7 days</h2>
            </div>
            <div className="chart-area">
              <BarChart days={barDays} />
            </div>
          </div>

          {/* ── School breakdown ── */}
          <div className="analytics-card">
            <div className="analytics-card-header">
              <h2 className="analytics-card-heading">School breakdown</h2>
            </div>
            {schoolRows.length === 0 ? (
              <p className="analytics-empty">No trip data for this period.</p>
            ) : (
              <div className="table-scroll">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Trips</th>
                      <th>Completed</th>
                      <th>Avg duration</th>
                      <th>SOS</th>
                      <th>Last trip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolRows.map(row => (
                      <tr key={row.tenantId}>
                        <td className="analytics-bus-reg">{row.name}</td>
                        <td>{row.trips}</td>
                        <td>
                          <span className="analytics-completed">
                            {row.completed}
                            <span className="analytics-completed-pct">
                              {row.trips > 0
                                ? ` (${Math.round((row.completed / row.trips) * 100)}%)`
                                : ''}
                            </span>
                          </span>
                        </td>
                        <td>
                          {row.avgDuration !== null ? formatDuration(row.avgDuration) : '—'}
                        </td>
                        <td>
                          {row.sosCount > 0 ? (
                            <span className="analytics-sos-badge">{row.sosCount}</span>
                          ) : (
                            <span className="analytics-zero">—</span>
                          )}
                        </td>
                        <td className="analytics-ts">
                          {row.lastTripAt !== null ? formatTime(row.lastTripAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SOS incidents ── */}
          {sosIncidents > 0 && (
            <div className="analytics-card">
              <div className="analytics-card-header">
                <h2 className="analytics-card-heading">SOS incidents</h2>
              </div>
              <div className="table-scroll">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Driver</th>
                      <th>Triggered</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips
                      .filter((t): t is Trip & { sosTriggeredAt: number } => t.sosTriggeredAt !== undefined)
                      .sort((a, b) => b.sosTriggeredAt - a.sosTriggeredAt)
                      .map(t => {
                        const school = tenants.find(s => s.id === t.tenantId);
                        return (
                          <tr key={t.id}>
                            <td className="analytics-bus-reg">
                              {school?.name ?? t.tenantId}
                            </td>
                            <td className="analytics-ts">{t.driverId}</td>
                            <td className="analytics-ts">{formatTime(t.sosTriggeredAt)}</td>
                            <td>
                              <span className={`sos-status-badge sos-status-badge--${t.sosActive ? 'active' : 'resolved'}`}>
                                {t.sosActive ? 'Active' : 'Resolved'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
