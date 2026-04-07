import { Fragment, useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { webhookApi } from '@/api/client';
import type { Webhook, WebhookDelivery, WebhookEvent } from '@/types/webhook';
import { WEBHOOK_EVENT_LABELS } from '@/types/webhook';
import './buses.css';
import './webhooks.css';

const ALL_EVENTS: WebhookEvent[] = ['trip.started', 'trip.ended', 'sos.triggered', 'sos.cancelled'];

function deliveryStatusClass(status: WebhookDelivery['status']): string {
  switch (status) {
    case 'success': return 'status-badge status-badge--active';
    case 'failed':  return 'status-badge status-badge--maintenance';
    case 'pending': return 'status-badge status-badge--inactive';
  }
}

function relativeTime(ts: number | null): string {
  if (ts === null) return '—';
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (diff < 60_000)  return 'just now';
  if (mins  < 60)     return `${mins}m ago`;
  if (hours < 24)     return `${hours}h ago`;
  return `${days}d ago`;
}

export function WebhooksPage() {
  usePageTitle('Webhooks');

  const [webhooks,     setWebhooks]     = useState<Webhook[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  // Delivery panel state
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [deliveries,   setDeliveries]   = useState<WebhookDelivery[]>([]);
  const [loadingDel,   setLoadingDel]   = useState(false);
  const [delError,     setDelError]     = useState<string | null>(null);

  // Form fields
  const [url,          setUrl]          = useState('');
  const [events,       setEvents]       = useState<Set<WebhookEvent>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    webhookApi.list()
      .then((data) => { if (!cancelled) setWebhooks(data); })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load webhooks. Please refresh.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function resetForm() {
    setUrl('');
    setEvents(new Set());
    setFormError(null);
  }

  function toggleEvent(ev: WebhookEvent) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(ev)) {
        next.delete(ev);
      } else {
        next.add(ev);
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (!url.trim()) {
      setFormError('Endpoint URL is required.');
      return;
    }
    if (events.size === 0) {
      setFormError('Select at least one event.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await webhookApi.create({ url: url.trim(), events: Array.from(events) });
      setWebhooks((prev) => [created, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add webhook. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this webhook? Deliveries will stop immediately.')) return;
    setDeletingId(id);
    try {
      await webhookApi.delete(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      setLoadError('Could not remove webhook. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExpandDeliveries(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDeliveries([]);
    setDelError(null);
    setLoadingDel(true);
    try {
      const data = await webhookApi.listDeliveries(id);
      setDeliveries(data);
    } catch {
      setDelError('Could not load delivery log.');
    } finally {
      setLoadingDel(false);
    }
  }

  return (
    <div className="buses-page">

      {/* ── Header ── */}
      <div className="page-header-row">
        <h1 className="page-heading">Webhooks</h1>
        {!showForm && (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Add webhook
          </button>
        )}
      </div>

      {loadError !== null && <p className="page-error" role="alert">{loadError}</p>}

      {/* ── Add Webhook Form ── */}
      {showForm && (
        <div className="bus-form-card">
          <h2 className="bus-form-heading">New webhook</h2>

          <div className="webhook-signing-note">
            Your endpoint will receive a signed POST request. Verify it with:
            <code className="webhook-signing-code">sha256=HMAC-SHA256(your-secret, request-body)</code>
            The signing secret is generated automatically. Contact your administrator to retrieve it for signature verification.
          </div>

          {formError !== null && <p className="page-error" role="alert">{formError}</p>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-field" style={{ marginBottom: 'var(--space-6)' }}>
              <label className="form-label" htmlFor="webhookUrl">Endpoint URL</label>
              <input
                id="webhookUrl"
                className="form-input"
                type="url"
                placeholder="https://your-server.com/saferide-webhook"
                maxLength={500}
                value={url}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <fieldset className="webhook-events-fieldset">
              <legend className="form-label">Events (select at least one)</legend>
              <div className="webhook-events-checks">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} className="webhook-event-check">
                    <input
                      type="checkbox"
                      checked={events.has(ev)}
                      onChange={() => toggleEvent(ev)}
                      disabled={isSubmitting}
                    />
                    <span>{WEBHOOK_EVENT_LABELS[ev] ?? ev}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="bus-form-actions" style={{ marginTop: 'var(--space-6)' }}>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting
                  ? <span className="bus-form-loading"><span className="spinner spinner--sm" />Adding</span>
                  : 'Add webhook'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowForm(false); resetForm(); }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Webhook List ── */}
      {isLoading ? (
        <div className="table-loading"><div className="spinner" aria-label="Loading webhooks" /></div>
      ) : webhooks.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No webhooks yet. Add one to start receiving trip events.</p>
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Add first webhook
          </button>
        </div>
      ) : (
        <div className="buses-table-wrapper">
          <table className="buses-table webhook-table">
            <colgroup>
              <col />                             {/* URL */}
              <col style={{ width: '280px' }} />  {/* Events */}
              <col style={{ width: '100px' }} />  {/* Status */}
              <col style={{ width: '140px' }} />  {/* Created */}
              <col style={{ width: '160px' }} />  {/* Actions */}
            </colgroup>
            <thead>
              <tr>
                <th>Endpoint URL</th>
                <th>Events</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((wh) => (
                <Fragment key={wh.id}>
                  <tr>
                    <td>
                      <span className="webhook-url-cell" title={wh.url}>{wh.url}</span>
                    </td>
                    <td className="webhook-events-cell">
                      {wh.events.map((ev) => (
                        <span key={ev} className="event-tag">{WEBHOOK_EVENT_LABELS[ev] ?? ev}</span>
                      ))}
                    </td>
                    <td className="buses-table-nowrap">
                      <span className={wh.isActive ? 'status-badge status-badge--active' : 'status-badge status-badge--inactive'}>
                        {wh.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="buses-table-nowrap">
                      {new Date(wh.createdAt).toLocaleDateString()}
                    </td>
                    <td className="route-row-actions">
                      <button
                        type="button"
                        className={`action-btn${expandedId === wh.id ? ' action-btn--active' : ''}`}
                        onClick={() => handleExpandDeliveries(wh.id)}
                      >
                        {expandedId === wh.id ? 'Hide log' : 'Delivery log'}
                      </button>
                      <button
                        type="button"
                        className="btn-text-danger"
                        onClick={() => handleDelete(wh.id)}
                        disabled={deletingId === wh.id}
                      >
                        {deletingId === wh.id ? <span className="spinner spinner--sm" /> : 'Remove'}
                      </button>
                    </td>
                  </tr>

                  {/* Inline delivery log panel */}
                  {expandedId === wh.id && (
                    <tr className="driver-assign-row">
                      <td colSpan={5}>
                        <div className="delivery-panel">
                          <p className="delivery-panel-heading">Recent deliveries</p>
                          {loadingDel && (
                            <div className="table-loading" style={{ padding: 'var(--space-4)' }}>
                              <div className="spinner spinner--sm" aria-label="Loading deliveries" />
                            </div>
                          )}
                          {delError !== null && (
                            <p className="page-error" role="alert">{delError}</p>
                          )}
                          {!loadingDel && delError === null && deliveries.length === 0 && (
                            <p className="delivery-empty">No deliveries recorded yet.</p>
                          )}
                          {!loadingDel && deliveries.map((d) => (
                            <div key={d.id} className="delivery-row">
                              <div className="delivery-meta">
                                <span className={deliveryStatusClass(d.status)}>{d.status}</span>
                                <span className="event-tag">{WEBHOOK_EVENT_LABELS[d.event] ?? d.event}</span>
                                <span className="delivery-code">
                                  {d.statusCode !== null ? `HTTP ${d.statusCode}` : 'No response'}
                                </span>
                                <span className="delivery-time">{relativeTime(d.lastAttemptAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
