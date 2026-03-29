import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTenants } from '@/firebase/tenants';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';
import type { Tenant, TenantStatus } from '@/types/tenant';
import './dashboard.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

function statusBadgeClass(status: TenantStatus): string {
  const map: Record<TenantStatus, string> = {
    pending:   'status-badge status-badge--pending',
    trial:     'status-badge status-badge--trial',
    active:    'status-badge status-badge--active',
    suspended: 'status-badge status-badge--suspended',
    cancelled: 'status-badge status-badge--cancelled',
  };
  return map[status];
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysUntil(ms: number): number {
  return Math.ceil((ms - Date.now()) / 86_400_000);
}

function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / 86_400_000);
}

const SEVEN_DAYS_MS = 7 * 86_400_000;

// ── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  usePageTitle('Dashboard');

  const profile = useAuthStore((s) => s.profile);

  const [tenants,   setTenants]   = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTenants()
      .then((data) => { if (!cancelled) setTenants(data); })
      .catch(() => { if (!cancelled) setError('Could not load dashboard data. Please refresh.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const counts = {
    total:     tenants.length,
    active:    tenants.filter((t) => t.status === 'active').length,
    trial:     tenants.filter((t) => t.status === 'trial').length,
    pending:   tenants.filter((t) => t.status === 'pending').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
  };

  const now = Date.now();

  const trialsExpiringSoon = tenants.filter(
    (t) => t.status === 'trial' && t.trialEndsAt !== null
        && t.trialEndsAt > now && t.trialEndsAt - now < SEVEN_DAYS_MS,
  );
  const stuckPending = tenants.filter(
    (t) => t.status === 'pending' && now - t.createdAt > SEVEN_DAYS_MS,
  );
  const suspendedList = tenants.filter((t) => t.status === 'suspended');

  const alertCount = trialsExpiringSoon.length + stuckPending.length + suspendedList.length;

  // tenants already sorted by createdAt desc
  const recentSchools = tenants.slice(0, 8);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-page">

      {/* ── Welcome ────────────────────────────────────────────────────────── */}
      <div className="sa-welcome">
        <div className="sa-welcome-text">
          <h1 className="sa-welcome-heading">
            {greeting()}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}.
          </h1>
          <p className="sa-welcome-sub">SafeRide Platform Administration</p>
        </div>
        <Link to="/schools/new" className="btn-primary">Onboard school</Link>
      </div>

      {error !== null && <p className="page-error" role="alert">{error}</p>}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="sa-stat-grid" aria-busy={isLoading}>
        {isLoading ? (
          <>
            <div className="stat-card-skeleton"><div className="skeleton-value" /><div className="skeleton-label" /></div>
            <div className="stat-card-skeleton"><div className="skeleton-value" /><div className="skeleton-label" /></div>
            <div className="stat-card-skeleton"><div className="skeleton-value" /><div className="skeleton-label" /></div>
            <div className="stat-card-skeleton"><div className="skeleton-value" /><div className="skeleton-label" /></div>
            <div className="stat-card-skeleton"><div className="skeleton-value" /><div className="skeleton-label" /></div>
          </>
        ) : (
          <>
            <StatCard label="Schools"       value={counts.total}     href="/schools" />
            <StatCard label="Active"        value={counts.active}    href="/schools" accent="sage" />
            <StatCard label="Trial"         value={counts.trial}     href="/schools" accent="gold" />
            <StatCard label="Pending setup" value={counts.pending}   href="/schools" />
            <StatCard label="Suspended"     value={counts.suspended} href="/schools" />
          </>
        )}
      </div>

      {!isLoading && (
        <div className="sa-main-grid">

          {/* ── Recent schools ──────────────────────────────────────────────── */}
          <section className="sa-card">
            <div className="sa-card-header">
              <h2 className="sa-card-heading">Recent schools</h2>
              <Link to="/schools" className="sa-card-link">View all</Link>
            </div>

            {recentSchools.length === 0 ? (
              <p className="sa-empty-msg">No schools onboarded yet.</p>
            ) : (
              <table className="sa-schools-table">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Location</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSchools.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link to={`/schools/${t.id}`} className="sa-school-link">{t.name}</Link>
                      </td>
                      <td className="sa-cell-muted">{t.city}, {t.state}</td>
                      <td>
                        <span className={`sa-plan-badge sa-plan-badge--${t.plan}`}>{t.plan}</span>
                      </td>
                      <td><span className={statusBadgeClass(t.status)}>{t.status}</span></td>
                      <td className="sa-cell-date">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Needs attention ─────────────────────────────────────────────── */}
          <section className="sa-card">
            <h2 className="sa-card-heading" style={{ marginBottom: 'var(--space-6)' }}>
              Needs attention
            </h2>

            {alertCount === 0 ? (
              <p className="sa-all-clear">All schools are in good standing.</p>
            ) : (
              <div className="sa-alert-groups">

                {trialsExpiringSoon.length > 0 && (
                  <div className="sa-alert-group">
                    <span className="sa-alert-group-label">Trial expiring soon</span>
                    {trialsExpiringSoon.map((t) => (
                      <div key={t.id} className="sa-alert-row">
                        <Link to={`/schools/${t.id}`} className="sa-alert-name">{t.name}</Link>
                        <span className="sa-alert-chip sa-alert-chip--warn">
                          {daysUntil(t.trialEndsAt!)}d left
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {stuckPending.length > 0 && (
                  <div className="sa-alert-group">
                    <span className="sa-alert-group-label">Invite not claimed</span>
                    {stuckPending.map((t) => (
                      <div key={t.id} className="sa-alert-row">
                        <Link to={`/schools/${t.id}`} className="sa-alert-name">{t.name}</Link>
                        <span className="sa-alert-chip sa-alert-chip--neutral">
                          {daysSince(t.createdAt)}d waiting
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {suspendedList.length > 0 && (
                  <div className="sa-alert-group">
                    <span className="sa-alert-group-label">Suspended</span>
                    {suspendedList.map((t) => (
                      <div key={t.id} className="sa-alert-row">
                        <Link to={`/schools/${t.id}`} className="sa-alert-name">{t.name}</Link>
                        <span className="sa-cell-muted">{t.city}</span>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:   string;
  value:   number;
  href:    string;
  accent?: 'sage' | 'gold';
}

function StatCard({ label, value, href, accent }: StatCardProps) {
  return (
    <Link to={href} className="sa-stat-card">
      <span className="sa-stat-label">{label}</span>
      <span className={`sa-stat-value${accent ? ` sa-stat-value--${accent}` : ''}`}>
        {value}
      </span>
    </Link>
  );
}
