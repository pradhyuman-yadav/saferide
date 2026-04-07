import { useState, useEffect, useRef, type FormEvent, type ChangeEvent, Fragment } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { routeApi } from '@/api/client';
import type { Student } from '@/types/student';
import type { Bus } from '@/types/bus';
import type { Route } from '@/types/route';
import type { Stop } from '@/types/stop';
import './buses.css';
import './drivers.css';
import './students.css';

const COL_COUNT = 8;

// ── CSV helpers ───────────────────────────────────────────────────────────────

interface CsvRow {
  name:        string;
  parentName:  string;
  parentPhone: string;
  parentEmail: string;
}

/** Parse a single CSV line into fields, supporting quoted values. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++; // skip opening quote
      let field = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end < 0) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

interface ParseResult {
  rows:   CsvRow[];
  errors: string[];
}

function parseCsv(text: string): ParseResult {
  // Destructure to avoid noUncheckedIndexedAccess issues on lines[0] / lines[i]
  const [headerLine, ...dataLines] = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');

  if (!headerLine || dataLines.length === 0) {
    return { rows: [], errors: ['CSV must have a header row and at least one data row.'] };
  }

  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const col = {
    name:        headers.indexOf('name'),
    parentName:  headers.indexOf('parentname'),
    parentPhone: headers.indexOf('parentphone'),
    parentEmail: headers.indexOf('parentemail'),
  };

  const missingCols: string[] = [];
  if (col.name < 0)        missingCols.push('name');
  if (col.parentName < 0)  missingCols.push('parentName');
  if (col.parentPhone < 0) missingCols.push('parentPhone');
  if (col.parentEmail < 0) missingCols.push('parentEmail');
  if (missingCols.length > 0) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingCols.join(', ')}. Expected header: name,parentName,parentPhone,parentEmail`],
    };
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  dataLines.forEach((line, idx) => {
    const fields = parseCsvLine(line);
    const row: CsvRow = {
      name:        (fields[col.name] ?? '').trim(),
      parentName:  (fields[col.parentName] ?? '').trim(),
      parentPhone: (fields[col.parentPhone] ?? '').trim(),
      parentEmail: (fields[col.parentEmail] ?? '').trim(),
    };
    const missingFields: string[] = [];
    if (!row.name)        missingFields.push('name');
    if (!row.parentName)  missingFields.push('parentName');
    if (!row.parentPhone) missingFields.push('parentPhone');
    if (!row.parentEmail) missingFields.push('parentEmail');
    if (missingFields.length > 0) {
      errors.push(`Row ${idx + 1}: missing ${missingFields.join(', ')}`);
    } else {
      rows.push(row);
    }
  });

  return { rows, errors };
}

const CSV_TEMPLATE = 'name,parentName,parentPhone,parentEmail\nArjun Sharma,Priya Sharma,9876543210,priya@example.com';
const CSV_TEMPLATE_URL = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;

// ── Component ─────────────────────────────────────────────────────────────────

export function StudentsPage() {
  usePageTitle('Students');

  // ── Data ────────────────────────────────────────────────────────────────
  const [students,  setStudents]  = useState<Student[]>([]);
  const [buses,     setBuses]     = useState<Bus[]>([]);
  const [routes,    setRoutes]    = useState<Route[]>([]);
  const [allStops,  setAllStops]  = useState<Stop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Add student form ─────────────────────────────────────────────────────
  const [showForm,     setShowForm]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const [name,         setName]         = useState('');
  const [parentName,   setParentName]   = useState('');
  const [parentPhone,  setParentPhone]  = useState('');
  const [parentEmail,  setParentEmail]  = useState('');

  // ── CSV import ───────────────────────────────────────────────────────────
  const csvFileRef = useRef<HTMLInputElement>(null);
  const [csvRows,      setCsvRows]   = useState<CsvRow[] | null>(null);
  const [csvErrors,    setCsvErrors] = useState<string[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress,  setCsvProgress] = useState(0);
  const [csvDone,      setCsvDone]   = useState<{ ok: number; failed: number } | null>(null);

  // ── Deactivate ───────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Stop assignment ──────────────────────────────────────────────────────
  const [assigningStopFor, setAssigningStopFor] = useState<string | null>(null);
  const [assignRouteId,    setAssignRouteId]    = useState('');
  const [assignStopId,     setAssignStopId]     = useState('');
  const [stopsForPicker,   setStopsForPicker]   = useState<Stop[]>([]);
  const [loadingStops,     setLoadingStops]     = useState(false);
  const [isAssigning,      setIsAssigning]      = useState(false);

  // Cache per-route stops so we only fetch once per route per page load
  const stopsCacheRef = useRef<Record<string, Stop[]>>({});

  // ── Load initial data ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([routeApi.listStudents(), routeApi.listBuses(), routeApi.listRoutes()])
      .then(async ([s, b, r]) => {
        if (cancelled) return;
        setStudents(s);
        setBuses(b);
        setRoutes(r);
        // Pre-load stops for all active routes so the table can resolve names immediately
        const activeRoutes = r.filter((rt) => rt.isActive);
        const stopsArrays = await Promise.all(activeRoutes.map((rt) => routeApi.listStops(rt.id)));
        if (cancelled) return;
        const flat = stopsArrays.flat();
        setAllStops(flat);
        // Seed the cache too so the picker doesn't re-fetch
        activeRoutes.forEach((rt, i) => { stopsCacheRef.current[rt.id] = stopsArrays[i] ?? []; });
      })
      .catch(() => { if (!cancelled) setLoadError('Could not load data. Please refresh.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Load stops for the selected route in the stop picker ─────────────────
  useEffect(() => {
    if (!assignRouteId) { setStopsForPicker([]); return; }
    if (stopsCacheRef.current[assignRouteId]) {
      setStopsForPicker(stopsCacheRef.current[assignRouteId]);
      return;
    }
    setLoadingStops(true);
    routeApi.listStops(assignRouteId)
      .then((stops) => {
        stopsCacheRef.current[assignRouteId] = stops;
        setStopsForPicker(stops);
      })
      .catch(() => setLoadError('Could not load stops. Please try again.'))
      .finally(() => setLoadingStops(false));
  }, [assignRouteId]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function cancelAssign() {
    setAssigningStopFor(null);
    setAssignRouteId('');
    setAssignStopId('');
    setStopsForPicker([]);
  }

  function resetForm() {
    setName(''); setParentName(''); setParentPhone(''); setParentEmail('');
    setFormError(null);
  }

  function stopName(stopId: string | null): string {
    if (!stopId) return '';
    const stop = allStops.find((s) => s.id === stopId);
    return stop ? stop.name : stopId;
  }

  function routeNameForStop(stopId: string | null): string {
    if (!stopId) return '';
    const stop = allStops.find((s) => s.id === stopId);
    if (!stop) return '';
    const route = routes.find((r) => r.id === stop.routeId);
    return route ? route.name : '';
  }

  function busLabel(busId: string | null): string {
    if (!busId) return '';
    const bus = buses.find((b) => b.id === busId);
    return bus ? `${bus.registrationNumber} — ${bus.make} ${bus.model}` : busId;
  }

  // ── CSV import handlers ───────────────────────────────────────────────────

  function clearCsv() {
    setCsvRows(null);
    setCsvErrors([]);
    setCsvProgress(0);
    setCsvDone(null);
    setCsvImporting(false);
    if (csvFileRef.current) csvFileRef.current.value = '';
  }

  function handleCsvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvDone(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCsv(text);
      setCsvRows(rows);
      setCsvErrors(errors);
      setCsvProgress(0);
    };
    reader.readAsText(file);
  }

  async function handleCsvImport() {
    if (!csvRows || csvRows.length === 0) return;
    setCsvImporting(true);
    setCsvProgress(0);

    let ok = 0;
    let failed = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < csvRows.length; i += CONCURRENCY) {
      const chunk = csvRows.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (row) => {
          try {
            const created = await routeApi.createStudent(row);
            setStudents((prev) => [created, ...prev]);
            ok++;
          } catch {
            failed++;
          }
          setCsvProgress((p) => p + 1);
        }),
      );
    }

    setCsvImporting(false);
    setCsvDone({ ok, failed });
    setCsvRows(null);
    if (csvFileRef.current) csvFileRef.current.value = '';
  }

  // ── Form handlers ─────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !parentName.trim() || !parentPhone.trim() || !parentEmail.trim()) {
      setFormError('All fields are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await routeApi.createStudent({
        name: name.trim(), parentName: parentName.trim(),
        parentPhone: parentPhone.trim(), parentEmail: parentEmail.trim(),
      });
      setStudents((prev) => [created, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add student. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openStopAssign(student: Student) {
    cancelAssign();
    setAssigningStopFor(student.id);
    if (student.stopId) {
      const stop = allStops.find((s) => s.id === student.stopId);
      if (stop) {
        setAssignRouteId(stop.routeId); // triggers useEffect → loads stops
        setAssignStopId(student.stopId);
      }
    }
  }

  async function handleAssignStop(studentId: string) {
    if (!assignStopId) return;
    setIsAssigning(true);
    try {
      const updated = await routeApi.updateStudent(studentId, { stopId: assignStopId });
      setStudents((prev) => prev.map((s) => (s.id === studentId ? updated : s)));
      // Keep allStops in sync (stop is already known; just close panel)
      cancelAssign();
    } catch {
      setLoadError('Could not assign stop. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRemoveStop(studentId: string) {
    setIsAssigning(true);
    try {
      const updated = await routeApi.updateStudent(studentId, { stopId: null });
      setStudents((prev) => prev.map((s) => (s.id === studentId ? updated : s)));
      cancelAssign();
    } catch {
      setLoadError('Could not remove stop assignment. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm('Deactivate this student? They will no longer appear as active.')) return;
    setDeletingId(id);
    try {
      await routeApi.deleteStudent(id);
      setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: false } : s)));
    } catch {
      setLoadError('Could not deactivate student. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="buses-page">

      {/* Header */}
      <div className="page-header-row">
        <h1 className="page-heading">Students</h1>
        <div className="csv-header-actions">
          {/* Hidden file input — triggered by the Import CSV button */}
          <input
            ref={csvFileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleCsvFileChange}
          />
          {!showForm && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => csvFileRef.current?.click()}
              disabled={csvImporting}
            >
              Import CSV
            </button>
          )}
          {!showForm && (
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              Add student
            </button>
          )}
        </div>
      </div>

      {loadError !== null && <p className="page-error" role="alert">{loadError}</p>}

      {/* ── CSV import result banner ──────────────────────────────────────── */}
      {csvDone !== null && (
        <div className={`csv-result-banner ${csvDone.failed > 0 ? 'csv-result-banner--partial' : 'csv-result-banner--ok'}`}>
          <span>
            {csvDone.ok > 0 && `${csvDone.ok} student${csvDone.ok !== 1 ? 's' : ''} imported.`}
            {csvDone.failed > 0 && ` ${csvDone.failed} failed (already exists or invalid email).`}
          </span>
          <button type="button" className="csv-dismiss" onClick={() => setCsvDone(null)}>Dismiss</button>
        </div>
      )}

      {/* ── CSV preview card ──────────────────────────────────────────────── */}
      {csvRows !== null && (
        <div className="bus-form-card csv-preview-card">
          <div className="csv-preview-header">
            <h2 className="bus-form-heading" style={{ marginBottom: 0 }}>Import students</h2>
            <a className="btn-text csv-template-link" href={CSV_TEMPLATE_URL} download="students_template.csv">
              Download template
            </a>
          </div>

          {csvErrors.length > 0 && (
            <div className="csv-errors">
              <p className="csv-errors-title">
                {csvErrors.length} row{csvErrors.length !== 1 ? 's' : ''} with errors — these will be skipped:
              </p>
              <ul className="csv-errors-list">
                {csvErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                {csvErrors.length > 5 && <li>…and {csvErrors.length - 5} more</li>}
              </ul>
            </div>
          )}

          {csvRows.length > 0 ? (
            <>
              <p className="csv-preview-count">
                <strong>{csvRows.length}</strong> student{csvRows.length !== 1 ? 's' : ''} ready to import
              </p>

              {csvImporting && (
                <div className="csv-progress">
                  <div
                    className="csv-progress-bar"
                    style={{ width: `${Math.round((csvProgress / csvRows.length) * 100)}%` }}
                  />
                  <span className="csv-progress-label">{csvProgress} / {csvRows.length}</span>
                </div>
              )}

              <div className="bus-form-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => { void handleCsvImport(); }}
                  disabled={csvImporting}
                >
                  {csvImporting
                    ? <span className="bus-form-loading"><span className="spinner spinner--sm" />Importing</span>
                    : `Import ${csvRows.length} student${csvRows.length !== 1 ? 's' : ''}`}
                </button>
                <button type="button" className="btn-ghost" onClick={clearCsv} disabled={csvImporting}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="csv-no-valid-rows">
              <p>No valid rows found. Check the errors above and re-upload.</p>
              <div className="bus-form-actions">
                <button type="button" className="btn-ghost" onClick={clearCsv}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add Student Form ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="bus-form-card">
          <h2 className="bus-form-heading">New student</h2>
          <p className="driver-form-hint">
            Enter the parent's email address. They will receive an email to set up their
            password and sign in to the SafeRide parent app.
          </p>
          {formError !== null && <p className="page-error" role="alert">{formError}</p>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="bus-form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="studentName">Student full name</label>
                <input id="studentName" className="form-input" type="text" placeholder="Arjun Sharma"
                  maxLength={100} value={name} onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="parentName">Parent / guardian name</label>
                <input id="parentName" className="form-input" type="text" placeholder="Priya Sharma"
                  maxLength={100} value={parentName} onChange={(e) => setParentName(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="parentPhone">Parent phone</label>
                <input id="parentPhone" className="form-input" type="tel" placeholder="9876543210"
                  maxLength={20} value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="parentEmail">Parent email</label>
                <input id="parentEmail" className="form-input" type="email" placeholder="priya@example.com"
                  maxLength={254} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)}
                  disabled={isSubmitting} required />
              </div>
            </div>
            <div className="bus-form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting
                  ? <span className="bus-form-loading"><span className="spinner spinner--sm" />Adding</span>
                  : 'Add student'}
              </button>
              <button type="button" className="btn-ghost"
                onClick={() => { setShowForm(false); resetForm(); }} disabled={isSubmitting}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Student Table ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="table-loading"><div className="spinner" aria-label="Loading" /></div>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-message">No students yet.</p>
          <div className="empty-state-actions">
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              Add first student
            </button>
            <button type="button" className="btn-ghost" onClick={() => csvFileRef.current?.click()}>
              Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="buses-table-wrapper">
          <table className="buses-table">
            <colgroup>
              <col style={{ width: '160px' }} />  {/* Student */}
              <col style={{ width: '140px' }} />  {/* Parent */}
              <col style={{ width: '124px' }} />  {/* Phone */}
              <col style={{ width: '180px' }} />  {/* Email */}
              <col />                              {/* Stop / Route — flex */}
              <col style={{ width: '180px' }} />  {/* Bus */}
              <col style={{ width: '100px' }} />  {/* Status */}
              <col style={{ width: '240px' }} />  {/* Actions */}
            </colgroup>
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Stop / Route</th>
                <th>Bus assigned</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <Fragment key={student.id}>

                  {/* ── Student row ──────────────────────────────────────── */}
                  <tr>
                    <td className="driver-name">{student.name}</td>
                    <td className="student-parent-name">{student.parentName}</td>
                    <td className="buses-table-reg buses-table-nowrap">{student.parentPhone}</td>
                    <td className="student-email" title={student.parentEmail}>{student.parentEmail}</td>

                    {/* Stop / Route */}
                    <td title={student.stopId !== null
                      ? `${stopName(student.stopId)} · ${routeNameForStop(student.stopId)}`
                      : undefined}>
                      {student.stopId !== null ? (
                        <span className="student-stop-info">
                          <span className="student-stop-name">{stopName(student.stopId)}</span>
                          <span className="student-route-name">{routeNameForStop(student.stopId)}</span>
                        </span>
                      ) : (
                        <span className="driver-bus-none">No stop</span>
                      )}
                    </td>

                    {/* Bus */}
                    <td title={student.busId !== null ? busLabel(student.busId) : undefined}>
                      {student.busId !== null ? (
                        <span className="driver-bus-assigned">{busLabel(student.busId)}</span>
                      ) : (
                        <span className="driver-bus-none">Unassigned</span>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <span className={student.isActive
                        ? 'status-badge status-badge--active'
                        : 'status-badge status-badge--inactive'}>
                        {student.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="route-row-actions">
                      {student.isActive && (
                        <>
                          <button type="button" className="btn-text"
                            onClick={() => openStopAssign(student)}>
                            {student.stopId ? 'Change stop' : 'Assign stop'}
                          </button>
                          <button type="button" className="btn-text-danger"
                            onClick={() => { void handleDeactivate(student.id); }}
                            disabled={deletingId === student.id}>
                            {deletingId === student.id
                              ? <span className="spinner spinner--sm" />
                              : 'Deactivate'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {/* ── Stop assignment panel ─────────────────────────────── */}
                  {assigningStopFor === student.id && (
                    <tr className="student-assign-row">
                      <td colSpan={COL_COUNT} className="student-assign-cell">
                        <div className="student-assign-panel">
                          <span className="student-assign-label">Assign to stop</span>
                          <select
                            className="form-input student-assign-select"
                            value={assignRouteId}
                            onChange={(e) => { setAssignRouteId(e.target.value); setAssignStopId(''); }}
                          >
                            <option value="">Select route</option>
                            {routes.filter((r) => r.isActive).map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <select
                            className="form-input student-assign-select"
                            value={assignStopId}
                            onChange={(e) => setAssignStopId(e.target.value)}
                            disabled={!assignRouteId || loadingStops}
                          >
                            <option value="">{loadingStops ? 'Loading…' : 'Select stop'}</option>
                            {stopsForPicker
                              .slice()
                              .sort((a, b) => a.sequence - b.sequence)
                              .map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                          </select>
                          <button type="button" className="btn-primary"
                            onClick={() => { void handleAssignStop(student.id); }}
                            disabled={!assignStopId || isAssigning}>
                            {isAssigning ? <span className="spinner spinner--sm" /> : 'Assign'}
                          </button>
                          {student.stopId && (
                            <button type="button" className="btn-text-danger"
                              onClick={() => { void handleRemoveStop(student.id); }}
                              disabled={isAssigning}>
                              Remove
                            </button>
                          )}
                          <button type="button" className="btn-ghost"
                            onClick={cancelAssign} disabled={isAssigning}>
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
