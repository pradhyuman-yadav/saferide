import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Use vi.hoisted so all mock references are available inside vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockVerifyIdToken,
  mockAdminAuth,
  mockUserDocRef,
  mockInviteDocRef,
  mockTenantDocRef,
  mockUsersCollection,
  mockInvitesCollection,
  mockTenantsCollection,
  mockRunTransaction,
} = vi.hoisted(() => {
  const mockVerifyIdToken     = vi.fn();
  const mockAdminAuth         = { verifyIdToken: mockVerifyIdToken };
  const mockUserDocRef        = { get: vi.fn(), set: vi.fn() };
  const mockInviteDocRef      = { get: vi.fn(), delete: vi.fn() };
  const mockTenantDocRef      = { update: vi.fn() };
  const mockUsersCollection   = { doc: vi.fn().mockReturnValue(mockUserDocRef) };
  const mockInvitesCollection = { doc: vi.fn().mockReturnValue(mockInviteDocRef) };
  const mockTenantsCollection = { doc: vi.fn().mockReturnValue(mockTenantDocRef) };
  // Executes the transaction callback immediately (no real Firestore needed in tests)
  const mockRunTransaction    = vi.fn().mockImplementation(
    async (fn: (t: object) => Promise<unknown>) => fn({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  );
  return {
    mockVerifyIdToken, mockAdminAuth,
    mockUserDocRef, mockInviteDocRef, mockTenantDocRef,
    mockUsersCollection, mockInvitesCollection, mockTenantsCollection,
    mockRunTransaction,
  };
});

vi.mock('@saferide/firebase-admin', () => ({
  getAdminAuth: vi.fn(() => mockAdminAuth),
  getDb:        vi.fn(() => ({
    collection: vi.fn((name: string) => {
      if (name === 'users')          return mockUsersCollection;
      if (name === 'tenants')        return mockTenantsCollection;
      return mockInvitesCollection;  // pendingInvites
    }),
    runTransaction: mockRunTransaction,
  })),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  auditLog: vi.fn(),
}));

import { AuthService } from '../../src/services/auth.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeValidDecodedToken(overrides: Partial<{ uid: string; email: string }> = {}) {
  return { uid: 'firebase-uid-001', email: 'admin@school.edu', ...overrides };
}

function makeValidInviteData() {
  return {
    tenantId:    'tenant-001',
    email:       'admin@school.edu',
    role:        'school_admin' as const,
    plan:        'trial' as const,   // required: auth-service uses this to activate tenant
    contactName: 'Ramesh',
    createdAt:   1700000000000,
    updatedAt:   1700000000000,
  };
}

function makeValidProfileData() {
  return {
    email:     'admin@school.edu',
    name:      'Ramesh',
    role:      'school_admin' as const,
    tenantId:  'tenant-001',
    status:    'active' as const,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set the default return values after clearAllMocks
    mockUsersCollection.doc.mockReturnValue(mockUserDocRef);
    mockInvitesCollection.doc.mockReturnValue(mockInviteDocRef);
    mockTenantsCollection.doc.mockReturnValue(mockTenantDocRef);
    mockTenantDocRef.update.mockResolvedValue(undefined);
    // Transaction mock: calls the callback with a tx object that delegates
    // set/delete to the individual doc ref mocks so the existing assertions
    // on mockUserDocRef.set and mockInviteDocRef.delete still work.
    mockRunTransaction.mockImplementation(
      async (fn: (t: { set: typeof vi.fn; delete: typeof vi.fn }) => Promise<unknown>) => {
        const tx = {
          set:    (...args: Parameters<typeof mockUserDocRef.set>)    => mockUserDocRef.set(...args),
          delete: (...args: Parameters<typeof mockInviteDocRef.delete>) => mockInviteDocRef.delete(...args),
        };
        return fn(tx);
      },
    );
    service = new AuthService();
  });

  // -------------------------------------------------------------------------
  // claimInvite
  // -------------------------------------------------------------------------
  describe('claimInvite()', () => {
    it('returns null when no invite exists for the email', async () => {
      mockVerifyIdToken.mockResolvedValue(makeValidDecodedToken());
      mockInviteDocRef.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await service.claimInvite('valid-token');

      expect(result).toBeNull();
    });

    it('creates profile, deletes invite, activates tenant, and returns { uid, role, tenantId }', async () => {
      const decoded = makeValidDecodedToken();
      const invite  = makeValidInviteData();

      mockVerifyIdToken.mockResolvedValue(decoded);
      mockInviteDocRef.get.mockResolvedValue({ exists: true, data: () => invite });
      mockUserDocRef.set.mockResolvedValue(undefined);
      mockInviteDocRef.delete.mockResolvedValue(undefined);

      const result = await service.claimInvite('valid-token');

      expect(mockUserDocRef.set).toHaveBeenCalledOnce();
      expect(mockInviteDocRef.delete).toHaveBeenCalledOnce();
      // Tenant must be activated (pending → trial/active) on invite claim
      expect(mockTenantDocRef.update).toHaveBeenCalledOnce();
      expect(result).toEqual({
        uid:      decoded.uid,
        role:     invite.role,
        tenantId: invite.tenantId,
      });
    });

    it('throws with statusCode 401 when verifyIdToken rejects', async () => {
      const authError = Object.assign(new Error('Token expired'), { code: 'auth/id-token-expired' });
      mockVerifyIdToken.mockRejectedValue(authError);

      await expect(service.claimInvite('bad-token')).rejects.toMatchObject({
        statusCode: 401,
        code:       'INVALID_TOKEN',
      });
    });

    it('throws with statusCode 400 when decoded token has no email', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-001' }); // no email

      await expect(service.claimInvite('token-no-email')).rejects.toMatchObject({
        statusCode: 400,
        code:       'NO_EMAIL',
      });
    });

    it('wraps profile creation and invite deletion in a Firestore transaction', async () => {
      const decoded = makeValidDecodedToken();
      const invite  = makeValidInviteData();

      mockVerifyIdToken.mockResolvedValue(decoded);
      mockInviteDocRef.get.mockResolvedValue({ exists: true, data: () => invite });
      mockUserDocRef.set.mockResolvedValue(undefined);
      mockInviteDocRef.delete.mockResolvedValue(undefined);

      await service.claimInvite('valid-token');

      // Profile write + invite delete must happen inside a single transaction
      expect(mockRunTransaction).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // getProfile
  // -------------------------------------------------------------------------
  describe('getProfile()', () => {
    it('returns null when no profile document exists', async () => {
      mockUserDocRef.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await service.getProfile('unknown-uid');

      expect(result).toBeNull();
    });

    it('returns UserProfile when profile exists', async () => {
      const profileData = makeValidProfileData();
      mockUserDocRef.get.mockResolvedValue({ exists: true, data: () => profileData });

      const result = await service.getProfile('firebase-uid-001');

      expect(result).toMatchObject({
        uid:      'firebase-uid-001',
        email:    'admin@school.edu',
        role:     'school_admin',
        tenantId: 'tenant-001',
        status:   'active',
      });
    });

    it('returns null when profile data does not conform to the schema', async () => {
      mockUserDocRef.get.mockResolvedValue({ exists: true, data: () => ({ invalid: 'data' }) });

      const result = await service.getProfile('firebase-uid-001');

      expect(result).toBeNull();
    });
  });
});
