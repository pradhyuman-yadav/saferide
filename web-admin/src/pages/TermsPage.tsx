/**
 * TermsPage — public-facing Terms of Service.
 * Route: /terms (no auth required)
 */

import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import './legal.css';

const EFFECTIVE_DATE = 'April 2026';
const CONTACT_EMAIL  = 'support@saferide.co.in';

export function TermsPage() {
  usePageTitle('Terms of Service — SafeRide');

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

          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-meta">Effective {EFFECTIVE_DATE} · SafeRide Technologies</p>

          {/* 1 */}
          <div className="legal-section">
            <h2 className="legal-section-title">1. Acceptance</h2>
            <p className="legal-body">
              By creating an account or using the SafeRide platform — including the web admin
              portal, mobile application, and any associated APIs — you agree to be bound by
              these Terms of Service ("Terms"). If you are using SafeRide on behalf of a school
              or organisation, you represent that you have the authority to bind that organisation
              to these Terms.
            </p>
            <p className="legal-body">
              If you do not agree, you must not use SafeRide. These Terms govern the relationship
              between SafeRide Technologies and schools, transport managers, drivers, and parents
              who use the platform.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 2 */}
          <div className="legal-section">
            <h2 className="legal-section-title">2. The service</h2>
            <p className="legal-body">
              SafeRide provides a school bus tracking and parent notification platform. Core
              capabilities include:
            </p>
            <ul className="legal-list">
              <li>Real-time GPS tracking of school buses during active trips</li>
              <li>Push and SMS notifications to parents about bus arrival times</li>
              <li>Fleet management tools for schools (routes, buses, drivers, students)</li>
              <li>Trip history and incident documentation</li>
              <li>Driver trip controls (start, end, SOS)</li>
            </ul>
            <p className="legal-body">
              We offer a 30-day free trial for new schools. After the trial, a paid subscription
              is required to continue using the platform. Pricing is available at saferide.co.in.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 3 */}
          <div className="legal-section">
            <h2 className="legal-section-title">3. Accounts</h2>
            <ul className="legal-list">
              <li>
                <strong>School administrators</strong> are responsible for creating and managing
                accounts for their school's drivers, managers, and students. They are accountable
                for all activity that occurs under their school's account.
              </li>
              <li>
                <strong>Parents</strong> receive an invitation from their school and must not
                share their login credentials with anyone.
              </li>
              <li>
                <strong>Drivers</strong> must only use the mobile app while the vehicle is safely
                parked. The app must never be operated while driving.
              </li>
              <li>
                You must provide accurate information when creating or updating your account. You
                are responsible for maintaining the confidentiality of your credentials.
              </li>
              <li>
                You must notify us immediately at {CONTACT_EMAIL} if you suspect unauthorised
                access to your account.
              </li>
            </ul>
          </div>

          <hr className="legal-divider" />

          {/* 4 */}
          <div className="legal-section">
            <h2 className="legal-section-title">4. Acceptable use</h2>
            <p className="legal-body">You must not:</p>
            <ul className="legal-list">
              <li>Use SafeRide for any unlawful purpose or in violation of any applicable law</li>
              <li>Track any person who has not consented to being tracked</li>
              <li>Attempt to access data belonging to another school or user</li>
              <li>Reverse-engineer, decompile, or attempt to extract source code from SafeRide</li>
              <li>Transmit malware, spam, or any harmful content through the platform</li>
              <li>Use SafeRide to harass, stalk, or harm any individual</li>
              <li>Scrape, crawl, or systematically extract data from SafeRide without written permission</li>
              <li>Attempt to overwhelm SafeRide's infrastructure with automated requests</li>
            </ul>
          </div>

          <hr className="legal-divider" />

          {/* 5 */}
          <div className="legal-section">
            <h2 className="legal-section-title">5. School responsibilities</h2>
            <p className="legal-body">
              Schools using SafeRide are responsible for:
            </p>
            <ul className="legal-list">
              <li>Obtaining all necessary consents from parents and guardians before enabling
                GPS tracking for their children</li>
              <li>Ensuring that student data entered into SafeRide is accurate and up to date</li>
              <li>Promptly removing access for drivers or managers who leave the organisation</li>
              <li>Complying with applicable data protection laws (including DPDP 2023) in
                their jurisdiction</li>
              <li>Keeping subscription payments current to maintain uninterrupted service</li>
            </ul>
          </div>

          <hr className="legal-divider" />

          {/* 6 */}
          <div className="legal-section">
            <h2 className="legal-section-title">6. Availability and accuracy</h2>
            <p className="legal-body">
              We aim for 99.9% platform uptime. However, GPS tracking accuracy depends on the
              driver's device GPS quality, network connectivity, and satellite coverage. ETA
              predictions are estimates only and should not be used as guarantees.
            </p>
            <p className="legal-body">
              We may perform scheduled maintenance with advance notice. We will make reasonable
              efforts to minimise disruption during school hours.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 7 */}
          <div className="legal-section">
            <h2 className="legal-section-title">7. Limitation of liability</h2>
            <p className="legal-body">
              To the maximum extent permitted by law, SafeRide Technologies and its officers,
              employees, and agents shall not be liable for:
            </p>
            <ul className="legal-list">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of data, revenue, profits, or goodwill</li>
              <li>Harm arising from GPS inaccuracy, network outages, or device failures</li>
              <li>Actions or omissions of schools, drivers, or third-party service providers</li>
            </ul>
            <p className="legal-body">
              SafeRide is a notification and visibility tool. It does not replace the duty of
              care of schools, drivers, or parents. Our total aggregate liability to you in any
              12-month period shall not exceed the subscription fees paid by your school in
              that period.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 8 */}
          <div className="legal-section">
            <h2 className="legal-section-title">8. Intellectual property</h2>
            <p className="legal-body">
              All intellectual property in the SafeRide platform — including software, design,
              trademarks, and content — is owned by SafeRide Technologies. Your subscription
              grants you a limited, non-exclusive, non-transferable right to use the platform
              for its intended purpose. No ownership is transferred.
            </p>
            <p className="legal-body">
              Data entered by your school (student records, routes, driver details) remains
              yours. You may export it at any time. Upon subscription termination, we will
              provide a data export within 30 days, after which we will delete it per our
              Privacy Policy.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 9 */}
          <div className="legal-section">
            <h2 className="legal-section-title">9. Termination</h2>
            <p className="legal-body">
              Either party may terminate the subscription with 30 days' written notice.
              We may suspend or terminate your account immediately if you violate these Terms,
              fail to pay subscription fees, or engage in activity that poses a risk to other
              users or our systems.
            </p>
            <p className="legal-body">
              Upon termination, your access to the platform will end and your data will be
              deleted per our Privacy Policy. There are no refunds for partial subscription
              periods unless required by applicable law.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 10 */}
          <div className="legal-section">
            <h2 className="legal-section-title">10. Governing law</h2>
            <p className="legal-body">
              These Terms are governed by the laws of India. Any dispute arising from these
              Terms shall be subject to the exclusive jurisdiction of the courts in Bengaluru,
              Karnataka, India. Before initiating legal proceedings, the parties agree to
              attempt resolution through good-faith negotiation for a period of 30 days.
            </p>
          </div>

          <hr className="legal-divider" />

          {/* 11 */}
          <div className="legal-section">
            <h2 className="legal-section-title">11. Changes to these Terms</h2>
            <p className="legal-body">
              We may update these Terms from time to time. We will notify you by email at
              least 14 days before material changes take effect. Continued use of SafeRide
              after the effective date constitutes acceptance of the revised Terms.
            </p>
          </div>

          {/* Contact */}
          <div className="legal-contact">
            <p className="legal-contact-label">Contact</p>
            <p className="legal-contact-company">SafeRide Technologies</p>
            <div className="legal-contact-links">
              <a href={`mailto:${CONTACT_EMAIL}`} className="legal-contact-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                {CONTACT_EMAIL}
              </a>
              <a href="https://saferide.co.in" className="legal-contact-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                saferide.co.in
              </a>
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
          <Link to="/privacy" className="legal-footer-link">Privacy Policy</Link>
          {' \u00B7 '}
          <Link to="/status" className="legal-footer-link">Status</Link>
          {' \u00B7 '}
          <Link to="/login" className="legal-footer-link">Admin portal</Link>
        </p>
      </footer>

    </div>
  );
}
