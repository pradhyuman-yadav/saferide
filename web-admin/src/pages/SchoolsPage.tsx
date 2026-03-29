import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTenants } from '@/firebase/tenants';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Tenant, TenantStatus } from '@/types/tenant';
import './schools.css';

function statusBadgeClass(status: TenantStatus): string {
  switch (status) {
    case 'pending':   return 'status-badge status-badge--pending';
    case 'active':    return 'status-badge status-badge--active';
    case 'trial':     return 'status-badge status-badge--trial';
    case 'suspended': return 'status-badge status-badge--suspended';
    case 'cancelled': return 'status-badge status-badge--cancelled';
  }
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function SchoolsPage() {
  usePageTitle('Schools');
  const [tenants,   setTenants]   = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTenants()
      .then((data) => { if (!cancelled) setTenants(data); })
      .catch(() => { if (!cancelled) setError('Could not load schools. Please refresh.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const pending = tenants.filter((t) => t.status === 'pending');
  const active  = tenants.filter((t) => t.status !== 'pending');

  return (
    <div className="schools-page">
      <div className="page-header-row">
        <h1 className="page-heading">Schools</h1>
        <Link to="/schools/new" className="btn-primary">Onboard new school</Link>
      </div>

      {error !== null && (
        <p className="page-error" role="alert">{error}</p>
      )}

      {isLoading ? (
        <div className="table-loading">
          <div className="spinner" aria-label="Loading schools" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No schools yet.</p>
          <Link to="/schools/new" className="btn-primary">Onboard your first school</Link>
        </div>
      ) : (
        <>
          {/* ── Pending setup ── */}
          {pending.length > 0 && (
            <section className="schools-section">
              <h2 className="schools-section-heading">
                Awaiting setup
                <span className="schools-section-count">{pending.length}</span>
              </h2>
              <p className="schools-section-caption">
                Invite sent — waiting for the school admin to create their account.
                Trial clock starts when they sign in.
              </p>
              <div className="schools-table-wrapper">
                <table className="schools-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>City</th>
                      <th>Plan</th>
                      <th>Admin email</th>
                      <th>Onboarded</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{t.city}</td>
                        <td>{t.plan}</td>
                        <td>{t.adminEmail}</td>
                        <td>{formatDate(t.createdAt)}</td>
                        <td>
                          <Link to={`/schools/${t.id}`} className="action-link">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Active schools ── */}
          {active.length > 0 && (
            <section className="schools-section">
              <h2 className="schools-section-heading">
                Active schools
                <span className="schools-section-count">{active.length}</span>
              </h2>
              <div className="schools-table-wrapper">
                <table className="schools-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>City</th>
                      <th>Status</th>
                      <th>Plan</th>
                      <th>Trial ends</th>
                      <th>Contact</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{t.city}</td>
                        <td>
                          <span className={statusBadgeClass(t.status)}>{t.status}</span>
                        </td>
                        <td>{t.plan}</td>
                        <td>
                          {t.status === 'trial' && t.trialEndsAt !== null
                            ? formatDate(t.trialEndsAt)
                            : '—'}
                        </td>
                        <td>{t.contactEmail}</td>
                        <td>
                          <Link to={`/schools/${t.id}`} className="action-link">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
