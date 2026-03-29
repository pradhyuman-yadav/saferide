import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

/**
 * Renders the outlet only if the authenticated user has the school_admin role.
 *
 * - Loading  → spinner
 * - No user  → /login
 * - Wrong role (super_admin) → /
 */
export function SchoolAdminRoute() {
  const user      = useAuthStore((s) => s.user);
  const profile   = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="protected-route-loading">
        <div className="spinner" aria-label="Checking authentication" />
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== 'school_admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
