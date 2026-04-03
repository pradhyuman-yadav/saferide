import { type FormEvent, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail } from '@/firebase/auth';
import { useAuthStore } from '@/store/auth.store';
import { usePageTitle } from '@/hooks/usePageTitle';
import './login.css';

export function LoginPage() {
  usePageTitle('Sign In');
  const navigate = useNavigate();

  const authError      = useAuthStore((s) => s.authError);
  const clearAuthError = useAuthStore((s) => s.clearAuthError);
  const profile        = useAuthStore((s) => s.profile);
  const storeIsLoading = useAuthStore((s) => s.isLoading);

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect once profile is loaded
  useEffect(() => {
    if (!storeIsLoading && profile !== null) {
      navigate(
        profile.role === 'school_admin' ? '/school' : '/dashboard',
        { replace: true },
      );
    }
  }, [storeIsLoading, profile, navigate]);

  // Lift store-level errors (wrong role, no profile) into local error state
  useEffect(() => {
    if (authError !== null) {
      setError(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signInWithEmail(email.trim(), password);
      // isLoading stays true — redirect handled by useEffect once profile loads
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  const submitDisabled = isLoading || email.trim() === '' || password === '';

  return (
    <div className="login-page">
      <header className="login-header">
        <img src="/logo.svg" alt="SafeRide" className="login-header-logo" />
        <p className="login-header-caption">Admin Portal</p>
      </header>

      <div className="login-body">
        <div className="login-card">
          <h2 className="login-card-heading">Sign in</h2>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error !== null && (
              <p className="login-error" role="alert">{error}</p>
            )}

            <div className="form-field">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="form-input"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@school.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={submitDisabled}
            >
              {isLoading ? (
                <span className="login-submit-loading">
                  <span className="spinner spinner--sm" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="login-mode-switch">
            Invited school administrator?{' '}
            <Link to="/setup-account" className="login-mode-link">
              Set up your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
