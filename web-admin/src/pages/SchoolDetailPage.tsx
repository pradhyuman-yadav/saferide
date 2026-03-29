import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getTenant,
  suspendTenant,
  reactivateTenant,
} from '@/firebase/tenants';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Tenant, TenantStatus } from '@/types/tenant';
import './school-detail.css';

// Re-use the badge styles from schools page
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
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

export function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [tenant,    setTenant]    = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing,  setIsActing]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  usePageTitle(tenant?.name ?? 'School');

  const schoolId = id ?? '';

  function loadTenant() {
    setIsLoading(true);
    getTenant(schoolId)
      .then((data) => setTenant(data))
      .catch(() => setError('Could not load school details. Please refresh.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (!schoolId) return;
    loadTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleSuspend = async () => {
    if (!window.confirm('Suspend this school? All active sessions will be invalidated.')) return;
    setIsActing(true);
    setError(null);
    try {
      await suspendTenant(schoolId);
      loadTenant();
    } catch {
      setError('Could not suspend the school. Please try again.');
    } finally {
      setIsActing(false);
    }
  };

  const handleReactivate = async () => {
    if (!window.confirm('Reactivate this school? They will regain full access immediately.')) return;
    setIsActing(true);
    setError(null);
    try {
      await reactivateTenant(schoolId);
      loadTenant();
    } catch {
      setError('Could not reactivate the school. Please try again.');
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="school-detail-page">
        <Link to="/schools" className="back-link">&larr; Back to Schools</Link>
        <div className="detail-loading">
          <div className="spinner" aria-label="Loading" />
        </div>
      </div>
    );
  }

  if (tenant === null) {
    return (
      <div className="school-detail-page">
        <Link to="/schools" className="back-link">&larr; Back to Schools</Link>
        <div className="detail-not-found">
          School not found.{' '}
          <Link to="/schools">Return to list</Link>
        </div>
      </div>
    );
  }

  const canSuspend    = tenant.status === 'active' || tenant.status === 'trial';
  const canReactivate = tenant.status === 'suspended';

  return (
    <div className="school-detail-page">
      <Link to="/schools" className="back-link">&larr; Back to Schools</Link>

      <div className="detail-heading-row">
        <h1 className="page-heading">{tenant.name}</h1>
        <span className={statusBadgeClass(tenant.status)}>{tenant.status}</span>
      </div>

      {error !== null && (
        <p className="page-error" role="alert">
          {error}
        </p>
      )}

      {/* ── School Information ── */}
      <div className="detail-section">
        <h2 className="detail-section-heading">School Information</h2>
        <div className="detail-grid">

          <div className="detail-field">
            <span className="detail-field-label">School Name</span>
            <span className="detail-field-value">{tenant.name}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Slug</span>
            <span className="detail-field-value detail-field-value--mono">{tenant.slug}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">City</span>
            <span className="detail-field-value">{tenant.city}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">State</span>
            <span className="detail-field-value">{tenant.state}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Plan</span>
            <span className="detail-field-value">{tenant.plan}</span>
          </div>

          {tenant.trialEndsAt !== null && (
            <div className="detail-field">
              <span className="detail-field-label">Trial Ends</span>
              <span className="detail-field-value">{formatDate(tenant.trialEndsAt)}</span>
            </div>
          )}

          <div className="detail-field">
            <span className="detail-field-label">Max Buses</span>
            <span className="detail-field-value">{tenant.maxBuses}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Max Students</span>
            <span className="detail-field-value">{tenant.maxStudents}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Contact Person</span>
            <span className="detail-field-value">{tenant.contactName}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Contact Email</span>
            <span className="detail-field-value">{tenant.contactEmail}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Contact Phone</span>
            <span className="detail-field-value">{tenant.contactPhone}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Admin Email</span>
            <span className="detail-field-value">{tenant.adminEmail}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Onboarded</span>
            <span className="detail-field-value">{formatDate(tenant.createdAt)}</span>
          </div>

          <div className="detail-field">
            <span className="detail-field-label">Last Updated</span>
            <span className="detail-field-value">{formatDate(tenant.updatedAt)}</span>
          </div>

        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="detail-section detail-section--danger">
        <h2 className="detail-section-heading">Danger Zone</h2>

        {canSuspend && (
          <>
            <p className="danger-description">
              Suspending this school will immediately prevent all users — drivers, parents,
              and administrators — from accessing SafeRide. This action can be reversed.
            </p>
            <button
              type="button"
              className="btn-danger"
              onClick={handleSuspend}
              disabled={isActing}
            >
              {isActing ? (
                <>
                  <span className="spinner spinner--sm" />
                  Suspending
                </>
              ) : (
                'Suspend school'
              )}
            </button>
          </>
        )}

        {canReactivate && (
          <>
            <p className="danger-description">
              Reactivating this school will restore full access for all users immediately.
            </p>
            <button
              type="button"
              className="btn-reactivate"
              onClick={handleReactivate}
              disabled={isActing}
            >
              {isActing ? (
                <>
                  <span className="spinner spinner--sm" />
                  Reactivating
                </>
              ) : (
                'Reactivate school'
              )}
            </button>
          </>
        )}

        {!canSuspend && !canReactivate && (
          <p className="danger-description">
            No actions are available for a {tenant.status} school.
          </p>
        )}
      </div>
    </div>
  );
}
