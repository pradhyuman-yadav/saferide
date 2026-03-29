import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createTenant } from '@/firebase/tenants';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { CreateTenantInput, TenantPlan } from '@/types/tenant';
import './onboard.css';

// ── Indian states ──────────────────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// ── Validation ─────────────────────────────────────────────────────────────
interface FieldErrors {
  name?:         string;
  city?:         string;
  state?:        string;
  contactName?:  string;
  contactEmail?: string;
  contactPhone?: string;
  adminEmail?:   string;
  plan?:         string;
  maxBuses?:     string;
  maxStudents?:  string;
}

function validate(fields: CreateTenantInput): FieldErrors {
  const errors: FieldErrors = {};
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^\d{10}$/;

  if (!fields.name.trim())         errors.name         = 'School name is required.';
  if (!fields.city.trim())         errors.city         = 'City is required.';
  if (!fields.state)               errors.state        = 'State is required.';
  if (!fields.contactName.trim())  errors.contactName  = 'Contact person name is required.';
  if (!emailRe.test(fields.contactEmail))
    errors.contactEmail = 'Enter a valid email address.';
  if (!phoneRe.test(fields.contactPhone))
    errors.contactPhone = 'Enter a 10-digit phone number.';
  if (!emailRe.test(fields.adminEmail))
    errors.adminEmail = 'Enter a valid admin email address.';
  if (!fields.plan)                errors.plan         = 'Plan is required.';
  if (fields.maxBuses < 1)         errors.maxBuses     = 'Must be at least 1.';
  if (fields.maxStudents < 1)      errors.maxStudents  = 'Must be at least 1.';

  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────
export function OnboardSchoolPage() {
  usePageTitle('Onboard School');
  const navigate = useNavigate();

  const [fields, setFields] = useState<CreateTenantInput>({
    name:         '',
    city:         '',
    state:        '',
    contactName:  '',
    contactEmail: '',
    contactPhone: '',
    adminEmail:   '',
    plan:         'trial',
    maxBuses:     10,
    maxStudents:  500,
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);

  function setField<K extends keyof CreateTenantInput>(
    key: K,
    value: CreateTenantInput[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
    // Clear per-field error on change
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const errors = validate(fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const newId = await createTenant(fields);
      navigate(`/schools/${newId}`, { replace: true });
    } catch {
      setSubmitError('Could not onboard the school. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboard-page">
      <Link to="/schools" className="back-link">
        &larr; Back to Schools
      </Link>

      <h1 className="page-heading">Onboard New School</h1>

      <div className="onboard-card">
        {submitError !== null && (
          <p className="form-banner-error" role="alert">{submitError}</p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">

            {/* School Name */}
            <div className="form-field form-field--full">
              <label className="form-label" htmlFor="name">
                School Name <span className="required-mark">*</span>
              </label>
              <input
                id="name"
                className={`form-input${fieldErrors.name ? ' error' : ''}`}
                type="text"
                value={fields.name}
                onChange={(e) => setField('name', e.target.value)}
                disabled={isLoading}
                placeholder="Greenfield International School"
                maxLength={100}
              />
              {fieldErrors.name && (
                <span className="form-error">{fieldErrors.name}</span>
              )}
            </div>

            {/* City */}
            <div className="form-field">
              <label className="form-label" htmlFor="city">
                City <span className="required-mark">*</span>
              </label>
              <input
                id="city"
                className={`form-input${fieldErrors.city ? ' error' : ''}`}
                type="text"
                value={fields.city}
                onChange={(e) => setField('city', e.target.value)}
                disabled={isLoading}
                placeholder="Bengaluru"
                maxLength={100}
              />
              {fieldErrors.city && (
                <span className="form-error">{fieldErrors.city}</span>
              )}
            </div>

            {/* State */}
            <div className="form-field">
              <label className="form-label" htmlFor="state">
                State <span className="required-mark">*</span>
              </label>
              <select
                id="state"
                className={`form-select${fieldErrors.state ? ' error' : ''}`}
                value={fields.state}
                onChange={(e) => setField('state', e.target.value)}
                disabled={isLoading}
              >
                <option value="">Select a state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {fieldErrors.state && (
                <span className="form-error">{fieldErrors.state}</span>
              )}
            </div>

            {/* Contact Person Name */}
            <div className="form-field">
              <label className="form-label" htmlFor="contactName">
                Contact Person Name <span className="required-mark">*</span>
              </label>
              <input
                id="contactName"
                className={`form-input${fieldErrors.contactName ? ' error' : ''}`}
                type="text"
                value={fields.contactName}
                onChange={(e) => setField('contactName', e.target.value)}
                disabled={isLoading}
                placeholder="Ramesh Kumar"
                maxLength={100}
              />
              {fieldErrors.contactName && (
                <span className="form-error">{fieldErrors.contactName}</span>
              )}
            </div>

            {/* Contact Email */}
            <div className="form-field">
              <label className="form-label" htmlFor="contactEmail">
                Contact Email <span className="required-mark">*</span>
              </label>
              <input
                id="contactEmail"
                className={`form-input${fieldErrors.contactEmail ? ' error' : ''}`}
                type="email"
                value={fields.contactEmail}
                onChange={(e) => setField('contactEmail', e.target.value)}
                disabled={isLoading}
                placeholder="ramesh@school.in"
                maxLength={254}
              />
              {fieldErrors.contactEmail && (
                <span className="form-error">{fieldErrors.contactEmail}</span>
              )}
            </div>

            {/* Contact Phone */}
            <div className="form-field">
              <label className="form-label" htmlFor="contactPhone">
                Contact Phone <span className="required-mark">*</span>
              </label>
              <input
                id="contactPhone"
                className={`form-input${fieldErrors.contactPhone ? ' error' : ''}`}
                type="tel"
                inputMode="numeric"
                value={fields.contactPhone}
                onChange={(e) =>
                  setField('contactPhone', e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                disabled={isLoading}
                placeholder="9876543210"
              />
              {fieldErrors.contactPhone && (
                <span className="form-error">{fieldErrors.contactPhone}</span>
              )}
            </div>

            {/* School Admin Email */}
            <div className="form-field">
              <label className="form-label" htmlFor="adminEmail">
                School Admin Email <span className="required-mark">*</span>
              </label>
              <input
                id="adminEmail"
                className={`form-input${fieldErrors.adminEmail ? ' error' : ''}`}
                type="email"
                value={fields.adminEmail}
                onChange={(e) => setField('adminEmail', e.target.value)}
                disabled={isLoading}
                placeholder="admin@school.in"
                maxLength={254}
              />
              {fieldErrors.adminEmail && (
                <span className="form-error">{fieldErrors.adminEmail}</span>
              )}
            </div>

            {/* Plan */}
            <div className="form-field">
              <label className="form-label" htmlFor="plan">
                Plan <span className="required-mark">*</span>
              </label>
              <select
                id="plan"
                className={`form-select${fieldErrors.plan ? ' error' : ''}`}
                value={fields.plan}
                onChange={(e) => setField('plan', e.target.value as TenantPlan)}
                disabled={isLoading}
              >
                <option value="trial">Trial (30 days)</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
              {fieldErrors.plan && (
                <span className="form-error">{fieldErrors.plan}</span>
              )}
            </div>

            {/* Max Buses */}
            <div className="form-field">
              <label className="form-label" htmlFor="maxBuses">
                Max Buses <span className="required-mark">*</span>
              </label>
              <input
                id="maxBuses"
                className={`form-input${fieldErrors.maxBuses ? ' error' : ''}`}
                type="number"
                min={1}
                max={500}
                value={fields.maxBuses}
                onChange={(e) => setField('maxBuses', parseInt(e.target.value, 10) || 1)}
                disabled={isLoading}
              />
              {fieldErrors.maxBuses && (
                <span className="form-error">{fieldErrors.maxBuses}</span>
              )}
            </div>

            {/* Max Students */}
            <div className="form-field">
              <label className="form-label" htmlFor="maxStudents">
                Max Students <span className="required-mark">*</span>
              </label>
              <input
                id="maxStudents"
                className={`form-input${fieldErrors.maxStudents ? ' error' : ''}`}
                type="number"
                min={1}
                max={100000}
                value={fields.maxStudents}
                onChange={(e) => setField('maxStudents', parseInt(e.target.value, 10) || 1)}
                disabled={isLoading}
              />
              {fieldErrors.maxStudents && (
                <span className="form-error">{fieldErrors.maxStudents}</span>
              )}
            </div>

          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner spinner--sm" />
                  Onboarding
                </>
              ) : (
                'Onboard school'
              )}
            </button>
            <Link to="/schools" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
