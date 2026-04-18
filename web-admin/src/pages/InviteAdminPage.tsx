/**
 * InviteAdminPage — Super Admin form to create an account invite.
 * Route: /invite-admin (super_admin only)
 *
 * Creates a pending invite in Firestore. The invited person visits
 * /setup-account, enters their email, and claims the invite.
 */

import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, tenantApi } from '@/api/client';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { CreateInviteInput } from '@/types/invite';
import './onboard.css';
import './invite-admin.css';

type Role = CreateInviteInput['role'];

interface School {
  id:   string;
  name: string;
}

interface FieldErrors {
  name?:     string;
  email?:    string;
  role?:     string;
  tenantId?: string;
}

function validate(fields: CreateInviteInput, schoolRequired: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!fields.name.trim())          errors.name  = 'Full name is required.';
  if (!emailRe.test(fields.email))  errors.email = 'Enter a valid email address.';
  if (schoolRequired && !fields.tenantId) errors.tenantId = 'Select a school for this role.';

  return errors;
}

export function InviteAdminPage() {
  usePageTitle('Create Account — SafeRide');

  const [fields, setFields] = useState<CreateInviteInput>({
    name:     '',
    email:    '',
    role:     'school_admin',
    tenantId: undefined,
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);

  // Schools list for the dropdown
  const [schools,        setSchools]        = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);

  // Success state
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const schoolRequired = fields.role === 'school_admin' || fields.role === 'manager';

  // Load schools when a role that needs a school is selected
  useEffect(() => {
    if (!schoolRequired) return;
    if (schools.length > 0) return;

    setSchoolsLoading(true);
    tenantApi.list()
      .then((list) => setSchools(list.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => { /* non-fatal — user will see empty dropdown */ })
      .finally(() => setSchoolsLoading(false));
  }, [schoolRequired, schools.length]);

  function setField<K extends keyof CreateInviteInput>(key: K, value: CreateInviteInput[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const errors = validate(fields, schoolRequired);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const payload: CreateInviteInput = {
        name:     fields.name.trim(),
        email:    fields.email.trim().toLowerCase(),
        role:     fields.role,
        tenantId: schoolRequired ? fields.tenantId : undefined,
      };
      await authApi.createInvite(payload);
      setInviteEmail(payload.email);
      setSetupLink(`${window.location.origin}/setup-account`);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'INVITE_EXISTS') {
        setSubmitError('An active invite already exists for this email address.');
      } else {
        setSubmitError('Could not create the invite. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!setupLink) return;
    void navigator.clipboard.writeText(setupLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setSetupLink(null);
    setInviteEmail('');
    setCopied(false);
    setFields({ name: '', email: '', role: 'school_admin', tenantId: undefined });
    setFieldErrors({});
    setSubmitError(null);
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (setupLink !== null) {
    return (
      <div className="onboard-page">
        <Link to="/dashboard" className="back-link">&larr; Back to Dashboard</Link>
        <h1 className="page-heading">Create Account</h1>

        <div className="onboard-card invite-success-card">
          <div className="invite-success-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="invite-success-title">Invite created</h2>
          <p className="invite-success-body">
            An account invite has been created for <strong>{inviteEmail}</strong>.
            Share the link below — they'll use it to set up their password.
          </p>

          <div className="invite-link-row">
            <code className="invite-link-code">{setupLink}</code>
            <button
              type="button"
              className="invite-copy-btn"
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="invite-success-note">
            The link is not specific to this person — they must sign up with
            the exact email address <strong>{inviteEmail}</strong>.
          </p>

          <div className="form-actions">
            <button type="button" className="btn-primary" onClick={handleReset}>
              Invite another person
            </button>
            <Link to="/dashboard" className="btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form state ───────────────────────────────────────────────────────────
  return (
    <div className="onboard-page">
      <Link to="/dashboard" className="back-link">&larr; Back to Dashboard</Link>
      <h1 className="page-heading">Create Account</h1>

      <div className="onboard-card">
        {submitError !== null && (
          <p className="form-banner-error" role="alert">{submitError}</p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">

            {/* Full Name */}
            <div className="form-field">
              <label className="form-label" htmlFor="name">
                Full Name <span className="required-mark">*</span>
              </label>
              <input
                id="name"
                className={`form-input${fieldErrors.name ? ' error' : ''}`}
                type="text"
                value={fields.name}
                onChange={(e) => setField('name', e.target.value)}
                disabled={isLoading}
                placeholder="Ramesh Kumar"
                maxLength={100}
              />
              {fieldErrors.name && (
                <span className="form-error">{fieldErrors.name}</span>
              )}
            </div>

            {/* Email */}
            <div className="form-field">
              <label className="form-label" htmlFor="email">
                Email Address <span className="required-mark">*</span>
              </label>
              <input
                id="email"
                className={`form-input${fieldErrors.email ? ' error' : ''}`}
                type="email"
                value={fields.email}
                onChange={(e) => setField('email', e.target.value)}
                disabled={isLoading}
                placeholder="admin@school.in"
                maxLength={254}
              />
              {fieldErrors.email && (
                <span className="form-error">{fieldErrors.email}</span>
              )}
            </div>

            {/* Role */}
            <div className="form-field">
              <label className="form-label" htmlFor="role">
                Role <span className="required-mark">*</span>
              </label>
              <select
                id="role"
                className="form-select"
                value={fields.role}
                onChange={(e) => {
                  setField('role', e.target.value as Role);
                  setField('tenantId', undefined);
                }}
                disabled={isLoading}
              >
                <option value="school_admin">School Admin</option>
                <option value="manager">Transport Manager</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            {/* School — only shown for school_admin / manager */}
            {schoolRequired && (
              <div className="form-field">
                <label className="form-label" htmlFor="tenantId">
                  School <span className="required-mark">*</span>
                </label>
                <select
                  id="tenantId"
                  className={`form-select${fieldErrors.tenantId ? ' error' : ''}`}
                  value={fields.tenantId ?? ''}
                  onChange={(e) => setField('tenantId', e.target.value || undefined)}
                  disabled={isLoading || schoolsLoading}
                >
                  <option value="">
                    {schoolsLoading ? 'Loading schools…' : 'Select a school'}
                  </option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {fieldErrors.tenantId && (
                  <span className="form-error">{fieldErrors.tenantId}</span>
                )}
              </div>
            )}

          </div>

          {/* Role description */}
          <p className="invite-role-hint">
            {fields.role === 'school_admin' && 'Can manage buses, routes, drivers, and students for their school.'}
            {fields.role === 'manager'      && 'Can monitor fleet operations but cannot change school settings.'}
            {fields.role === 'super_admin'  && 'Has full platform access across all schools. Use with care.'}
          </p>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <><span className="spinner spinner--sm" /> Creating invite</>
              ) : (
                'Create invite'
              )}
            </button>
            <Link to="/dashboard" className="btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
