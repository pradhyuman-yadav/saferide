/**
 * Firebase mock helpers for livetrack-gateway integration and security tests.
 *
 * The WebSocket auth flow calls:
 *   1. getAdminAuth().verifyIdToken(token)
 *   2. getDb().collection('users').doc(uid).get()
 *
 * After auth, subscribe() calls:
 *   3. getDb().collection('trips').where(...).where(...).where(...).limit(1).get()
 *   4. getDb().collection('trips').doc(tripId).onSnapshot(callback)
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

let _user: MockUserProfile = {
  uid:       'parent-uid',
  email:     'parent@example.com',
  name:      'Test Parent',
  role:      'parent',
  tenantId:  'tenant-001',
  status:    'active',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

// Controls whether verifyIdToken succeeds
let _tokenValid = true;

// Controls what the trips query returns
let _activeTrip: { id: string; data: Record<string, unknown> } | null = null;

// Captured onSnapshot callback — tests call this to push Firestore updates
let _onSnapshotCallback: ((snap: unknown) => void) | null = null;
let _onSnapshotUnsubscribe = () => { _onSnapshotCallback = null; };

export function configureFirebaseUser(user: Partial<MockUserProfile>): void {
  _user = { ..._user, ...user };
}

export function setTokenValid(valid: boolean): void {
  _tokenValid = valid;
}

export function setActiveTrip(trip: { id: string; data: Record<string, unknown> } | null): void {
  _activeTrip = trip;
}

/** Simulate a Firestore real-time update arriving at the subscribed trip document. */
export function pushTripSnapshot(data: Record<string, unknown>): void {
  _onSnapshotCallback?.({
    exists: true,
    data:   () => data,
  });
}

export function resetFirebaseMock(): void {
  _user = {
    uid:       'parent-uid',
    email:     'parent@example.com',
    name:      'Test Parent',
    role:      'parent',
    tenantId:  'tenant-001',
    status:    'active',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
  _tokenValid          = true;
  _activeTrip          = null;
  _onSnapshotCallback  = null;
}

export function buildFirebaseMock() {
  return {
    initFirebaseAdmin: () => undefined,

    getAdminAuth: () => ({
      verifyIdToken: async (_token: string) => {
        if (!_tokenValid) throw new Error('Token invalid');
        return { uid: _user.uid, email: _user.email };
      },
    }),

    getDb: () => ({
      collection: (name: string) => {
        if (name === 'users') {
          return {
            doc: (_uid: string) => ({
              get: async () => ({
                exists: true,
                data:   () => ({ ..._user }),
              }),
            }),
          };
        }

        if (name === 'trips') {
          // Chainable query builder
          const chainable = {
            where: function() { return this; },
            limit: function() { return this; },
            get: async () => {
              if (_activeTrip === null) {
                return { empty: true, docs: [] };
              }
              return {
                empty: false,
                docs: [{
                  id:   _activeTrip.id,
                  data: () => _activeTrip!.data,
                }],
              };
            },
            doc: (_id: string) => ({
              onSnapshot: (cb: (snap: unknown) => void) => {
                _onSnapshotCallback = cb;
                return _onSnapshotUnsubscribe;
              },
            }),
          };
          return chainable;
        }

        // Default empty collection
        const chainable = {
          where:   function() { return this; },
          orderBy: function() { return this; },
          limit:   function() { return this; },
          get:     async () => ({ empty: true, docs: [] }),
          doc:     (_id: string) => ({
            get:         async () => ({ exists: false, data: () => undefined }),
            onSnapshot:  (cb: (snap: unknown) => void) => {
              _onSnapshotCallback = cb;
              return () => undefined;
            },
          }),
        };
        return chainable;
      },
    }),
  };
}
