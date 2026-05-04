/**
 * scripts/create-superadmin.ts
 *
 * Creates (or updates) a single super_admin account in Firebase Auth + Firestore.
 * Safe to run multiple times — idempotent.
 *
 * USAGE
 * -----
 *   pnpm create-superadmin
 *
 *   Override defaults via CLI flags:
 *   pnpm create-superadmin --email you@example.com --name "Your Name" --password "Str0ng!Pass"
 *
 * DEFAULTS (if flags not supplied)
 * ---------------------------------
 *   email    : admin@saferide.in
 *   name     : Super Admin
 *   password : (auto-prompted — you must supply --password or SUPER_ADMIN_PASSWORD env var)
 *
 * ENV VARS (read from scripts/.env via `tsx --env-file`)
 * -------------------------------------------------------
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — required
 *   FIREBASE_DATABASE_URL          — optional
 *   SUPER_ADMIN_EMAIL              — overridden by --email flag
 *   SUPER_ADMIN_NAME               — overridden by --name flag
 *   SUPER_ADMIN_PASSWORD           — overridden by --password flag
 */

import * as admin from 'firebase-admin';

// ── Parse CLI flags ────────────────────────────────────────────────────────────

function flag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const EMAIL    = flag('email')    ?? process.env['SUPER_ADMIN_EMAIL']    ?? 'admin@saferide.in';
const NAME     = flag('name')     ?? process.env['SUPER_ADMIN_NAME']     ?? 'Super Admin';
const PASSWORD = flag('password') ?? process.env['SUPER_ADMIN_PASSWORD'];

if (!PASSWORD) {
  console.error(
    '\n❌  Password is required.\n' +
    '    Pass it as a flag:  --password "Str0ng!Pass"\n' +
    '    Or as an env var:   SUPER_ADMIN_PASSWORD="Str0ng!Pass" pnpm create-superadmin\n',
  );
  process.exit(1);
}

if (PASSWORD.length < 8) {
  console.error('\n❌  Password must be at least 8 characters.\n');
  process.exit(1);
}

// ── Bootstrap Firebase Admin ───────────────────────────────────────────────────

const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
const databaseURL         = process.env['FIREBASE_DATABASE_URL'];

if (!serviceAccountJson) {
  console.error(
    '\n❌  FIREBASE_SERVICE_ACCOUNT_JSON is required.\n' +
    '    Copy scripts/.env.example → scripts/.env and fill in the value.\n',
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

admin.initializeApp({
  credential:  admin.credential.cert(serviceAccount),
  databaseURL: databaseURL ?? undefined,
});

const auth = admin.auth();
const db   = admin.firestore();

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🔐  SafeRide — Create Super Admin');
  console.log('━'.repeat(48));
  console.log(`  Project : ${(serviceAccount as Record<string, unknown>)['project_id'] ?? 'unknown'}`);
  console.log(`  Email   : ${EMAIL}`);
  console.log(`  Name    : ${NAME}`);
  console.log('━'.repeat(48));

  const now = Date.now();

  // ── Step 1: Firebase Auth user ─────────────────────────────────────────────

  let uid: string;

  try {
    const existing = await auth.getUserByEmail(EMAIL);
    uid = existing.uid;

    // Update password and display name in case they changed
    await auth.updateUser(uid, {
      password:    PASSWORD,
      displayName: NAME,
    });

    console.log(`\n  ↩  Auth user already exists → updated password + displayName`);
    console.log(`     UID: ${uid}`);
  } catch (err: unknown) {
    const fbErr = err as { code?: string };
    if (fbErr.code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email:       EMAIL,
        password:    PASSWORD,
        displayName: NAME,
      });
      uid = created.uid;
      console.log(`\n  ✓  Auth user created`);
      console.log(`     UID: ${uid}`);
    } else {
      throw err;
    }
  }

  // ── Step 2: Firestore users document ──────────────────────────────────────

  const userRef  = db.collection('users').doc(uid);
  const userSnap = await userRef.get();

  const payload = {
    uid,
    email:     EMAIL,
    name:      NAME,
    role:      'super_admin',
    tenantId:  null,   // super_admin has no tenant
    status:    'active',
    updatedAt: now,
  };

  if (userSnap.exists) {
    await userRef.set({ ...payload }, { merge: true });
    console.log(`\n  ↑  Firestore users/${uid} → synced`);
  } else {
    await userRef.set({ ...payload, createdAt: now });
    console.log(`\n  ✓  Firestore users/${uid} → created`);
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  console.log('\n' + '━'.repeat(48));
  console.log('✅  Super admin ready!\n');
  console.log('  Login credentials:');
  console.log(`    Email    : ${EMAIL}`);
  console.log(`    Password : ${PASSWORD}`);
  console.log(`    Role     : super_admin`);
  console.log(`    UID      : ${uid}`);
  console.log('');
  console.log('  ⚠️  Change the password after first login.');
  console.log('━'.repeat(48) + '\n');
}

main().catch((err: unknown) => {
  console.error('\n❌  Failed:', (err as Error).message);
  process.exit(1);
});
