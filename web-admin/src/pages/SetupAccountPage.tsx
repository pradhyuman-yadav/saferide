import { type FormEvent, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerWithEmail } from '@/firebase/auth';
import { useAuthStore } from '@/store/auth.store';
import { usePageTitle } from '@/hooks/usePageTitle';
import './login.css'; // reuse login styles — same card layout

export function SetupAccountPage() {
  usePageTitle('Set Up Account');
  const navigate = useNavigate();

  const authError      = useAuthStore((s) => s.authError);
  const clearAuthError = useAuthStore((s) => s.clearAuthError);
  const profile        = useAuthStore((s) => s.profile);
  const storeIsLoading = useAuthStore((s) => s.isLoading);

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [error,         setError]         = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [awaitingSetup, setAwaitingSetup] = useState(false);

  // Redirect once invite is claimed and profile is ready
  useEffect(() => {
    if (!storeIsLoading && profile !== null) {
      navigate('/school', { replace: true });
    }
  }, [storeIsLoading, profile, navigate]);

  // Show invite-claim errors (no invite found, wrong role, etc.)
  useEffect(() => {
    if (authError !== null) {
      setError(authError);
      setAwaitingSetup(false);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  // Timeout if invite claim takes too long
  useEffect(() => {
    if (!awaitingSetup) return;
    const timer = setTimeout(() => {
      setAwaitingSetup(false);
      setError('Account setup is taking too long. Check your connection and try again.');
    }, 15_000);
    return () => clearTimeout(timer);
  }, [awaitingSetup]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await registerWithEmail(email.trim(), password);
      // Firebase Auth account created.
      // auth.store onAuthStateChanged fires → claimPendingInvite runs →
      // name is read from the invite (contactName set at onboarding) →
      // profile is written → useEffect above redirects to /school.
      setAwaitingSetup(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitDisabled =
    isLoading ||
    email.trim() === '' ||
    password === '' ||
    confirmPass === '';

  return (
    <div className="login-page">
      <header className="login-header">
        <h1 className="login-header-title">SafeRide</h1>
        <p className="login-header-caption">Account Setup</p>
      </header>

      <div className="login-body">
        <div className="login-card">

          {awaitingSetup ? (
            <div className="login-awaiting-setup">
              <div className="spinner spinner--lg" />
              <p className="login-awaiting-setup-text">
                Verifying your invitation and setting up your dashboard…
              </p>
            </div>
          ) : (
            <>
              <h2 className="login-card-heading">Set up your account</h2>
              <p className="login-setup-hint">
                Use the email address your school administrator was invited with.
                Your name and school will be linked automatically.
              </p>

              <form className="login-form" onSubmit={handleSubmit} noValidate>
                {error !== null && (
                  <p className="login-error" role="alert">{error}</p>
                )}

                <div className="form-field">
                  <label className="form-label" htmlFor="email">
                    Invited Email
                  </label>
                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="admin@yourschool.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="password">
                    Choose Password
                  </label>
                  <input
                    id="password"
                    className="form-input"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="confirm-password">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    className="form-input"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Re-enter your password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
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
                      Setting up…
                    </span>
                  ) : 'Activate account'}
                </button>
              </form>

              <p className="login-mode-switch">
                Already have an account?{' '}
                <Link to="/login" className="login-mode-link">
                  Sign in
                </Link>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
