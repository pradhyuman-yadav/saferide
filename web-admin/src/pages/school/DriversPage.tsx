import { useState, useEffect, type FormEvent } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { routeApi } from '@/api/client';
import type { Driver } from '@/types/driver';
import type { Bus } from '@/types/bus';
import './buses.css';
import './drivers.css';

export function DriversPage() {
  usePageTitle('Drivers');

  const [drivers,      setDrivers]      = useState<Driver[]>([]);
  const [buses,        setBuses]        = useState<Bus[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  // Form fields
  const [email,         setEmail]         = useState('');
  const [name,          setName]          = useState('');
  const [phone,         setPhone]         = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([routeApi.listDrivers(), routeApi.listBuses()])
      .then(([d, b]) => {
        if (!cancelled) {
          setDrivers(d);
          setBuses(b);
        }
      })
      .catch(() => { if (!cancelled) setLoadError('Could not load data. Please refresh.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function resetForm() {
    setEmail(''); setName(''); setPhone(''); setLicenseNumber('');
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!email.trim() || !name.trim() || !phone.trim() || !licenseNumber.trim()) {
      setFormError('All fields are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newDriver = await routeApi.createDriver({
        email:         email.trim(),
        name:          name.trim(),
        phone:         phone.trim(),
        licenseNumber: licenseNumber.trim(),
      });
      setDrivers((prev) => [newDriver, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add driver. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm('Deactivate this driver? They will no longer be assignable to buses.')) return;
    setDeletingId(id);
    try {
      await routeApi.deleteDriver(id);
      setDrivers((prev) => prev.map((d) => d.id === id ? { ...d, isActive: false } : d));
    } catch {
      setLoadError('Could not deactivate driver. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  function busLabel(busId: string | null): string {
    if (busId === null) return '';
    const bus = buses.find((b) => b.id === busId);
    return bus ? `${bus.registrationNumber} — ${bus.make} ${bus.model}` : busId;
  }

  return (
    <div className="buses-page">

      {/* Header */}
      <div className="page-header-row">
        <h1 className="page-heading">Drivers</h1>
        {!showForm && (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Add driver
          </button>
        )}
      </div>

      {loadError !== null && <p className="page-error" role="alert">{loadError}</p>}

      {/* Add Driver Form */}
      {showForm && (
        <div className="bus-form-card">
          <h2 className="bus-form-heading">New driver</h2>
          <p className="driver-form-hint">
            Enter the driver's email address. They will receive an email to set up their
            password and can then sign in to the SafeRide driver app.
          </p>
          {formError !== null && <p className="page-error" role="alert">{formError}</p>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="bus-form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="driverName">Full name</label>
                <input id="driverName" className="form-input" type="text" placeholder="Raju Kumar"
                  maxLength={100} value={name} onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="driverEmail">Email address</label>
                <input id="driverEmail" className="form-input" type="email" placeholder="raju@example.com"
                  maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="driverPhone">Phone</label>
                <input id="driverPhone" className="form-input" type="tel" placeholder="9876543210"
                  maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="driverLicense">License number</label>
                <input id="driverLicense" className="form-input" type="text" placeholder="KA0120230001234"
                  maxLength={30} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
            </div>
            <div className="bus-form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting
                  ? <span className="bus-form-loading"><span className="spinner spinner--sm" />Adding</span>
                  : 'Add driver'}
              </button>
              <button type="button" className="btn-ghost"
                onClick={() => { setShowForm(false); resetForm(); }} disabled={isSubmitting}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Driver List */}
      {isLoading ? (
        <div className="table-loading"><div className="spinner" aria-label="Loading" /></div>
      ) : drivers.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No drivers yet.</p>
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>Add first driver</button>
        </div>
      ) : (
        <div className="buses-table-wrapper">
          <table className="buses-table">
            <colgroup>
              <col style={{ width: '180px' }} />  {/* Name */}
              <col style={{ width: '200px' }} />  {/* Email */}
              <col style={{ width: '140px' }} />  {/* Phone */}
              <col style={{ width: '160px' }} />  {/* License */}
              <col />                              {/* Bus assigned — flex */}
              <col style={{ width: '100px' }} />  {/* Status */}
              <col style={{ width: '140px' }} />  {/* Actions */}
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>License</th>
                <th>Bus assigned</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="driver-name">{driver.name}</td>
                  <td className="driver-email" title={driver.email}>{driver.email}</td>
                  <td className="buses-table-reg">{driver.phone}</td>
                  <td className="buses-table-reg">{driver.licenseNumber}</td>
                  <td title={driver.busId !== null ? busLabel(driver.busId) : undefined}>
                    {driver.busId !== null ? (
                      <span className="driver-bus-assigned">{busLabel(driver.busId)}</span>
                    ) : (
                      <span className="driver-bus-none">Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span className={driver.isActive
                      ? 'status-badge status-badge--active'
                      : 'status-badge status-badge--inactive'}>
                      {driver.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="route-row-actions">
                    {driver.isActive && (
                      <button
                        type="button"
                        className="btn-text-danger"
                        onClick={() => handleDeactivate(driver.id)}
                        disabled={deletingId === driver.id}
                      >
                        {deletingId === driver.id ? <span className="spinner spinner--sm" /> : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
