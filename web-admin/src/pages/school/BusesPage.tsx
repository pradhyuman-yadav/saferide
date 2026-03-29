import { Fragment, useState, useEffect, type FormEvent } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { routeApi } from '@/api/client';
import type { Bus } from '@/types/bus';
import type { Driver } from '@/types/driver';
import type { Route } from '@/types/route';
import './buses.css';
import './drivers.css';

const CURRENT_YEAR = new Date().getFullYear();

function statusBadgeClass(status: Bus['status']): string {
  switch (status) {
    case 'active':      return 'status-badge status-badge--active';
    case 'inactive':    return 'status-badge status-badge--inactive';
    case 'maintenance': return 'status-badge status-badge--maintenance';
  }
}

type AssignPanel = 'driver' | 'route' | null;

export function BusesPage() {
  usePageTitle('Buses');

  const [buses,        setBuses]        = useState<Bus[]>([]);
  const [drivers,      setDrivers]      = useState<Driver[]>([]);
  const [routes,       setRoutes]       = useState<Route[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  // Assignment panel state
  const [assigningBusId,  setAssigningBusId]  = useState<string | null>(null);
  const [assignPanel,     setAssignPanel]     = useState<AssignPanel>(null);
  const [selectedId,      setSelectedId]      = useState<string>('');
  const [isAssigning,     setIsAssigning]     = useState(false);
  const [assignError,     setAssignError]     = useState<string | null>(null);

  // ── Form fields ───────────────────────────────────────────────────────────
  const [regNumber, setRegNumber] = useState('');
  const [make,      setMake]      = useState('');
  const [model,     setModel]     = useState('');
  const [year,      setYear]      = useState<number>(CURRENT_YEAR);
  const [capacity,  setCapacity]  = useState<number>(40);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([routeApi.listBuses(), routeApi.listDrivers(), routeApi.listRoutes()])
      .then(([b, d, r]) => {
        if (!cancelled) {
          setBuses(b);
          setDrivers(d.filter((dr) => dr.isActive));
          setRoutes(r.filter((ro) => ro.isActive));
        }
      })
      .catch(() => { if (!cancelled) setLoadError('Could not load data. Please refresh.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function resetForm() {
    setRegNumber(''); setMake(''); setModel('');
    setYear(CURRENT_YEAR); setCapacity(40); setFormError(null);
  }

  function closeAssign() {
    setAssigningBusId(null); setAssignPanel(null);
    setSelectedId(''); setAssignError(null);
  }

  function openAssign(bus: Bus, panel: AssignPanel) {
    if (assigningBusId === bus.id && assignPanel === panel) { closeAssign(); return; }
    setAssigningBusId(bus.id);
    setAssignPanel(panel);
    setSelectedId(panel === 'driver' ? (bus.driverId ?? '') : (bus.routeId ?? ''));
    setAssignError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!regNumber.trim() || !make.trim() || !model.trim()) {
      setFormError('Registration number, make, and model are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newBus = await routeApi.createBus({
        registrationNumber: regNumber.trim(),
        make:               make.trim(),
        model:              model.trim(),
        year,
        capacity,
      });
      setBuses((prev) => [newBus, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add bus. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm('Deactivate this bus? It will no longer appear as available.')) return;
    setDeletingId(id);
    try {
      await routeApi.deleteBus(id);
      setBuses((prev) => prev.map((b) => b.id === id ? { ...b, status: 'inactive' as const } : b));
    } catch {
      setLoadError('Could not deactivate bus. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAssignDriver(busId: string) {
    setIsAssigning(true); setAssignError(null);
    try {
      const driverId = selectedId !== '' ? selectedId : null;
      const updated  = await routeApi.assignBusDriver(busId, driverId);
      setBuses((prev) => prev.map((b) => b.id === busId ? updated : b));
      closeAssign();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign driver. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleAssignRoute(busId: string) {
    setIsAssigning(true); setAssignError(null);
    try {
      const routeId = selectedId !== '' ? selectedId : null;
      const updated  = await routeApi.assignBusRoute(busId, routeId);
      setBuses((prev) => prev.map((b) => b.id === busId ? updated : b));
      closeAssign();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign route. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  }

  function driverLabel(driverId: string | null): string {
    if (driverId === null) return 'Unassigned';
    const d = drivers.find((dr) => dr.id === driverId);
    return d ? `${d.name} · ${d.phone}` : driverId;
  }

  function routeLabel(routeId: string | null): string {
    if (routeId === null) return 'Unassigned';
    const r = routes.find((ro) => ro.id === routeId);
    return r ? r.name : routeId;
  }

  return (
    <div className="buses-page">

      {/* ── Header ── */}
      <div className="page-header-row">
        <h1 className="page-heading">Buses</h1>
        {!showForm && (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Add bus
          </button>
        )}
      </div>

      {loadError !== null && <p className="page-error" role="alert">{loadError}</p>}

      {/* ── Add Bus Form ── */}
      {showForm && (
        <div className="bus-form-card">
          <h2 className="bus-form-heading">New bus</h2>
          {formError !== null && <p className="page-error" role="alert">{formError}</p>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="bus-form-grid">

              <div className="form-field">
                <label className="form-label" htmlFor="busRegNumber">Registration number</label>
                <input id="busRegNumber" className="form-input" type="text" placeholder="KA 01 AB 1234"
                  maxLength={20} value={regNumber} onChange={(e) => setRegNumber(e.target.value)}
                  disabled={isSubmitting} required />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="busMake">Make</label>
                <input id="busMake" className="form-input" type="text" placeholder="Tata"
                  maxLength={50} value={make} onChange={(e) => setMake(e.target.value)}
                  disabled={isSubmitting} required />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="busModel">Model</label>
                <input id="busModel" className="form-input" type="text" placeholder="Starbus"
                  maxLength={50} value={model} onChange={(e) => setModel(e.target.value)}
                  disabled={isSubmitting} required />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="busYear">Year</label>
                <input id="busYear" className="form-input" type="number" min={1990} max={2100}
                  value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || CURRENT_YEAR)}
                  disabled={isSubmitting} />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="busCapacity">Seating capacity</label>
                <input id="busCapacity" className="form-input" type="number" min={1} max={100}
                  value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
                  disabled={isSubmitting} />
              </div>

            </div>

            <div className="bus-form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting
                  ? <span className="bus-form-loading"><span className="spinner spinner--sm" />Adding</span>
                  : 'Add bus'}
              </button>
              <button type="button" className="btn-ghost"
                onClick={() => { setShowForm(false); resetForm(); }} disabled={isSubmitting}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bus List ── */}
      {isLoading ? (
        <div className="table-loading"><div className="spinner" aria-label="Loading buses" /></div>
      ) : buses.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No buses yet. Add your first bus to get started.</p>
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Add first bus
          </button>
        </div>
      ) : (
        <div className="buses-table-wrapper">
          <table className="buses-table">
            <colgroup>
              <col style={{ width: '148px' }} />  {/* Registration */}
              <col />                              {/* Make & Model — flex, shows more on wide screens */}
              <col style={{ width: '80px' }} />   {/* Year */}
              <col style={{ width: '96px' }} />   {/* Capacity */}
              <col style={{ width: '180px' }} />  {/* Driver */}
              <col style={{ width: '180px' }} />  {/* Route */}
              <col style={{ width: '112px' }} />  {/* Status */}
              <col style={{ width: '392px' }} />  {/* Actions */}
            </colgroup>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Make &amp; Model</th>
                <th>Year</th>
                <th>Capacity</th>
                <th>Driver</th>
                <th>Route</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <Fragment key={bus.id}>
                  <tr>
                    <td className="buses-table-reg">{bus.registrationNumber}</td>
                    <td className="buses-table-make" title={`${bus.make} ${bus.model}`}>{bus.make} {bus.model}</td>
                    <td className="buses-table-nowrap">{bus.year}</td>
                    <td className="buses-table-nowrap">{bus.capacity}</td>
                    <td className="buses-table-nowrap" title={bus.driverId !== null ? driverLabel(bus.driverId) : undefined}>
                      {bus.driverId !== null
                        ? <span className="driver-bus-assigned">{driverLabel(bus.driverId)}</span>
                        : <span className="driver-bus-none">Unassigned</span>}
                    </td>
                    <td className="buses-table-nowrap" title={bus.routeId !== null ? routeLabel(bus.routeId) : undefined}>
                      {bus.routeId !== null
                        ? <span className="driver-bus-assigned">{routeLabel(bus.routeId)}</span>
                        : <span className="driver-bus-none">Unassigned</span>}
                    </td>
                    <td className="buses-table-nowrap">
                      <span className={statusBadgeClass(bus.status)}>{bus.status}</span>
                    </td>
                    <td className="route-row-actions">
                      {bus.status === 'active' && (
                        <>
                          <button
                            type="button"
                            className={`action-btn${assigningBusId === bus.id && assignPanel === 'driver' ? ' action-btn--active' : ''}`}
                            onClick={() => openAssign(bus, 'driver')}
                          >
                            {bus.driverId !== null ? 'Change driver' : 'Assign driver'}
                          </button>
                          <button
                            type="button"
                            className={`action-btn${assigningBusId === bus.id && assignPanel === 'route' ? ' action-btn--active' : ''}`}
                            onClick={() => openAssign(bus, 'route')}
                          >
                            {bus.routeId !== null ? 'Change route' : 'Assign route'}
                          </button>
                          <button
                            type="button"
                            className="btn-text-danger"
                            onClick={() => handleDeactivate(bus.id)}
                            disabled={deletingId === bus.id}
                          >
                            {deletingId === bus.id ? <span className="spinner spinner--sm" /> : 'Deactivate'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {/* Inline assignment panel */}
                  {assigningBusId === bus.id && assignPanel !== null && (
                    <tr className="driver-assign-row">
                      <td colSpan={8}>
                        <div className="driver-assign-panel">
                          <span className="driver-assign-label">
                            {assignPanel === 'driver' ? `Assign driver to ${bus.registrationNumber}` : `Assign route to ${bus.registrationNumber}`}
                          </span>
                          {assignError !== null && (
                            <span className="driver-assign-error">{assignError}</span>
                          )}
                          <select
                            className="form-input driver-assign-select"
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            disabled={isAssigning}
                          >
                            <option value="">— Unassign —</option>
                            {assignPanel === 'driver'
                              ? drivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} · {d.phone}
                                  </option>
                                ))
                              : routes.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))
                            }
                          </select>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => assignPanel === 'driver' ? handleAssignDriver(bus.id) : handleAssignRoute(bus.id)}
                            disabled={isAssigning}
                          >
                            {isAssigning
                              ? <span className="bus-form-loading"><span className="spinner spinner--sm" />Saving</span>
                              : 'Save'}
                          </button>
                          <button type="button" className="btn-ghost" onClick={closeAssign} disabled={isAssigning}>
                            Cancel
                          </button>
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
