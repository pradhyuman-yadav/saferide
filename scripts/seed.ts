/**
 * scripts/seed.ts
 *
 * Creates one dev account for every role, plus a full set of supporting data
 * (tenant, bus, route, stops, driver, student) so every screen in the app and
 * web-admin has real data to display immediately.
 *
 * HOW IT WORKS
 * ------------
 * Bypasses the invite flow entirely — uses the Admin SDK to create Auth users
 * and Firestore documents directly.  This is intentional: the invite + email
 * flow is for production; the seed script is for development.
 *
 * IDEMPOTENT + SELF-HEALING
 * -------------------------
 * Safe to run multiple times. Each resource is looked up before writing:
 *   - Auth user   → looked up by email; skipped if already exists
 *   - Firestore   → looked up by path / query field; UPSERTED every run
 *
 * "Upsert" means: if the document already exists, all fields are merged with
 * the values below so stale / incomplete docs are always brought up to date.
 * Re-running `pnpm seed` is the fix for any corrupted or missing seed data.
 *
 * USAGE
 * -----
 *   cp scripts/.env.example scripts/.env   # fill in service account + DB URL
 *   pnpm seed
 *
 * ACCOUNTS CREATED
 * ----------------
 *   super@saferide.dev           → super_admin   (no tenant)
 *
 *   — Greenwood International School (Bengaluru, KA) —
 *   admin@greenwood.dev          → school_admin
 *   manager@greenwood.dev        → manager
 *   driver@greenwood.dev         → driver
 *   parent@greenwood.dev         → parent
 *
 *   — Fremont Hills Academy (Fremont, CA) —
 *   admin@fremontacademy.dev     → school_admin
 *   manager@fremontacademy.dev   → manager
 *   driver@fremontacademy.dev    → driver
 *   parent@fremontacademy.dev    → parent
 *
 *   All passwords: Dev@SafeRide1
 */

import * as admin from 'firebase-admin';

// ── Bootstrap Firebase Admin ───────────────────────────────────────────────────

const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
const databaseURL         = process.env['FIREBASE_DATABASE_URL'];

if (!serviceAccountJson) {
  console.error('❌  FIREBASE_SERVICE_ACCOUNT_JSON is required');
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
admin.initializeApp({
  credential:  admin.credential.cert(serviceAccount),
  databaseURL: databaseURL ?? undefined,
});

const auth = admin.auth();
const db   = admin.firestore();

// ── Constants ──────────────────────────────────────────────────────────────────

const PASSWORD = 'Dev@SafeRide1';

// ── Account definitions ────────────────────────────────────────────────────────

type Role = 'super_admin' | 'school_admin' | 'manager' | 'driver' | 'parent';

interface AccountDef {
  email:    string;
  name:     string;
  role:     Role;
  /** null = super_admin (no tenant) */
  tenantSlug: string | null;
}

const SUPER_ACCOUNT: AccountDef = {
  email:      'super@saferide.dev',
  name:       'Super Admin',
  role:       'super_admin',
  tenantSlug: null,
};

// ── Tenant 1: Greenwood International School ───────────────────────────────────

const GREENWOOD_SLUG = 'greenwood';

const GREENWOOD_ACCOUNTS: AccountDef[] = [
  { email: 'admin@greenwood.dev',   name: 'Priya Sharma', role: 'school_admin', tenantSlug: GREENWOOD_SLUG },
  { email: 'manager@greenwood.dev', name: 'Ramesh Kumar', role: 'manager',      tenantSlug: GREENWOOD_SLUG },
  { email: 'driver@greenwood.dev',  name: 'Raju Singh',   role: 'driver',       tenantSlug: GREENWOOD_SLUG },
  { email: 'parent@greenwood.dev',  name: 'Anita Patel',  role: 'parent',       tenantSlug: GREENWOOD_SLUG },
];

// ── Tenant 2: Fremont Hills Academy ───────────────────────────────────────────

const FREMONT_SLUG = 'fremont-hills';

const FREMONT_ACCOUNTS: AccountDef[] = [
  { email: 'admin@fremontacademy.dev',   name: 'Sarah Mitchell',  role: 'school_admin', tenantSlug: FREMONT_SLUG },
  { email: 'manager@fremontacademy.dev', name: 'David Chen',      role: 'manager',      tenantSlug: FREMONT_SLUG },
  { email: 'driver@fremontacademy.dev',  name: 'Marcus Johnson',  role: 'driver',       tenantSlug: FREMONT_SLUG },
  { email: 'parent@fremontacademy.dev',  name: 'Jennifer Torres', role: 'parent',       tenantSlug: FREMONT_SLUG },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

async function findOrCreateAuthUser(email: string, name: string): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  ↩  Auth user exists: ${email}`);
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email, password: PASSWORD, displayName: name });
    console.log(`  ✓  Auth user created: ${email}`);
    return created.uid;
  }
}

/**
 * Upsert a document at a known path.
 * - If it doesn't exist → create it with the supplied data.
 * - If it already exists → merge the supplied data in, keeping any extra
 *   fields already stored (and always refreshing updatedAt).
 * This ensures re-running the seed fixes stale / incomplete documents.
 */
async function upsertDoc(
  ref:  FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>,
): Promise<void> {
  const snap = await ref.get();
  if (snap.exists) {
    await ref.set({ ...data, updatedAt: Date.now() }, { merge: true });
    console.log(`  ↑  Doc synced:  ${ref.path}`);
  } else {
    await ref.set(data);
    console.log(`  ✓  Doc created: ${ref.path}`);
  }
}

// ── Generic seeders ────────────────────────────────────────────────────────────

/**
 * Seed Auth + Firestore user profiles for a list of accounts.
 * Returns a map of role → Firebase UID for accounts in the supplied list.
 * The super_admin is seeded once separately and not included in per-tenant maps.
 */
async function seedUsers(
  accounts:  AccountDef[],
  tenantId:  string,
  tenantSlug: string,
): Promise<Record<string, string>> {
  const uids: Record<string, string> = {};
  const now = Date.now();

  for (const account of accounts) {
    const uid = await findOrCreateAuthUser(account.email, account.name);
    uids[account.role] = uid;

    const resolvedTenantId = account.tenantSlug === tenantSlug ? tenantId : null;

    await upsertDoc(db.collection('users').doc(uid), {
      uid,
      email:     account.email,
      name:      account.name,
      role:      account.role,
      tenantId:  resolvedTenantId,
      status:    'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  return uids;
}

// ── Step 1A: Greenwood tenant ──────────────────────────────────────────────────

async function seedGreenwoodTenant(): Promise<string> {
  console.log('\n📦  Tenant — Greenwood International School');

  const now     = Date.now();
  const payload = {
    name:         'Greenwood International School',
    slug:         GREENWOOD_SLUG,
    city:         'Bengaluru',
    state:        'Karnataka',
    country:      'IN',
    plan:         'trial',
    status:       'trial',
    maxBuses:     10,
    maxStudents:  500,
    contactName:  'Priya Sharma',
    contactEmail: 'admin@greenwood.dev',
    contactPhone: '9876543210',
    adminEmail:   'admin@greenwood.dev',
    trialEndsAt:  now + 30 * 24 * 60 * 60 * 1000,
    updatedAt:    now,
  };

  const existing = await db.collection('tenants')
    .where('slug', '==', GREENWOOD_SLUG)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({ ...payload }, { merge: true });
    console.log(`  ↑  Tenant synced: ${doc.id}`);
    return doc.id;
  }

  const ref = db.collection('tenants').doc();
  await ref.set({ ...payload, createdAt: now });
  console.log(`  ✓  Tenant created: ${ref.id}`);
  return ref.id;
}

// ── Step 1B: Fremont tenant ────────────────────────────────────────────────────

async function seedFremontTenant(): Promise<string> {
  console.log('\n📦  Tenant — Fremont Hills Academy');

  const now     = Date.now();
  const payload = {
    name:         'Fremont Hills Academy',
    slug:         FREMONT_SLUG,
    city:         'Fremont',
    state:        'California',
    country:      'US',
    plan:         'trial',
    status:       'trial',
    maxBuses:     10,
    maxStudents:  500,
    contactName:  'Sarah Mitchell',
    contactEmail: 'admin@fremontacademy.dev',
    contactPhone: '5105550198',
    adminEmail:   'admin@fremontacademy.dev',
    trialEndsAt:  now + 30 * 24 * 60 * 60 * 1000,
    updatedAt:    now,
  };

  const existing = await db.collection('tenants')
    .where('slug', '==', FREMONT_SLUG)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({ ...payload }, { merge: true });
    console.log(`  ↑  Tenant synced: ${doc.id}`);
    return doc.id;
  }

  const ref = db.collection('tenants').doc();
  await ref.set({ ...payload, createdAt: now });
  console.log(`  ✓  Tenant created: ${ref.id}`);
  return ref.id;
}

// ── Step 3A: Greenwood bus ─────────────────────────────────────────────────────

async function seedGreenwoodBus(tenantId: string): Promise<string> {
  console.log('\n🚌  Bus — Greenwood');

  const now     = Date.now();
  const payload = {
    tenantId,
    registrationNumber: 'KA-01-AB-1234',
    make:               'Tata',
    model:              'Starbus',
    year:               2022,
    capacity:           40,
    status:             'active',
    updatedAt:          now,
  };

  const existing = await db.collection('buses')
    .where('tenantId', '==', tenantId)
    .where('registrationNumber', '==', 'KA-01-AB-1234')
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({ ...payload }, { merge: true });
    console.log(`  ↑  Bus synced: ${doc.id}`);
    return doc.id;
  }

  const ref = db.collection('buses').doc();
  await ref.set({ ...payload, driverId: null, routeId: null, createdAt: now });
  console.log(`  ✓  Bus created: ${ref.id}`);
  return ref.id;
}

// ── Step 3B: Fremont bus ───────────────────────────────────────────────────────

async function seedFremontBus(tenantId: string): Promise<string> {
  console.log('\n🚌  Bus — Fremont');

  const now     = Date.now();
  const payload = {
    tenantId,
    registrationNumber: '7XTR234',  // California plate format
    make:               'Blue Bird',
    model:              'Vision',
    year:               2023,
    capacity:           48,
    status:             'active',
    updatedAt:          now,
  };

  const existing = await db.collection('buses')
    .where('tenantId', '==', tenantId)
    .where('registrationNumber', '==', '7XTR234')
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({ ...payload }, { merge: true });
    console.log(`  ↑  Bus synced: ${doc.id}`);
    return doc.id;
  }

  const ref = db.collection('buses').doc();
  await ref.set({ ...payload, driverId: null, routeId: null, createdAt: now });
  console.log(`  ✓  Bus created: ${ref.id}`);
  return ref.id;
}

// ── Step 4A: Greenwood route + stops ──────────────────────────────────────────

async function seedGreenwoodRoute(tenantId: string): Promise<{ routeId: string; stopId: string }> {
  console.log('\n🗺   Route + Stops — Greenwood');

  const now = Date.now();

  const existing = await db.collection('routes')
    .where('tenantId', '==', tenantId)
    .where('name', '==', 'Morning Route A')
    .limit(1)
    .get();

  let routeId: string;

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({
      tenantId,
      name:        'Morning Route A',
      description: 'Covers Koramangala, HSR Layout, and Indiranagar',
      isActive:    true,
      updatedAt:   now,
    }, { merge: true });
    routeId = doc.id;
    console.log(`  ↑  Route synced: ${routeId}`);
  } else {
    const ref = db.collection('routes').doc();
    await ref.set({
      tenantId,
      name:        'Morning Route A',
      description: 'Covers Koramangala, HSR Layout, and Indiranagar',
      isActive:    true,
      createdAt:   now,
      updatedAt:   now,
    });
    routeId = ref.id;
    console.log(`  ✓  Route created: ${routeId}`);
  }

  const stops = [
    { name: 'Koramangala 4th Block',  sequence: 1, lat: 12.9352, lon: 77.6244, estimatedOffsetMinutes: 0  },
    { name: 'HSR Layout Sector 2',    sequence: 2, lat: 12.9116, lon: 77.6389, estimatedOffsetMinutes: 8  },
    { name: 'Indiranagar 100ft Road', sequence: 3, lat: 12.9784, lon: 77.6408, estimatedOffsetMinutes: 20 },
  ];

  return seedStops(tenantId, routeId, stops, now);
}

// ── Step 4B: Fremont route + stops ────────────────────────────────────────────

async function seedFremontRoute(tenantId: string): Promise<{ routeId: string; stopId: string }> {
  console.log('\n🗺   Route + Stops — Fremont');

  const now = Date.now();

  const existing = await db.collection('routes')
    .where('tenantId', '==', tenantId)
    .where('name', '==', 'Mission Boulevard Express')
    .limit(1)
    .get();

  let routeId: string;

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({
      tenantId,
      name:        'Mission Boulevard Express',
      description: 'Covers Mission San Jose, Irvington, and Centerville along Mission Blvd',
      isActive:    true,
      updatedAt:   now,
    }, { merge: true });
    routeId = doc.id;
    console.log(`  ↑  Route synced: ${routeId}`);
  } else {
    const ref = db.collection('routes').doc();
    await ref.set({
      tenantId,
      name:        'Mission Boulevard Express',
      description: 'Covers Mission San Jose, Irvington, and Centerville along Mission Blvd',
      isActive:    true,
      createdAt:   now,
      updatedAt:   now,
    });
    routeId = ref.id;
    console.log(`  ✓  Route created: ${routeId}`);
  }

  // Real Fremont, CA coordinates along the Mission Blvd / Paseo Padre corridor
  const stops = [
    { name: 'Mission San Jose Park & Ride', sequence: 1, lat: 37.5247, lon: -121.9194, estimatedOffsetMinutes: 0  },
    { name: 'Irvington BART Station',       sequence: 2, lat: 37.5238, lon: -121.9588, estimatedOffsetMinutes: 10 },
    { name: 'Fremont Hills Academy',        sequence: 3, lat: 37.5395, lon: -121.9790, estimatedOffsetMinutes: 22 },
  ];

  return seedStops(tenantId, routeId, stops, now);
}

// ── Shared: upsert stops for a route ─────────────────────────────────────────

async function seedStops(
  tenantId: string,
  routeId:  string,
  stops:    { name: string; sequence: number; lat: number; lon: number; estimatedOffsetMinutes: number }[],
  now:      number,
): Promise<{ routeId: string; stopId: string }> {
  let firstStopId = '';

  for (const stop of stops) {
    const stopPayload = {
      tenantId,
      routeId,
      name:                   stop.name,
      sequence:               stop.sequence,
      lat:                    stop.lat,
      lon:                    stop.lon,
      estimatedOffsetMinutes: stop.estimatedOffsetMinutes,
      updatedAt:              now,
    };

    const existingStop = await db.collection('stops')
      .where('tenantId', '==', tenantId)
      .where('routeId',  '==', routeId)
      .where('sequence', '==', stop.sequence)
      .limit(1)
      .get();

    if (!existingStop.empty) {
      const doc = existingStop.docs[0]!;
      await doc.ref.set({ ...stopPayload }, { merge: true });
      if (stop.sequence === 1) firstStopId = doc.id;
      console.log(`  ↑  Stop synced: ${stop.name}`);
    } else {
      const ref = db.collection('stops').doc();
      await ref.set({ ...stopPayload, createdAt: now });
      if (stop.sequence === 1) firstStopId = ref.id;
      console.log(`  ✓  Stop created: ${stop.name}`);
    }
  }

  return { routeId, stopId: firstStopId };
}

// ── Step 5: Driver document (generic) ─────────────────────────────────────────

async function seedDriver(opts: {
  tenantId:      string;
  driverUid:     string;
  email:         string;
  name:          string;
  phone:         string;
  licenseNumber: string;
  busId:         string;
  routeId:       string;
}): Promise<void> {
  const { tenantId, driverUid, email, name, phone, licenseNumber, busId, routeId } = opts;
  const now     = Date.now();
  const payload = {
    tenantId,
    firebaseUid:   driverUid,
    email,
    name,
    phone,
    licenseNumber,
    busId,
    isActive:      true,
    updatedAt:     now,
  };

  const existing = await db.collection('drivers')
    .where('tenantId',    '==', tenantId)
    .where('firebaseUid', '==', driverUid)
    .limit(1)
    .get();

  let driverDocId: string;

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({ ...payload }, { merge: true });
    driverDocId = doc.id;
    console.log(`  ↑  Driver doc synced: ${driverDocId}`);
  } else {
    const ref = db.collection('drivers').doc();
    await ref.set({ ...payload, createdAt: now });
    driverDocId = ref.id;
    console.log(`  ✓  Driver doc created: ${driverDocId}`);
  }

  // Keep bus.driverId in sync
  await db.collection('buses').doc(busId).update({ driverId: driverDocId, updatedAt: now });

  // Write assignedBusId + assignedRouteId onto the users doc so the mobile
  // auth store (which reads only from `users`) can resolve the assignment.
  await db.collection('users').doc(driverUid).set(
    { assignedBusId: busId, assignedRouteId: routeId, updatedAt: now },
    { merge: true },
  );
  console.log(`  ✓  users/${driverUid} → assignedBusId + assignedRouteId synced`);
}

// ── Step 6: Student document (generic) ────────────────────────────────────────

async function seedStudent(opts: {
  tenantId:    string;
  parentUid:   string;
  studentName: string;
  parentName:  string;
  parentPhone: string;
  parentEmail: string;
  busId:       string;
  stopId:      string;
}): Promise<void> {
  const { tenantId, parentUid, studentName, parentName, parentPhone, parentEmail, busId, stopId } = opts;
  const now     = Date.now();
  const payload = {
    tenantId,
    name:              studentName,
    parentFirebaseUid: parentUid,
    parentName,
    parentPhone,
    parentEmail,
    busId,
    stopId,
    isActive:          true,
    updatedAt:         now,
  };

  const existing = await db.collection('students')
    .where('tenantId',          '==', tenantId)
    .where('parentFirebaseUid', '==', parentUid)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    await doc.ref.set({ ...payload }, { merge: true });
    console.log(`  ↑  Student doc synced: ${doc.id}`);
  } else {
    const ref = db.collection('students').doc();
    await ref.set({ ...payload, createdAt: now });
    console.log(`  ✓  Student doc created: ${ref.id}`);
  }
}

// ── Step 7: Wire bus ↔ route ───────────────────────────────────────────────────

async function wireBusRoute(busId: string, routeId: string, label: string): Promise<void> {
  console.log(`\n🔗  Wiring bus → route (${label})`);
  const bus = await db.collection('buses').doc(busId).get();
  if (bus.data()?.routeId === routeId) {
    console.log('  ↩  Already wired');
    return;
  }
  await db.collection('buses').doc(busId).update({ routeId, updatedAt: Date.now() });
  console.log('  ✓  Bus wired to route');
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱  SafeRide seed script\n');
  console.log('━'.repeat(56));

  // ── Super admin (shared, no tenant) ─────────────────────────────────────────
  console.log('\n👤  Super Admin');
  await findOrCreateAuthUser(SUPER_ACCOUNT.email, SUPER_ACCOUNT.name);
  const superUid = (await auth.getUserByEmail(SUPER_ACCOUNT.email)).uid;
  await upsertDoc(db.collection('users').doc(superUid), {
    uid:       superUid,
    email:     SUPER_ACCOUNT.email,
    name:      SUPER_ACCOUNT.name,
    role:      SUPER_ACCOUNT.role,
    tenantId:  null,
    status:    'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // ── Greenwood ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(56));
  console.log('🏫  GREENWOOD INTERNATIONAL SCHOOL  (Bengaluru, KA)');
  console.log('─'.repeat(56));

  const greenwoodTenantId            = await seedGreenwoodTenant();
  console.log('\n👥  Users — Greenwood');
  const greenwoodUids                = await seedUsers(GREENWOOD_ACCOUNTS, greenwoodTenantId, GREENWOOD_SLUG);
  const greenwoodBusId               = await seedGreenwoodBus(greenwoodTenantId);
  const { routeId: greenwoodRouteId,
          stopId:  greenwoodStopId } = await seedGreenwoodRoute(greenwoodTenantId);

  const greenwoodDriverUid = greenwoodUids['driver'];
  const greenwoodParentUid = greenwoodUids['parent'];
  if (!greenwoodDriverUid || !greenwoodParentUid) throw new Error('Greenwood driver or parent UID missing');

  console.log('\n🧑‍✈️   Driver — Greenwood');
  await seedDriver({
    tenantId:      greenwoodTenantId,
    driverUid:     greenwoodDriverUid,
    email:         'driver@greenwood.dev',
    name:          'Raju Singh',
    phone:         '9876500001',
    licenseNumber: 'KA-0120220012345',
    busId:         greenwoodBusId,
    routeId:       greenwoodRouteId,
  });

  console.log('\n🎒  Student — Greenwood');
  await seedStudent({
    tenantId:    greenwoodTenantId,
    parentUid:   greenwoodParentUid,
    studentName: 'Arjun Patel',
    parentName:  'Anita Patel',
    parentPhone: '9876500002',
    parentEmail: 'parent@greenwood.dev',
    busId:       greenwoodBusId,
    stopId:      greenwoodStopId,
  });

  await wireBusRoute(greenwoodBusId, greenwoodRouteId, 'Greenwood');

  // ── Fremont ──────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(56));
  console.log('🏫  FREMONT HILLS ACADEMY  (Fremont, CA)');
  console.log('─'.repeat(56));

  const fremontTenantId            = await seedFremontTenant();
  console.log('\n👥  Users — Fremont');
  const fremontUids                = await seedUsers(FREMONT_ACCOUNTS, fremontTenantId, FREMONT_SLUG);
  const fremontBusId               = await seedFremontBus(fremontTenantId);
  const { routeId: fremontRouteId,
          stopId:  fremontStopId } = await seedFremontRoute(fremontTenantId);

  const fremontDriverUid = fremontUids['driver'];
  const fremontParentUid = fremontUids['parent'];
  if (!fremontDriverUid || !fremontParentUid) throw new Error('Fremont driver or parent UID missing');

  console.log('\n🧑‍✈️   Driver — Fremont');
  await seedDriver({
    tenantId:      fremontTenantId,
    driverUid:     fremontDriverUid,
    email:         'driver@fremontacademy.dev',
    name:          'Marcus Johnson',
    phone:         '5105550101',
    licenseNumber: 'CA-F3948271',
    busId:         fremontBusId,
    routeId:       fremontRouteId,
  });

  console.log('\n🎒  Student — Fremont');
  await seedStudent({
    tenantId:    fremontTenantId,
    parentUid:   fremontParentUid,
    studentName: 'Ethan Torres',
    parentName:  'Jennifer Torres',
    parentPhone: '5105550202',
    parentEmail: 'parent@fremontacademy.dev',
    busId:       fremontBusId,
    stopId:      fremontStopId,
  });

  await wireBusRoute(fremontBusId, fremontRouteId, 'Fremont');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(56));
  console.log('✅  Seed complete!\n');

  console.log('Accounts (all passwords: Dev@SafeRide1)');
  console.log('─'.repeat(56));
  console.log('  super@saferide.dev           → super_admin');
  console.log('');
  console.log('  Greenwood International School (Bengaluru, KA)');
  console.log('  admin@greenwood.dev          → school_admin');
  console.log('  manager@greenwood.dev        → manager');
  console.log('  driver@greenwood.dev         → driver');
  console.log('  parent@greenwood.dev         → parent');
  console.log('');
  console.log('  Fremont Hills Academy (Fremont, CA)');
  console.log('  admin@fremontacademy.dev     → school_admin');
  console.log('  manager@fremontacademy.dev   → manager');
  console.log('  driver@fremontacademy.dev    → driver');
  console.log('  parent@fremontacademy.dev    → parent');
  console.log('─'.repeat(56));
  console.log(`  Greenwood Tenant ID: ${greenwoodTenantId}`);
  console.log(`  Greenwood Bus ID:    ${greenwoodBusId}`);
  console.log(`  Greenwood Route ID:  ${greenwoodRouteId}`);
  console.log('');
  console.log(`  Fremont Tenant ID:   ${fremontTenantId}`);
  console.log(`  Fremont Bus ID:      ${fremontBusId}`);
  console.log(`  Fremont Route ID:    ${fremontRouteId}`);
  console.log('');
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', (err as Error).message);
  process.exit(1);
});
