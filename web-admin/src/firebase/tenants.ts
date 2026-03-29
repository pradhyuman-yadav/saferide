import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  type DocumentData,
} from 'firebase/firestore';
import { z } from 'zod';
import { db } from './config';
import { tenantApi } from '@/api/client';
import type { Tenant, CreateTenantInput } from '@/types/tenant';

// ── Zod schema for Firestore tenant documents ──────────────────────────────

const TenantDocSchema = z.object({
  name:         z.string(),
  slug:         z.string(),
  city:         z.string(),
  state:        z.string(),
  status:       z.enum(['pending', 'trial', 'active', 'suspended', 'cancelled']),
  plan:         z.enum(['trial', 'basic', 'pro']),
  trialEndsAt:  z.number().nullable(),
  maxBuses:     z.number(),
  maxStudents:  z.number(),
  contactName:  z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  adminEmail:   z.string(),
  createdAt:    z.number(),
  updatedAt:    z.number(),
});

// ── Helpers ────────────────────────────────────────────────────────────────

interface DocSnapshot {
  id: string;
  data: () => DocumentData;
}

function docToTenant(snap: DocSnapshot): Tenant | null {
  const result = TenantDocSchema.safeParse(snap.data());
  if (!result.success) {
    console.warn(`[tenants] Skipping malformed tenant doc "${snap.id}":`, result.error.issues);
    return null;
  }
  const raw = result.data;
  return {
    id:           snap.id,
    name:         raw.name,
    slug:         raw.slug,
    city:         raw.city,
    state:        raw.state,
    status:       raw.status,
    plan:         raw.plan,
    trialEndsAt:  raw.trialEndsAt,
    maxBuses:     raw.maxBuses,
    maxStudents:  raw.maxStudents,
    contactName:  raw.contactName,
    contactEmail: raw.contactEmail,
    contactPhone: raw.contactPhone,
    adminEmail:   raw.adminEmail,
    createdAt:    raw.createdAt,
    updatedAt:    raw.updatedAt,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * List all tenants ordered by createdAt descending.
 */
export async function listTenants(): Promise<Tenant[]> {
  const q = query(
    collection(db, 'tenants'),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(docToTenant)
    .filter((t): t is Tenant => t !== null);
}

/**
 * Get a single tenant by ID. Returns null if not found.
 */
export async function getTenant(id: string): Promise<Tenant | null> {
  const snap = await getDoc(doc(db, 'tenants', id));
  if (!snap.exists()) return null;
  return docToTenant({ id: snap.id, data: () => snap.data() });
}

/**
 * Create a new tenant and a pending admin invite.
 * Returns the new tenant document ID.
 * Delegates to the tenant-service API.
 */
export async function createTenant(input: CreateTenantInput): Promise<string> {
  const result = await tenantApi.create(input) as { id: string };
  return result.id;
}

/**
 * Suspend a tenant (sets status to 'suspended').
 * Delegates to the tenant-service API.
 */
export async function suspendTenant(id: string): Promise<void> {
  await tenantApi.suspend(id);
}

/**
 * Reactivate a suspended tenant (sets status back to 'active').
 * Delegates to the tenant-service API.
 */
export async function reactivateTenant(id: string): Promise<void> {
  await tenantApi.reactivate(id);
}
