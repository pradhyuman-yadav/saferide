/**
 * Firebase mock helpers for integration and security tests.
 *
 * Usage:
 *   vi.mock('@saferide/firebase-admin', () => buildFirebaseMock());
 *
 * Then call configureFirebaseUser() / configureFirebaseTenant() in beforeEach
 * to control what verifyJwt sees.
 */

export interface MockUserProfile {
  uid:       string;
  email:     string;
  name:      string;
  role:      'super_admin' | 'school_admin' | 'manager' | 'driver' | 'parent';
  tenantId:  string | null;
  status:    'active' | 'invited' | 'suspended';
  createdAt: number;
  updatedAt: number;
}

export interface MockTenant {
  status:      'active' | 'trial' | 'suspended' | 'cancelled';
  trialEndsAt?: number | null;
}

// Mutable state shared between the factory and the configure helpers
let _user: MockUserProfile = {
  uid:       'test-uid',
  email:     'test@example.com',
  name:      'Test User',
  role:      'school_admin',
  tenantId:  'tenant-001',
  status:    'active',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

let _tenant: MockTenant = { status: 'active' };

export function configureFirebaseUser(user: Partial<MockUserProfile>): void {
  _user = { ..._user, ...user };
}

export function configureFirebaseTenant(tenant: MockTenant): void {
  _tenant = tenant;
}

export function resetFirebaseMock(): void {
  _user   = { uid: 'test-uid', email: 'test@example.com', name: 'Test User', role: 'school_admin', tenantId: 'tenant-001', status: 'active', createdAt: 1700000000000, updatedAt: 1700000000000 };
  _tenant = { status: 'active' };
}

/** Returns the current mocked uid — used by integration tests to assert call args */
export function getMockUid(): string { return _user.uid; }
export function getMockTenantId(): string { return _user.tenantId ?? ''; }

/**
 * Call this inside vi.mock('@saferide/firebase-admin', () => buildFirebaseMock())
 * to set up a fully functional Firebase mock for tests.
 */
export function buildFirebaseMock() {
  return {
    initFirebaseAdmin: () => undefined,
    getRtdb:          () => ({ ref: () => ({ set: async () => undefined, remove: async () => undefined }) }),
    getAdminAuth: () => ({
      verifyIdToken: async (_token: string) => ({ uid: _user.uid, email: _user.email }),
    }),
    getDb: () => ({
      collection: (name: string) => {
        // users/{uid}.get() — used by verifyJwt to load the user profile
        if (name === 'users') {
          return {
            doc: (_uid: string) => ({
              get: async () => ({
                exists: true,
                data:   () => ({ ..._user }),
              }),
            }),
            where: () => ({ where: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
          };
        }

        // tenants/{id}.get() — used by verifyJwt tenant-level gate
        if (name === 'tenants') {
          return {
            doc: (_id: string) => ({
              get: async () => ({
                exists: true,
                data:   () => ({ ..._tenant }),
              }),
            }),
          };
        }

        // Default: empty collection (buses, routes, stops, drivers, students)
        const chainable = {
          where: function() { return this; },
          orderBy: function() { return this; },
          limit: function() { return this; },
          get:   async () => ({ empty: true, docs: [] }),
          doc:   (_id: string) => ({
            get:    async () => ({ exists: false, data: () => undefined }),
            set:    async () => undefined,
            update: async () => undefined,
            delete: async () => undefined,
          }),
          add: async () => ({ id: 'new-doc-id' }),
        };
        return chainable;
      },
      batch: () => ({
        set:    () => undefined,
        update: () => undefined,
        delete: () => undefined,
        commit: async () => undefined,
      }),
      runTransaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    }),
  };
}
