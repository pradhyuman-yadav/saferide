import { useState, useEffect, type FormEvent } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { routeApi } from '@/api/client';
import { RouteMap } from '@/components/RouteMap';
import type { Route } from '@/types/route';
import type { Stop } from '@/types/stop';
import './buses.css';
import './routes.css';

const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ?? '';

export function RoutesPage() {
  usePageTitle('Routes');

  // ── Routes state ──────────────────────────────────────────────────────────
  const [routes,         setRoutes]         = useState<Route[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [showRouteForm,  setShowRouteForm]  = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  // Route form
  const [routeName,         setRouteName]         = useState('');
  const [routeDesc,         setRouteDesc]         = useState('');
  const [routeFormError,    setRouteFormError]    = useState<string | null>(null);
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);

  // ── Map expand state ──────────────────────────────────────────────────────
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // ── Stops state ───────────────────────────────────────────────────────────
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [stops,           setStops]           = useState<Stop[]>([]);
  const [stopsLoading,    setStopsLoading]    = useState(false);
  const [stopsError,      setStopsError]      = useState<string | null>(null);
  const [deletingStopId,  setDeletingStopId]  = useState<string | null>(null);

  // Stop form (always visible when a route is selected)
  // Sequence is auto-derived: stops.length + 1 at submit time — no state needed
  const [stopName,         setStopName]         = useState('');
  const [stopOffset,       setStopOffset]       = useState<number>(0);
  const [draftLat,         setDraftLat]         = useState<number | null>(null);
  const [draftLon,         setDraftLon]         = useState<number | null>(null);
  const [stopFormError,    setStopFormError]    = useState<string | null>(null);
  const [isSubmittingStop, setIsSubmittingStop] = useState(false);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;

  // ── Load routes ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    routeApi.listRoutes()
      .then((data) => { if (!cancelled) setRoutes(data); })
      .catch(() => { if (!cancelled) setLoadError('Could not load routes. Please refresh.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Select / deselect route ───────────────────────────────────────────────
  function handleSelectRoute(id: string) {
    if (selectedRouteId === id) {
      setSelectedRouteId(null);
      setStops([]);
      resetStopForm();
      return;
    }
    setSelectedRouteId(id);
    setStopsError(null);
    resetStopForm();
    setStopsLoading(true);
    routeApi.listStops(id)
      .then((data) => setStops(data))
      .catch(() => setStopsError('Could not load stops. Please try again.'))
      .finally(() => setStopsLoading(false));
  }

  function resetStopForm() {
    setStopName('');
    setStopOffset(0);
    setDraftLat(null);
    setDraftLon(null);
    setStopFormError(null);
  }

  // ── Create route ──────────────────────────────────────────────────────────
  async function handleCreateRoute(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRouteFormError(null);
    if (!routeName.trim()) {
      setRouteFormError('Route name is required.');
      return;
    }
    setIsSubmittingRoute(true);
    try {
      const newRoute = await routeApi.createRoute({
        name:        routeName.trim(),
        description: routeDesc.trim() !== '' ? routeDesc.trim() : null,
      });
      setRoutes((prev) => [newRoute, ...prev]);
      setShowRouteForm(false);
      setRouteName('');
      setRouteDesc('');
    } catch (err) {
      setRouteFormError(err instanceof Error ? err.message : 'Could not add route. Please try again.');
    } finally {
      setIsSubmittingRoute(false);
    }
  }

  // ── Deactivate route ──────────────────────────────────────────────────────
  async function handleDeactivateRoute(id: string) {
    if (!window.confirm('Deactivate this route? It will no longer be assigned to buses.')) return;
    setDeactivatingId(id);
    try {
      await routeApi.deactivateRoute(id);
      setRoutes((prev) => prev.map((r) => r.id === id ? { ...r, isActive: false } : r));
      if (selectedRouteId === id) {
        setSelectedRouteId(null);
        setStops([]);
      }
    } catch {
      setLoadError('Could not deactivate route. Please try again.');
    } finally {
      setDeactivatingId(null);
    }
  }

  // ── Create stop ───────────────────────────────────────────────────────────
  async function handleCreateStop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedRouteId === null) return;
    setStopFormError(null);

    if (!stopName.trim()) {
      setStopFormError('Stop name is required.');
      return;
    }
    if (draftLat === null || draftLon === null) {
      setStopFormError('Click the map to place this stop\'s location.');
      return;
    }

    setIsSubmittingStop(true);
    try {
      const newStop = await routeApi.createStop(selectedRouteId, {
        name:                   stopName.trim(),
        sequence:               stops.length + 1,   // always appends to end
        lat:                    draftLat,
        lon:                    draftLon,
        estimatedOffsetMinutes: stopOffset,
      });
      setStops((prev) => [...prev, newStop].sort((a, b) => a.sequence - b.sequence));

      // Reset for next stop
      setStopName('');
      setStopOffset(0);
      setDraftLat(null);
      setDraftLon(null);
      setStopFormError(null);
    } catch (err) {
      setStopFormError(err instanceof Error ? err.message : 'Could not add stop. Please try again.');
    } finally {
      setIsSubmittingStop(false);
    }
  }

  // ── Delete stop + re-sequence remaining ──────────────────────────────────
  async function handleDeleteStop(id: string) {
    if (!window.confirm('Remove this stop from the route?')) return;
    setDeletingStopId(id);
    try {
      await routeApi.deleteStop(id);

      // Renumber remaining stops: sort by old sequence, assign 1, 2, 3, …
      const remaining = stops
        .filter((s) => s.id !== id)
        .sort((a, b) => a.sequence - b.sequence);

      const resequenced = remaining.map((s, i) => ({ ...s, sequence: i + 1 }));

      // Optimistic update — UI reflects correct sequences immediately
      setStops(resequenced);

      // Persist only the stops whose sequence actually changed
      const needsUpdate = resequenced.filter((s) => {
        const original = stops.find((o) => o.id === s.id);
        return original !== undefined && original.sequence !== s.sequence;
      });

      if (needsUpdate.length > 0) {
        await Promise.all(
          needsUpdate.map((s) => routeApi.updateStop(s.id, { sequence: s.sequence })),
        );
      }
    } catch {
      setStopsError('Could not remove stop. Please try again.');
      // Reload to restore consistent server state
      if (selectedRouteId !== null) {
        routeApi.listStops(selectedRouteId)
          .then((data) => setStops(data))
          .catch(() => undefined);
      }
    } finally {
      setDeletingStopId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="routes-page">

      {/* ── Floating add-stop panel (only visible when map is fullscreen) ── */}
      {isMapExpanded && selectedRoute !== null && (
        <div className="map-stop-overlay">
          <div className="map-stop-overlay-header">
            <span className="map-stop-overlay-route">{selectedRoute.name}</span>
            <span className="map-stop-overlay-seq">Stop #{stops.length + 1}</span>
          </div>

          {stopFormError !== null && (
            <p className="page-error map-stop-overlay-error" role="alert">{stopFormError}</p>
          )}

          <form onSubmit={handleCreateStop} noValidate className="map-stop-overlay-form">
            <input
              className="form-input"
              type="text"
              placeholder="Stop name"
              maxLength={100}
              value={stopName}
              onChange={(e) => setStopName(e.target.value)}
              disabled={isSubmittingStop}
              autoFocus
              aria-label="Stop name"
            />

            <div className={`map-stop-overlay-pin ${draftLat !== null ? 'map-stop-overlay-pin--set' : ''}`}>
              {draftLat !== null && draftLon !== null ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  <span>{draftLat.toFixed(4)}, {draftLon.toFixed(4)}</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/>
                    <line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>
                  </svg>
                  <span>Click the map to place stop</span>
                </>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary map-stop-overlay-submit"
              disabled={isSubmittingStop || draftLat === null || !stopName.trim()}
            >
              {isSubmittingStop ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="spinner spinner--sm" /> Adding
                </span>
              ) : 'Add stop'}
            </button>
          </form>
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-header-row">
        <h1 className="page-heading">Routes</h1>
        {!showRouteForm && (
          <button type="button" className="btn-primary" onClick={() => setShowRouteForm(true)}>
            Add route
          </button>
        )}
      </div>

      {loadError !== null && (
        <p className="page-error" role="alert">{loadError}</p>
      )}

      {/* ── Add Route Form ── */}
      {showRouteForm && (
        <div className="bus-form-card">
          <h2 className="bus-form-heading">New route</h2>
          {routeFormError !== null && (
            <p className="page-error" role="alert">{routeFormError}</p>
          )}
          <form onSubmit={handleCreateRoute} noValidate>
            <div className="route-form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="routeName">Route name</label>
                <input
                  id="routeName"
                  className="form-input"
                  type="text"
                  placeholder="Morning Route A"
                  maxLength={100}
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  disabled={isSubmittingRoute}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="routeDesc">
                  Description <span className="form-optional">(optional)</span>
                </label>
                <input
                  id="routeDesc"
                  className="form-input"
                  type="text"
                  placeholder="Covers sectors 12–18"
                  maxLength={500}
                  value={routeDesc}
                  onChange={(e) => setRouteDesc(e.target.value)}
                  disabled={isSubmittingRoute}
                />
              </div>
            </div>
            <div className="bus-form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmittingRoute}>
                {isSubmittingRoute ? (
                  <span className="bus-form-loading">
                    <span className="spinner spinner--sm" />
                    Adding
                  </span>
                ) : 'Add route'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowRouteForm(false); setRouteName(''); setRouteDesc(''); setRouteFormError(null); }}
                disabled={isSubmittingRoute}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Routes Table ── */}
      {isLoading ? (
        <div className="table-loading">
          <div className="spinner" aria-label="Loading routes" />
        </div>
      ) : routes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">
            No routes yet. Create your first route, then add stops to it.
          </p>
          <button type="button" className="btn-primary" onClick={() => setShowRouteForm(true)}>
            Add first route
          </button>
        </div>
      ) : (
        <div className="buses-table-wrapper">
          <table className="buses-table">
            <colgroup>
              <col style={{ width: '220px' }} />
              <col />
              <col style={{ width: '100px' }} />
              <col style={{ width: '256px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Route</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr
                  key={route.id}
                  className={selectedRouteId === route.id ? 'route-row--selected' : ''}
                >
                  <td className="route-row-name">{route.name}</td>
                  <td className="route-row-desc">{route.description ?? '—'}</td>
                  <td>
                    <span className={
                      route.isActive
                        ? 'status-badge status-badge--active'
                        : 'status-badge status-badge--inactive'
                    }>
                      {route.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="route-row-actions">
                    <button
                      type="button"
                      className={`action-btn${selectedRouteId === route.id ? ' action-btn--active' : ''}`}
                      onClick={() => handleSelectRoute(route.id)}
                    >
                      {selectedRouteId === route.id ? 'Close' : 'Manage stops'}
                    </button>
                    {route.isActive && (
                      <button
                        type="button"
                        className="btn-text-danger"
                        onClick={() => handleDeactivateRoute(route.id)}
                        disabled={deactivatingId === route.id}
                      >
                        {deactivatingId === route.id ? (
                          <span className="spinner spinner--sm" />
                        ) : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Stops Panel ── */}
      {selectedRoute !== null && (
        <div className="stops-panel">

          <div className="stops-panel-header">
            <h2 className="stops-panel-heading">Stops — {selectedRoute.name}</h2>
          </div>

          {stopsError !== null && (
            <p className="page-error" role="alert">{stopsError}</p>
          )}

          {/* ── Side-by-side: Add Stop form | Map ── */}
          <div className="stops-panel-split">

            {/* Left: form */}
            <div className="stops-form-col">
              <p className="stops-form-title">Add stop</p>

              {stopFormError !== null && (
                <p className="page-error" role="alert">{stopFormError}</p>
              )}

              <form onSubmit={handleCreateStop} noValidate className="stops-form-fields">

                <div className="form-field">
                  <label className="form-label" htmlFor="stopName">Stop name</label>
                  <input
                    id="stopName"
                    className="form-input"
                    type="text"
                    placeholder="Gate 3 – Near Community Park"
                    maxLength={100}
                    value={stopName}
                    onChange={(e) => setStopName(e.target.value)}
                    disabled={isSubmittingStop}
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="stopOffset">
                    Minutes from trip start <span className="form-optional">(optional)</span>
                  </label>
                  <input
                    id="stopOffset"
                    className="form-input"
                    type="number"
                    min={0}
                    placeholder="e.g. 10"
                    value={stopOffset}
                    onChange={(e) => setStopOffset(parseInt(e.target.value, 10) || 0)}
                    disabled={isSubmittingStop}
                  />
                </div>

                {/* Auto-sequence badge */}
                <p className="stops-seq-hint">
                  Stop #{stops.length + 1} will be added to the end of this route.
                </p>

                {/* Location display */}
                <div className="form-field">
                  <label className="form-label">Location</label>
                  {draftLat !== null && draftLon !== null ? (
                    <div className="stop-location-display stop-location-display--set">
                      <span className="stop-location-coords">
                        {draftLat.toFixed(5)},&ensp;{draftLon.toFixed(5)}
                      </span>
                      <span className="stop-location-ok">Set</span>
                    </div>
                  ) : (
                    <div className="stop-location-display">
                      Click the map to place this stop
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary stops-form-submit"
                  disabled={isSubmittingStop}
                >
                  {isSubmittingStop ? (
                    <span className="bus-form-loading">
                      <span className="spinner spinner--sm" />
                      Adding
                    </span>
                  ) : 'Add stop'}
                </button>

              </form>
            </div>

            {/* Right: map — always interactive (form is always open) */}
            <RouteMap
              apiKey={MAPS_KEY}
              stops={stops}
              draftLat={draftLat}
              draftLon={draftLon}
              onPinDrop={(lat, lon) => { setDraftLat(lat); setDraftLon(lon); }}
              onNameSuggestion={(name) => setStopName(name)}
              onExpandChange={setIsMapExpanded}
              interactive
            />

          </div>

          {/* ── Stops Table ── */}
          {stopsLoading ? (
            <div className="table-loading">
              <div className="spinner" aria-label="Loading stops" />
            </div>
          ) : stops.length === 0 ? (
            <div className="stops-empty">
              <p className="empty-state-message">
                No stops yet. Click on the map to place the first stop.
              </p>
            </div>
          ) : (
            <div className="buses-table-wrapper">
              <table className="buses-table">
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col />
                  <col style={{ width: '196px' }} />
                  <col style={{ width: '88px' }} />
                  <col style={{ width: '100px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Stop Name</th>
                    <th>Coordinates</th>
                    <th>Offset</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((stop) => (
                    <tr key={stop.id}>
                      <td className="stop-seq">{stop.sequence}</td>
                      <td className="stop-name" title={stop.name}>{stop.name}</td>
                      <td className="stop-coords">
                        {stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}
                      </td>
                      <td className="buses-table-nowrap">{stop.estimatedOffsetMinutes} min</td>
                      <td>
                        <button
                          type="button"
                          className="btn-text-danger"
                          onClick={() => handleDeleteStop(stop.id)}
                          disabled={deletingStopId === stop.id}
                        >
                          {deletingStopId === stop.id ? (
                            <span className="spinner spinner--sm" />
                          ) : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
