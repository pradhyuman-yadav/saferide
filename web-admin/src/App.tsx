import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { SchoolAdminRoute } from '@/components/SchoolAdminRoute';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SchoolsPage } from '@/pages/SchoolsPage';
import { OnboardSchoolPage } from '@/pages/OnboardSchoolPage';
import { SchoolDetailPage } from '@/pages/SchoolDetailPage';
import { SchoolDashboardPage } from '@/pages/school/SchoolDashboardPage';
import { BusesPage }           from '@/pages/school/BusesPage';
import { RoutesPage }          from '@/pages/school/RoutesPage';
import { DriversPage }         from '@/pages/school/DriversPage';
import { StudentsPage }        from '@/pages/school/StudentsPage';
import { SetupAccountPage }    from '@/pages/SetupAccountPage';

// ── Smart catch-all redirect based on role ────────────────────────────────

function SmartRedirect() {
  const profile   = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return null;

  if (profile?.role === 'school_admin') {
    return <Navigate to="/school" replace />;
  }
  if (profile?.role === 'super_admin') {
    return <Navigate to="/" replace />;
  }
  return <Navigate to="/login" replace />;
}

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    // Subscribe to Firebase auth state; returns unsubscribe fn for cleanup
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />

        {/* Super admin routes */}
        <Route element={<SuperAdminRoute />}>
          <Route element={<Layout />}>
            <Route path="/"            element={<DashboardPage />} />
            <Route path="/schools"     element={<SchoolsPage />} />
            <Route path="/schools/new" element={<OnboardSchoolPage />} />
            <Route path="/schools/:id" element={<SchoolDetailPage />} />
          </Route>
        </Route>

        {/* School admin routes */}
        <Route element={<SchoolAdminRoute />}>
          <Route element={<Layout />}>
            <Route path="/school"         element={<SchoolDashboardPage />} />
            <Route path="/school/buses"   element={<BusesPage />} />
            <Route path="/school/routes"  element={<RoutesPage />} />
            <Route path="/school/drivers"  element={<DriversPage />} />
            <Route path="/school/students" element={<StudentsPage />} />
          </Route>
        </Route>

        {/* Catch-all → smart redirect based on role */}
        <Route path="*" element={<SmartRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
