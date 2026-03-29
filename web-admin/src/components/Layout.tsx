import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import './layout.css';

export function Layout() {
  const profile  = useAuthStore((s) => s.profile);
  const signOut  = useAuthStore((s) => s.signOut);

  const isSuperAdmin  = profile?.role === 'super_admin';
  const isSchoolAdmin = profile?.role === 'school_admin';

  const handleSignOut = () => {
    signOut().catch(() => {
      // Sign-out failure is non-fatal; auth state will still clear
    });
  };

  const caption = isSuperAdmin
    ? 'Super Admin'
    : isSchoolAdmin
    ? 'School Admin'
    : 'Admin';

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-title">SafeRide</span>
          <p className="sidebar-brand-caption">{caption}</p>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {isSuperAdmin && (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/schools"
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                Schools
              </NavLink>
            </>
          )}

          {isSchoolAdmin && (
            <>
              <NavLink
                to="/school"
                end
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/school/buses"
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                Buses
              </NavLink>
              <NavLink
                to="/school/routes"
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                Routes
              </NavLink>
              <NavLink
                to="/school/drivers"
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                Drivers
              </NavLink>
              <NavLink
                to="/school/students"
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                Students
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {profile !== null && (
            <p className="sidebar-user-name" title={isSchoolAdmin ? (profile.tenantName ?? '') : profile.name}>
              {isSchoolAdmin ? (profile.tenantName ?? '') : profile.name}
            </p>
          )}
          <button
            type="button"
            className="sidebar-signout-btn"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
