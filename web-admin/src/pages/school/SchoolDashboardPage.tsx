import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';
import { routeApi } from '@/api/client';
import type { Bus } from '@/types/bus';
import type { Route } from '@/types/route';
import type { Driver } from '@/types/driver';
import type { Student } from '@/types/student';
import './school-dashboard.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function SchoolDashboardPage() {
  usePageTitle('Dashboard');

  const profile = useAuthStore((s) => s.profile);

  const [buses,     setBuses]     = useState<Bus[]>([]);
  const [routes,    setRoutes]    = useState<Route[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.allSettled([
      routeApi.listBuses(),
      routeApi.listRoutes(),
      routeApi.listDrivers(),
      routeApi.listStudents(),
    ]).then(([busRes, routeRes, driverRes, studentRes]) => {
      if (cancelled) return;

      if (busRes.status    === 'fulfilled') setBuses(busRes.value);
      if (routeRes.status  === 'fulfilled') setRoutes(routeRes.value);
      if (driverRes.status === 'fulfilled') setDrivers(driverRes.value);
      if (studentRes.status === 'fulfilled') setStudents(studentRes.value);

      // Surface the first error (all share the same root cause in practice)
      const firstFail = [busRes, routeRes, driverRes, studentRes]
        .find((r): r is PromiseRejectedResult => r.status === 'rejected');

      if (firstFail) {
        const err = firstFail.reason as Error;
        setLoadError(err.message ?? 'Could not load dashboard data. Please refresh.');
      }

      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeBuses    = buses.filter((b) => b.status === 'active');
  const activeRoutes   = routes.filter((r) => r.isActive);
  const activeDrivers  = drivers.filter((d) => d.isActive);
  const activeStudents = students.filter((s) => s.isActive);

  const busesNoDriver  = activeBuses.filter((b) => b.driverId === null);
  const busesNoRoute   = activeBuses.filter((b) => b.routeId === null);
  const studentsNoStop = activeStudents.filter((s) => s.stopId === null);
  const alertCount     = busesNoDriver.length + busesNoRoute.length + studentsNoStop.length;

  function driverName(driverId: string | null): string {
    if (!driverId) return '';
    return drivers.find((d) => d.id === driverId)?.name ?? driverId;
  }
  function routeName(routeId: string | null): string {
    if (!routeId) return '';
    return routes.find((r) => r.id === routeId)?.name ?? routeId;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="school-dashboard-page">

      {/* ── Welcome ──────────────────────────────────────────────────────── */}
      <div className="dashboard-welcome">
        <h1 className="dashboard-welcome-heading">
          {greeting()}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}.
        </h1>
        {profile?.tenantName && (
          <p className="dashboard-welcome-school">{profile.tenantName}</p>
        )}
      </div>

      {loadError !== null && <p className="page-error" role="alert">{loadError}</p>}

      {isLoading ? (
        <div className="table-loading"><div className="spinner" aria-label="Loading" /></div>
      ) : (
        <>
          {/* ── Stat cards ───────────────────────────────────────────────── */}
          <div className="dashboard-stats-grid">
            <StatCard label="Buses"    value={activeBuses.length}    total={buses.length}   href="/school/buses" />
            <StatCard label="Routes"   value={activeRoutes.length}   href="/school/routes" />
            <StatCard label="Drivers"  value={activeDrivers.length}  href="/school/drivers" />
            <StatCard label="Students" value={activeStudents.length} href="/school/students" />
          </div>

          {/* ── Main grid ────────────────────────────────────────────────── */}
          <div className="dashboard-main-grid">

            {/* Fleet overview */}
            <section className="dashboard-card">
              <div className="dashboard-card-header">
                <h2 className="dashboard-card-heading">Fleet</h2>
                <Link to="/school/buses" className="dashboard-card-link">Manage buses</Link>
              </div>

              {activeBuses.length === 0 ? (
                <p className="dashboard-empty-msg">No buses registered yet.</p>
              ) : (
                <table className="dashboard-fleet-table">
                  <thead>
                    <tr>
                      <th>Bus</th>
                      <th>Driver</th>
                      <th>Route</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBuses.map((bus) => (
                      <tr key={bus.id}>
                        <td>
                          <span className="fleet-bus-reg">{bus.registrationNumber}</span>
                          <span className="fleet-bus-model">{bus.make} {bus.model}</span>
                        </td>
                        <td>
                          {bus.driverId !== null ? (
                            <span className="fleet-cell-value">{driverName(bus.driverId)}</span>
                          ) : (
                            <span className="fleet-cell-missing">No driver</span>
                          )}
                        </td>
                        <td>
                          {bus.routeId !== null ? (
                            <span className="fleet-cell-value">{routeName(bus.routeId)}</span>
                          ) : (
                            <span className="fleet-cell-missing">No route</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Needs attention */}
            <section className="dashboard-card">
              <h2 className="dashboard-card-heading">Needs attention</h2>

              {alertCount === 0 ? (
                <p className="dashboard-all-clear">Fleet is fully configured.</p>
              ) : (
                <ul className="dashboard-alert-list">
                  {busesNoDriver.length > 0 && (
                    <li className="dashboard-alert-item">
                      <span className="dashboard-alert-badge">{busesNoDriver.length}</span>
                      <span className="dashboard-alert-text">
                        {busesNoDriver.length === 1 ? 'bus has' : 'buses have'} no driver
                      </span>
                      <Link to="/school/buses" className="dashboard-alert-action">Fix</Link>
                    </li>
                  )}
                  {busesNoRoute.length > 0 && (
                    <li className="dashboard-alert-item">
                      <span className="dashboard-alert-badge">{busesNoRoute.length}</span>
                      <span className="dashboard-alert-text">
                        {busesNoRoute.length === 1 ? 'bus has' : 'buses have'} no route
                      </span>
                      <Link to="/school/buses" className="dashboard-alert-action">Fix</Link>
                    </li>
                  )}
                  {studentsNoStop.length > 0 && (
                    <li className="dashboard-alert-item">
                      <span className="dashboard-alert-badge">{studentsNoStop.length}</span>
                      <span className="dashboard-alert-text">
                        {studentsNoStop.length === 1 ? 'student has' : 'students have'} no stop
                      </span>
                      <Link to="/school/students" className="dashboard-alert-action">Fix</Link>
                    </li>
                  )}
                </ul>
              )}

              {/* Route coverage */}
              {activeRoutes.length > 0 && (
                <div className="dashboard-coverage">
                  <span className="dashboard-coverage-label">Route coverage</span>
                  <div className="dashboard-coverage-rows">
                    {activeRoutes.map((route) => {
                      const bus = activeBuses.find((b) => b.routeId === route.id);
                      return (
                        <div key={route.id} className="dashboard-coverage-row">
                          <span className="dashboard-coverage-route">{route.name}</span>
                          <span className={bus ? 'dashboard-coverage-ok' : 'dashboard-coverage-gap'}>
                            {bus ? bus.registrationNumber : 'No bus'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

          </div>
        </>
      )}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  total?: number;
  href:  string;
}

function StatCard({ label, value, total, href }: StatCardProps) {
  return (
    <Link to={href} className="dashboard-stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {total !== undefined && total !== value && (
        <span className="stat-footnote">of {total} total</span>
      )}
    </Link>
  );
}
