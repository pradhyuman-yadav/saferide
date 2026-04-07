import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import './landing.css';

// ── Inline icon components (lucide-style, 24 × 24, 2px stroke) ────────────

function IconMapPin() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// ── Contact form state ────────────────────────────────────────────────────

interface ContactFields {
  name:    string;
  school:  string;
  email:   string;
  message: string;
}

const EMPTY: ContactFields = { name: '', school: '', email: '', message: '' };

// ── Page ─────────────────────────────────────────────────────────────────

export function LandingPage() {
  usePageTitle('SafeRide — School Bus Safety Platform');

  const [form,        setForm]        = useState<ContactFields>(EMPTY);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  const update = (field: keyof ContactFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleContact = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // Small deliberate pause so the loading state is visible
    await new Promise(r => setTimeout(r, 800));
    setSubmitting(false);
    setSubmitted(true);
    setForm(EMPTY);
  };

  const canSubmit = form.name.trim() !== '' &&
                    form.email.trim() !== '' &&
                    form.school.trim() !== '' &&
                    !submitting;

  return (
    <div className="landing">

      {/* ── Nav ── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <img src="/logo.svg" alt="SafeRide" className="landing-nav-logo" />
          <Link to="/login" className="landing-nav-signin">Sign in</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <p className="landing-hero-eyebrow">School bus safety platform</p>
          <h1 className="landing-hero-headline">
            Every parent knows<br />their child is safe.
          </h1>
          <p className="landing-hero-body">
            SafeRide brings live GPS tracking, instant alerts, and a full
            fleet dashboard to schools across India — so transport managers
            run with confidence, drivers focus on the road, and parents
            have the calm they deserve.
          </p>
          <div className="landing-hero-actions">
            <a href="#contact" className="landing-btn landing-btn--primary">
              Book a demo
            </a>
            <Link to="/login" className="landing-btn landing-btn--ghost">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features">
        <div className="landing-section-inner">
          <h2 className="landing-section-heading">Built for the way schools work</h2>
          <div className="landing-features-grid">

            <div className="landing-feature-card">
              <span className="landing-feature-icon"><IconMapPin /></span>
              <h3 className="landing-feature-title">Live GPS tracking</h3>
              <p className="landing-feature-body">
                Parents see their child's bus on a live map, updated every
                few seconds from the driver's phone — no hardware to install.
              </p>
            </div>

            <div className="landing-feature-card">
              <span className="landing-feature-icon"><IconBell /></span>
              <h3 className="landing-feature-title">Instant parent alerts</h3>
              <p className="landing-feature-body">
                Push notifications fire the moment a trip starts, when the
                bus is 10 minutes away, and when it arrives — in 7 Indian
                languages.
              </p>
            </div>

            <div className="landing-feature-card">
              <span className="landing-feature-icon"><IconDashboard /></span>
              <h3 className="landing-feature-title">Fleet dashboard</h3>
              <p className="landing-feature-body">
                Transport managers see every bus, driver, and student on one
                screen. SOS events surface instantly. No more unanswered
                parent calls.
              </p>
            </div>

            <div className="landing-feature-card">
              <span className="landing-feature-icon"><IconShield /></span>
              <h3 className="landing-feature-title">Safety by design</h3>
              <p className="landing-feature-body">
                One-tap SOS for drivers, real-time manager alerts, and
                DPDP 2023-compliant data handling. Children's location is
                sensitive — we treat it that way.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-how">
        <div className="landing-section-inner">
          <h2 className="landing-section-heading">Up and running in a day</h2>
          <ol className="landing-steps">
            <li className="landing-step">
              <span className="landing-step-number">01</span>
              <div className="landing-step-content">
                <h3 className="landing-step-title">School signs up</h3>
                <p className="landing-step-body">
                  Onboard your school in minutes. Add buses, routes, stops,
                  and drivers from the web portal. Import students from a
                  CSV or your existing ERP.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-number">02</span>
              <div className="landing-step-content">
                <h3 className="landing-step-title">Drivers tap Start Trip</h3>
                <p className="landing-step-body">
                  Drivers use their Android or iPhone — no extra device
                  needed. The SafeRide app runs quietly in the background,
                  sending location every 10 seconds.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-number">03</span>
              <div className="landing-step-content">
                <h3 className="landing-step-title">Parents follow along</h3>
                <p className="landing-step-body">
                  Parents open the app and see the bus on a live map,
                  receive push notifications at key moments, and can check
                  past trip history — all in their preferred language.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="landing-contact" id="contact">
        <div className="landing-section-inner landing-section-inner--narrow">
          <h2 className="landing-section-heading">Get in touch</h2>
          <p className="landing-contact-caption">
            Tell us about your school and we'll reach out within one
            business day to walk you through a demo.
          </p>

          {submitted ? (
            <div className="landing-contact-success">
              <p className="landing-contact-success-text">
                Thank you. We'll be in touch shortly.
              </p>
            </div>
          ) : (
            <form className="landing-contact-form" onSubmit={handleContact} noValidate>
              <div className="landing-form-row">
                <div className="landing-form-field">
                  <label className="landing-form-label" htmlFor="contact-name">
                    Your name
                  </label>
                  <input
                    id="contact-name"
                    className="landing-form-input"
                    type="text"
                    placeholder="Ramesh Kumar"
                    autoComplete="name"
                    value={form.name}
                    onChange={update('name')}
                    disabled={submitting}
                    required
                  />
                </div>
                <div className="landing-form-field">
                  <label className="landing-form-label" htmlFor="contact-school">
                    School name
                  </label>
                  <input
                    id="contact-school"
                    className="landing-form-input"
                    type="text"
                    placeholder="City Montessori School"
                    value={form.school}
                    onChange={update('school')}
                    disabled={submitting}
                    required
                  />
                </div>
              </div>
              <div className="landing-form-field">
                <label className="landing-form-label" htmlFor="contact-email">
                  Email address
                </label>
                <input
                  id="contact-email"
                  className="landing-form-input"
                  type="email"
                  placeholder="ramesh@school.in"
                  autoComplete="email"
                  value={form.email}
                  onChange={update('email')}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="landing-form-field">
                <label className="landing-form-label" htmlFor="contact-message">
                  Anything you'd like us to know
                  <span className="landing-form-optional">(optional)</span>
                </label>
                <textarea
                  id="contact-message"
                  className="landing-form-input landing-form-textarea"
                  placeholder="How many buses, which city, anything else..."
                  rows={4}
                  value={form.message}
                  onChange={update('message')}
                  disabled={submitting}
                />
              </div>
              <button
                type="submit"
                className="landing-btn landing-btn--primary landing-contact-submit"
                disabled={!canSubmit}
              >
                {submitting ? (
                  <span className="landing-submit-loading">
                    <span className="spinner spinner--sm" />
                    Sending…
                  </span>
                ) : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-nav-inner">
          <img src="/logo.svg" alt="SafeRide" className="landing-footer-logo" />
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} SafeRide. Built with care for Indian schools.
            {' · '}
            <Link to="/status"   className="landing-footer-status-link">System status</Link>
            {' · '}
            <Link to="/privacy"  className="landing-footer-status-link">Privacy Policy</Link>
            {' · '}
            <Link to="/terms"    className="landing-footer-status-link">Terms of Service</Link>
          </p>
        </div>
      </footer>

    </div>
  );
}
