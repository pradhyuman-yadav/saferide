/**
 * PrivacyPage — public-facing Privacy Policy.
 * Route: /privacy (no auth required)
 */

import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import './legal.css';

const EFFECTIVE_DATE = 'April 2026';
const CONTACT_EMAIL  = 'support@saferide.co.in';

export function PrivacyPage() {
  usePageTitle('Privacy Policy — SafeRide');

  return (
    <div className="legal-page">

      {/* ── Nav ── */}
      <header className="legal-nav">
        <div className="legal-nav-inner">
          <Link to="/">
            <img src="/logo.svg" alt="SafeRide" className="legal-nav-logo" />
          </Link>
          <Link to="/login" className="legal-nav-signin">Sign in</Link>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="legal-main">
        <div className="legal-inner">

          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-meta">Effective {EFFECTIVE_DATE} · SafeRide Technologies</p>

          {/* 1 */}
          <div className="legal-section">
            <h2 className="legal-section-title">1. Who we are</h2>
            <p className="legal-body">
              SafeRide Technologies ("<strong>SafeRide</strong>", "we", "us") operates the SafeRide
              school bus tracking platform — including the web admin portal at saferide.co.in and
              the SafeRide mobile application. This policy explains what personal data we collect,
              why we collect it, and how we protect it.
            </p>
            <p className="legal-body">
              We are committed to full compliance with India's Digital Personal Data Protection Act
              2023 (DPDP 2023). Children's location is treated as sensitive personal data and is
              handled with the highest level of care.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 2 */}
          <div className="legal-section">
            <h2 className="legal-section-title">2. Data we collect</h2>
            <p className="legal-body"><strong>Parents:</strong></p>
            <ul className="legal-list">
              <li>Name, email address, and phone number (provided at registration)</li>
              <li>Child's name, class, assigned bus, and boarding stop</li>
              <li>Notification preferences (push, SMS)</li>
              <li>Preferred language</li>
            </ul>
            <p className="legal-body"><strong>Drivers:</strong></p>
            <ul className="legal-list">
              <li>Name, email address, phone number</li>
              <li>Real-time GPS coordinates — collected <em>only</em> during an active trip, from
                the driver's device, and only after the driver manually starts the trip</li>
              <li>Trip start/end timestamps</li>
            </ul>
            <p className="legal-body"><strong>School administrators / transport managers:</strong></p>
            <ul className="legal-list">
              <li>Name, email address, phone number</li>
              <li>School name and administrative data entered into the platform</li>
            </ul>
            <p className="legal-body"><strong>Automatically collected:</strong></p>
            <ul className="legal-list">
              <li>Device type and OS version (for push notification delivery)</li>
              <li>App crash logs and anonymised usage events (for reliability improvements)</li>
              <li>IP address and request timestamps (server access logs, retained 7 days)</li>
            </ul>
          </div>

          <hr className="legal-divider" />

          {/* 3 */}
          <div className="legal-section">
            <h2 className="legal-section-title">3. How we use your data</h2>
            <ul className="legal-list">
              <li>Show parents the real-time location of their child's bus and estimated arrival time</li>
              <li>Send push and SMS notifications about bus departures, delays, and arrivals</li>
              <li>Enable school transport managers to administer routes, buses, and student assignments</li>
              <li>Provide drivers with trip controls (start, end, SOS)</li>
              <li>Generate trip history for incident investigation and safety audits</li>
              <li>Improve platform reliability and performance through anonymised analytics</li>
              <li>Send service emails (password reset, invite links, account updates)</li>
            </ul>
            <p className="legal-body">
              We do not use personal data for advertising and do not build behavioural profiles.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 4 */}
          <div className="legal-section">
            <h2 className="legal-section-title">4. Who we share data with</h2>
            <ul className="legal-list">
              <li>
                <strong>Your school:</strong> the school's transport managers and administrators
                can see the data associated with their school. They cannot see data from other
                schools.
              </li>
              <li>
                <strong>Firebase (Google):</strong> we store data in Google Firebase (Firestore,
                Realtime Database, Authentication). All data is stored in the <strong>asia-south1
                (Mumbai)</strong> region and never leaves India.
              </li>
              <li>
                <strong>AWS (Amazon Web Services):</strong> our backend services run on AWS
                ap-south-1 (Mumbai). No personal data is stored in AWS — it passes through
                in-memory only.
              </li>
              <li>
                <strong>Expo (Notification delivery):</strong> push notification tokens are
                sent to Expo's push notification service for delivery. No location data is
                shared with Expo.
              </li>
            </ul>
            <p className="legal-body">
              We do not sell, rent, or trade personal data to any third party.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 5 */}
          <div className="legal-section">
            <h2 className="legal-section-title">5. Children's privacy (DPDP 2023)</h2>
            <p className="legal-body">
              A child's real-time GPS location is sensitive personal data under the DPDP 2023.
              We handle it as follows:
            </p>
            <ul className="legal-list">
              <li>
                <strong>Consent:</strong> a parent or guardian must explicitly consent to their
                child's location being tracked before any location data is displayed. Consent is
                recorded with a timestamp and policy version.
              </li>
              <li>
                <strong>Minimum collection:</strong> GPS coordinates are collected from the
                driver's device only during an active school trip. Collection stops the moment
                the driver ends the trip.
              </li>
              <li>
                <strong>Access control:</strong> a parent can only see the bus linked to their
                own child — never another family's bus.
              </li>
              <li>
                <strong>Automatic deletion:</strong> GPS telemetry records are permanently
                deleted after 30 days. Trip summary records (no coordinates) are retained for
                7 years for school audit purposes.
              </li>
              <li>
                <strong>Withdrawal:</strong> a parent may withdraw consent at any time by
                contacting us at {CONTACT_EMAIL}. Withdrawal stops future tracking immediately.
              </li>
            </ul>
          </div>

          <hr className="legal-divider" />

          {/* 6 */}
          <div className="legal-section">
            <h2 className="legal-section-title">6. Data retention</h2>
            <ul className="legal-list">
              <li>GPS coordinates — deleted after 30 days</li>
              <li>Trip summaries (no coordinates) — retained 7 years for school audit</li>
              <li>Account data — retained while the school's subscription is active, then
                deleted within 90 days of subscription end</li>
              <li>Server access logs — retained 7 days</li>
              <li>Consent records — retained indefinitely (legal obligation)</li>
            </ul>
          </div>

          <hr className="legal-divider" />

          {/* 7 */}
          <div className="legal-section">
            <h2 className="legal-section-title">7. Your rights</h2>
            <p className="legal-body">Under DPDP 2023 and applicable law, you have the right to:</p>
            <ul className="legal-list">
              <li><strong>Access:</strong> request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> request correction of inaccurate data</li>
              <li><strong>Erasure:</strong> request deletion of your personal data (subject to
                retention obligations)</li>
              <li><strong>Data portability:</strong> receive your data in a machine-readable format
                (delivered within 72 hours via a signed download link)</li>
              <li><strong>Grievance redress:</strong> lodge a complaint with our Grievance Officer
                (contact below) or with the Data Protection Board of India</li>
            </ul>
            <p className="legal-body">
              To exercise any of these rights, email {CONTACT_EMAIL}. We will respond within
              30 days.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 8 */}
          <div className="legal-section">
            <h2 className="legal-section-title">8. Security</h2>
            <ul className="legal-list">
              <li>All data in transit is encrypted with TLS 1.3</li>
              <li>All data at rest is encrypted by Firebase / Google</li>
              <li>GPS coordinates in Firestore use field-level encryption</li>
              <li>Access tokens expire after 15 minutes; refresh tokens after 30 days</li>
              <li>Every service enforces strict multi-tenant isolation — no school can
                access another school's data</li>
              <li>Firestore security rules are deployed in code and independently reviewed</li>
            </ul>
          </div>

          <hr className="legal-divider" />

          {/* 9 */}
          <div className="legal-section">
            <h2 className="legal-section-title">9. Changes to this policy</h2>
            <p className="legal-body">
              We may update this policy as our service evolves. When we make material changes,
              we will notify you by email and update the effective date above. Continued use of
              SafeRide after the effective date constitutes acceptance of the revised policy.
            </p>
          </div>

          {/* Contact */}
          <div className="legal-contact">
            <p className="legal-contact-label">Grievance Officer (DPDP 2023)</p>
            <p className="legal-contact-company">Grievance Officer, SafeRide Technologies</p>
            <div className="legal-contact-links">
              <a href={`mailto:${CONTACT_EMAIL}`} className="legal-contact-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                {CONTACT_EMAIL}
              </a>
              <a href="https://saferide.co.in/privacy" className="legal-contact-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                saferide.co.in/privacy
              </a>
              <span className="legal-contact-meta">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Response within 30 days of receipt
              </span>
            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="legal-footer">
        <p className="legal-footer-text">
          SafeRide
          {' \u00B7 '}
          <Link to="/" className="legal-footer-link">Home</Link>
          {' \u00B7 '}
          <Link to="/terms" className="legal-footer-link">Terms of Service</Link>
          {' \u00B7 '}
          <Link to="/status" className="legal-footer-link">Status</Link>
          {' \u00B7 '}
          <Link to="/login" className="legal-footer-link">Admin portal</Link>
        </p>
      </footer>

    </div>
  );
}
