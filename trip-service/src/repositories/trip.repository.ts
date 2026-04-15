import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '@saferide/firebase-admin';
import { TripSchema } from '@saferide/types';
import type { Trip } from '@saferide/types';

export class TripRepository {
  private col(tenantId: string) {
    return getDb().collection('trips').where('tenantId', '==', tenantId);
  }

  private docRef(id: string) {
    return getDb().collection('trips').doc(id);
  }

  async findById(id: string, tenantId: string): Promise<Trip | null> {
    const snap = await this.docRef(id).get();
    if (!snap.exists) return null;
    const data = TripSchema.parse({ ...snap.data(), id: snap.id });
    if (data.tenantId !== tenantId) return null;
    return data;
  }

  async listByDriverId(driverId: string, tenantId: string, limit = 30): Promise<Trip[]> {
    const snap = await getDb()
      .collection('trips')
      .where('tenantId', '==', tenantId)
      .where('driverId', '==', driverId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => TripSchema.parse({ ...d.data(), id: d.id }));
  }

  async findActiveByDriverId(driverId: string, tenantId: string): Promise<Trip | null> {
    const snap = await getDb()
      .collection('trips')
      .where('tenantId', '==', tenantId)
      .where('driverId', '==', driverId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const [d] = snap.docs;
    if (!d) return null;
    return TripSchema.parse({ ...d.data(), id: d.id });
  }

  async listByBusId(busId: string, tenantId: string, limit = 20): Promise<Trip[]> {
    const snap = await getDb()
      .collection('trips')
      .where('tenantId', '==', tenantId)
      .where('busId', '==', busId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => TripSchema.parse({ ...d.data(), id: d.id }));
  }

  async findActiveByBusId(busId: string, tenantId: string): Promise<Trip | null> {
    const snap = await getDb()
      .collection('trips')
      .where('tenantId', '==', tenantId)
      .where('busId', '==', busId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const [d] = snap.docs;
    if (!d) return null;
    return TripSchema.parse({ ...d.data(), id: d.id });
  }

  /** All recent trips across all tenants — used by super_admin analytics. */
  async listAll(limit = 500): Promise<Trip[]> {
    const snap = await getDb()
      .collection('trips')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => TripSchema.parse({ ...d.data(), id: d.id }));
  }

  /** All recent trips for a tenant — used by school_admin analytics. */
  async listByTenant(tenantId: string, limit = 100): Promise<Trip[]> {
    const snap = await getDb()
      .collection('trips')
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => TripSchema.parse({ ...d.data(), id: d.id }));
  }

  async create(data: Omit<Trip, 'id'>): Promise<string> {
    const ref = await getDb().collection('trips').add(data);
    return ref.id;
  }

  async update(
    id: string,
    tenantId: string,
    updates: Partial<Omit<Trip, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    await this.docRef(id).update({ ...patch, updatedAt: Date.now() });
  }

  /** Set or clear the SOS flag on a trip document. */
  async setSosStatus(
    id: string,
    tenantId: string,
    active: boolean,
    triggeredAt?: number,
  ): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    const patch: Record<string, unknown> = {
      sosActive:  active,
      updatedAt:  Date.now(),
    };
    if (active && triggeredAt !== undefined) {
      patch['sosTriggeredAt'] = triggeredAt;
    }
    await this.docRef(id).update(patch);
  }

  /**
   * Atomically appends a stop ID to alertedStopIds using FieldValue.arrayUnion.
   * Safe under concurrent GPS pings — Firestore merges concurrent arrayUnion writes.
   */
  async addAlertedStopId(id: string, tenantId: string, stopId: string): Promise<void> {
    // Tenant guard: ensure the trip belongs to this tenant before writing
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    await this.docRef(id).update({
      alertedStopIds: FieldValue.arrayUnion(stopId),
      updatedAt:      Date.now(),
    });
  }
}
