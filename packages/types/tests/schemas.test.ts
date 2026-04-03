import { describe, it, expect } from 'vitest';
import {
  UserProfileSchema,
  TenantSchema,
  CreateTenantSchema,
  PendingInviteSchema,
  ClaimInviteSchema,
} from '../src/index';

// ---------------------------------------------------------------------------
// UserProfileSchema
// ---------------------------------------------------------------------------
describe('UserProfileSchema', () => {
  const validUser = {
    uid:       'user-001',
    email:     'priya@school.edu',
    name:      'Priya Sharma',
    role:      'parent' as const,
    tenantId:  'tenant-123',
    status:    'active' as const,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  it('parses a fully-valid user profile', () => {
    const result = UserProfileSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it('allows tenantId to be null', () => {
    const result = UserProfileSchema.safeParse({ ...validUser, tenantId: null });
    expect(result.success).toBe(true);
  });

  it('fails when uid is missing', () => {
    const { uid: _uid, ...withoutUid } = validUser;
    const result = UserProfileSchema.safeParse(withoutUid);
    expect(result.success).toBe(false);
  });

  it('fails with an invalid role', () => {
    const result = UserProfileSchema.safeParse({ ...validUser, role: 'god_mode' });
    expect(result.success).toBe(false);
  });

  it('fails with an email missing the @', () => {
    const result = UserProfileSchema.safeParse({ ...validUser, email: 'notanemail' });
    expect(result.success).toBe(false);
  });

  it('fails with an invalid status', () => {
    const result = UserProfileSchema.safeParse({ ...validUser, status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid roles', () => {
    const roles = ['super_admin', 'school_admin', 'manager', 'driver', 'parent'] as const;
    for (const role of roles) {
      const result = UserProfileSchema.safeParse({ ...validUser, role });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// TenantSchema
// ---------------------------------------------------------------------------
describe('TenantSchema', () => {
  const validTenant = {
    id:           'tenant-001',
    name:         'Green Valley School',
    slug:         'green-valley-abc1',
    city:         'Bengaluru',
    state:        'Karnataka',
    status:       'active' as const,
    plan:         'pro' as const,
    trialEndsAt:  null,
    maxBuses:     10,
    maxStudents:  500,
    contactName:  'Ramesh Kumar',
    contactEmail: 'ramesh@school.edu',
    contactPhone: '9876543210',
    adminEmail:   'admin@school.edu',
    createdAt:    1700000000000,
    updatedAt:    1700000000000,
  };

  it('parses a fully-valid tenant', () => {
    const result = TenantSchema.safeParse(validTenant);
    expect(result.success).toBe(true);
  });

  it('allows trialEndsAt to be null', () => {
    const result = TenantSchema.safeParse({ ...validTenant, trialEndsAt: null });
    expect(result.success).toBe(true);
  });

  it('allows trialEndsAt to be a number', () => {
    const result = TenantSchema.safeParse({ ...validTenant, trialEndsAt: 1800000000000 });
    expect(result.success).toBe(true);
  });

  it('fails when status is not in enum', () => {
    const result = TenantSchema.safeParse({ ...validTenant, status: 'archived' });
    expect(result.success).toBe(false);
  });

  it('fails when plan is not in enum', () => {
    const result = TenantSchema.safeParse({ ...validTenant, plan: 'enterprise' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    const statuses = ['trial', 'active', 'suspended', 'cancelled'] as const;
    for (const status of statuses) {
      const result = TenantSchema.safeParse({ ...validTenant, status });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// CreateTenantSchema
// ---------------------------------------------------------------------------
describe('CreateTenantSchema', () => {
  const validInput = {
    name:         'Sunrise Academy',
    city:         'Chennai',
    state:        'Tamil Nadu',
    plan:         'trial' as const,
    maxBuses:     5,
    maxStudents:  200,
    contactName:  'Sunita Rajan',
    contactEmail: 'sunita@sunrise.edu',
    contactPhone: '8765432109',
    adminEmail:   'admin@sunrise.edu',
  };

  it('parses valid input', () => {
    const result = CreateTenantSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('fails when contactPhone is not exactly 10 digits', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, contactPhone: '123456789' }); // 9 digits
    expect(result.success).toBe(false);
  });

  it('fails when contactPhone contains letters', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, contactPhone: '9876abcd12' });
    expect(result.success).toBe(false);
  });

  it('fails when contactPhone is 11 digits', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, contactPhone: '12345678901' });
    expect(result.success).toBe(false);
  });

  it('fails when email is invalid', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, contactEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('fails when name exceeds 100 characters', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('fails when maxBuses is less than 1', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, maxBuses: 0 });
    expect(result.success).toBe(false);
  });

  it('passes when maxBuses is exactly 1', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, maxBuses: 1 });
    expect(result.success).toBe(true);
  });

  it('fails when plan is invalid', () => {
    const result = CreateTenantSchema.safeParse({ ...validInput, plan: 'free' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PendingInviteSchema
// ---------------------------------------------------------------------------
describe('PendingInviteSchema', () => {
  const validInvite = {
    tenantId:    'tenant-001',
    email:       'admin@school.edu',
    role:        'school_admin' as const,
    plan:        'trial' as const,       // required: auth-service uses this to activate tenant
    contactName: 'Ramesh Kumar',
    createdAt:   1700000000000,
    updatedAt:   1700000000000,
  };

  it('parses a valid invite', () => {
    const result = PendingInviteSchema.safeParse(validInvite);
    expect(result.success).toBe(true);
  });

  it('parses invite without optional contactName', () => {
    const { contactName: _contactName, ...withoutName } = validInvite;
    const result = PendingInviteSchema.safeParse(withoutName);
    expect(result.success).toBe(true);
  });

  it('fails with an invalid role', () => {
    const result = PendingInviteSchema.safeParse({ ...validInvite, role: 'god_mode' });
    expect(result.success).toBe(false);
  });

  it('fails with an invalid email', () => {
    const result = PendingInviteSchema.safeParse({ ...validInvite, email: 'bademail' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TripSchema
// ---------------------------------------------------------------------------
import { TripSchema, WebhookSchema } from '../src/index';

describe('TripSchema', () => {
  const validTrip = {
    id:        'trip-001',
    tenantId:  'tenant-001',
    driverId:  'driver-001',
    busId:     'bus-001',
    routeId:   'route-001',
    status:    'active' as const,
    startedAt: 1700000000000,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  it('parses a valid trip', () => {
    const result = TripSchema.safeParse(validTrip);
    expect(result.success).toBe(true);
  });

  it('rejects latestLat below -90', () => {
    const result = TripSchema.safeParse({ ...validTrip, latestLat: -91 });
    expect(result.success).toBe(false);
  });

  it('rejects latestLat above 90', () => {
    const result = TripSchema.safeParse({ ...validTrip, latestLat: 91 });
    expect(result.success).toBe(false);
  });

  it('rejects latestLon below -180', () => {
    const result = TripSchema.safeParse({ ...validTrip, latestLon: -181 });
    expect(result.success).toBe(false);
  });

  it('rejects latestLon above 180', () => {
    const result = TripSchema.safeParse({ ...validTrip, latestLon: 181 });
    expect(result.success).toBe(false);
  });

  it('accepts latestLat at boundary values -90 and 90', () => {
    expect(TripSchema.safeParse({ ...validTrip, latestLat: -90 }).success).toBe(true);
    expect(TripSchema.safeParse({ ...validTrip, latestLat:  90 }).success).toBe(true);
  });

  it('accepts latestLon at boundary values -180 and 180', () => {
    expect(TripSchema.safeParse({ ...validTrip, latestLon: -180 }).success).toBe(true);
    expect(TripSchema.safeParse({ ...validTrip, latestLon:  180 }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WebhookSchema
// ---------------------------------------------------------------------------
describe('WebhookSchema', () => {
  const validWebhook = {
    id:        'wh-001',
    tenantId:  'tenant-001',
    url:       'https://example.com/webhook',
    events:    ['trip.started'] as const,
    isActive:  true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  it('parses a valid webhook', () => {
    const result = WebhookSchema.safeParse(validWebhook);
    expect(result.success).toBe(true);
  });

  it('rejects url longer than 500 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(490);
    const result  = WebhookSchema.safeParse({ ...validWebhook, url: longUrl });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL string', () => {
    const result = WebhookSchema.safeParse({ ...validWebhook, url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty events array', () => {
    const result = WebhookSchema.safeParse({ ...validWebhook, events: [] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ClaimInviteSchema
// ---------------------------------------------------------------------------
describe('ClaimInviteSchema', () => {
  it('parses a valid idToken string', () => {
    const result = ClaimInviteSchema.safeParse({ idToken: 'some-firebase-id-token' });
    expect(result.success).toBe(true);
  });

  it('fails when idToken is an empty string', () => {
    const result = ClaimInviteSchema.safeParse({ idToken: '' });
    expect(result.success).toBe(false);
  });

  it('fails when idToken is missing', () => {
    const result = ClaimInviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
