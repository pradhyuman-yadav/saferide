import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { SchoolAdminRoute } from '@/components/SchoolAdminRoute';
import { Layout } from '@/components/Layout';
import { LandingPage }  from '@/pages/LandingPage';
import { StatusPage }   from '@/pages/StatusPage';
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
import { WebhooksPage }        from '@/pages/school/WebhooksPage';
import { AnalyticsPage }      from '@/pages/school/AnalyticsPage';
import { SuperAnalyticsPage } from '@/pages/SuperAnalyticsPage';
import { InviteAdminPage }    from '@/pages/InviteAdminPage';
import { SetupAccountPage }    from '@/pages/SetupAccountPage';
import { PrivacyPage }         from '@/pages/PrivacyPage';
import { TermsPage }           from '@/pages/TermsPage';
import { NotFoundPage }        from '@/pages/NotFoundPage';

// ── Smart catch-all redirect based on role ────────────────────────────────

function SmartRedirect() {
  const profile   = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return null;

  if (profile?.role === 'school_admin') {
    return <Navigate to="/school" replace />;
  }
  if (profile?.role === 'super_admin') {
    return <Navigate to="/dashboard" replace />;
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
        <Route path="/"              element={<LandingPage />} />
        <Route path="/status"        element={<StatusPage />} />
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />
        <Route path="/privacy"       element={<PrivacyPage />} />
        <Route path="/terms"         element={<TermsPage />} />

        {/* Super admin routes */}
        <Route element={<SuperAdminRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard"      element={<DashboardPage />} />
            <Route path="/schools"        element={<SchoolsPage />} />
            <Route path="/schools/new"    element={<OnboardSchoolPage />} />
            <Route path="/schools/:id"    element={<SchoolDetailPage />} />
            <Route path="/analytics"      element={<SuperAnalyticsPage />} />
            <Route path="/invite-admin"   element={<InviteAdminPage />} />
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
            <Route path="/school/webhooks"   element={<WebhooksPage />} />
            <Route path="/school/analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>

        {/* Catch-all → 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
