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
 *   super@saferide.dev        → super_admin   (no tenant)
 *   admin@greenwood.dev       → school_admin  (Greenwood International)
 *   manager@greenwood.dev     → manager       (Greenwood International)
 *   driver@greenwood.dev      → driver        (Greenwood International)
 *   parent@greenwood.dev      → parent        (Greenwood International)
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

const PASSWORD    = 'Dev@SafeRide1';
const TENANT_SLUG = 'greenwood';

const ACCOUNTS = [
  {
    email:    'super@saferide.dev',
    name:     'Super Admin',
    role:     'super_admin' as const,
    tenantId: null,
  },
  {
    email:    'admin@greenwood.dev',
    name:     'Priya Sharma',
    role:     'school_admin' as const,
    tenantId: TENANT_SLUG,
  },
  {
    email:    'manager@greenwood.dev',
    name:     'Ramesh Kumar',
    role:     'manager' as const,
    tenantId: TENANT_SLUG,
  },
  {
    email:    'driver@greenwood.dev',
    name:     'Raju Singh',
    role:     'driver' as const,
    tenantId: TENANT_SLUG,
  },
  {
    email:    'parent@greenwood.dev',
    name:     'Anita Patel',
    role:     'parent' as const,
    tenantId: TENANT_SLUG,
  },
] as const;

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

// ── Step 1: Tenant ─────────────────────────────────────────────────────────────

async function seedTenant(): Promise<string> {
  console.log('\n📦  Tenant');

  const now     = Date.now();
  const payload = {
    name:         'Greenwood International School',
    slug:         TENANT_SLUG,
    city:         'Bengaluru',
    state:        'Karnataka',
    plan:         'trial',
    status:       'active',
    maxBuses:     10,
    maxStudents:  500,
    contactName:  'Priya Sharma',
    contactEmail: 'admin@greenwood.dev',
    contactPhone: '9876543210',
    adminEmail:   'admin@greenwood.dev',
    trialEndsAt:  now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    updatedAt:    now,
  };

  const existing = await db.collection('tenants')
    .where('slug', '==', TENANT_SLUG)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    // Merge latest fields — this is what fixes stale docs missing adminEmail, etc.
    await doc.ref.set({ ...payload }, { merge: true });
    console.log(`  ↑  Tenant synced: ${doc.id}`);
    return doc.id;
  }

  const ref = db.collection('tenants').doc();
  await ref.set({ ...payload, createdAt: now });
  console.log(`  ✓  Tenant created: ${ref.id}`);
  return ref.id;
}

// ── Step 2: User profiles ──────────────────────────────────────────────────────

async function seedUsers(tenantId: string): Promise<Record<string, string>> {
  console.log('\n👥  Users');

  const uids: Record<string, string> = {};
  const now = Date.now();

  for (const account of ACCOUNTS) {
    const uid = await findOrCreateAuthUser(account.email, account.name);
    uids[account.role] = uid;

    const resolvedTenantId = account.tenantId === TENANT_SLUG ? tenantId : null;

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

// ── Step 3: Bus ────────────────────────────────────────────────────────────────

async function seedBus(tenantId: string): Promise<string> {
  console.log('\n🚌  Bus');

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

// ── Step 4: Route + Stops ──────────────────────────────────────────────────────

async function seedRoute(tenantId: string): Promise<{ routeId: string; stopId: string }> {
  console.log('\n🗺   Route + Stops');

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

  // Stops
  const stops = [
    { name: 'Koramangala 4th Block',  sequence: 1, lat: 12.9352, lon: 77.6244, estimatedOffsetMinutes: 0  },
    { name: 'HSR Layout Sector 2',    sequence: 2, lat: 12.9116, lon: 77.6389, estimatedOffsetMinutes: 8  },
    { name: 'Indiranagar 100ft Road', sequence: 3, lat: 12.9784, lon: 77.6408, estimatedOffsetMinutes: 20 },
  ];

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

// ── Step 5: Driver document ────────────────────────────────────────────────────

async function seedDriver(
  tenantId:  string,
  driverUid: string,
  busId:     string,
  routeId:   string,
): Promise<void> {
  console.log('\n🧑‍✈️   Driver');

  const now     = Date.now();
  const payload = {
    tenantId,
    firebaseUid:   driverUid,
    email:         'driver@greenwood.dev',
    name:          'Raju Singh',
    phone:         '9876500001',
    licenseNumber: 'KA-0120220012345',
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

// ── Step 6: Student document ───────────────────────────────────────────────────

async function seedStudent(
  tenantId:  string,
  parentUid: string,
  busId:     string,
  stopId:    string,
): Promise<void> {
  console.log('\n🎒  Student');

  const now     = Date.now();
  const payload = {
    tenantId,
    name:              'Arjun Patel',
    parentFirebaseUid: parentUid,
    parentName:        'Anita Patel',
    parentPhone:       '9876500002',
    parentEmail:       'parent@greenwood.dev',
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

async function wireBusRoute(busId: string, routeId: string): Promise<void> {
  console.log('\n🔗  Wiring bus → route');
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
  console.log('━'.repeat(48));

  const tenantId            = await seedTenant();
  const uids                = await seedUsers(tenantId);
  const busId               = await seedBus(tenantId);
  const { routeId, stopId } = await seedRoute(tenantId);

  const driverUid = uids['driver'];
  const parentUid = uids['parent'];
  if (!driverUid || !parentUid) throw new Error('Driver or parent UID missing');

  await seedDriver(tenantId, driverUid, busId, routeId);
  await seedStudent(tenantId, parentUid, busId, stopId);
  await wireBusRoute(busId, routeId);

  console.log('\n' + '━'.repeat(48));
  console.log('✅  Seed complete!\n');
  console.log('Accounts (all passwords: Dev@SafeRide1)');
  console.log('─'.repeat(48));
  console.log('  super@saferide.dev      → super_admin');
  console.log('  admin@greenwood.dev     → school_admin');
  console.log('  manager@greenwood.dev   → manager');
  console.log('  driver@greenwood.dev    → driver');
  console.log('  parent@greenwood.dev    → parent');
  console.log('─'.repeat(48));
  console.log(`  Tenant ID: ${tenantId}`);
  console.log(`  Bus ID:    ${busId}`);
  console.log(`  Route ID:  ${routeId}`);
  console.log('');
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', (err as Error).message);
  process.exit(1);
});
