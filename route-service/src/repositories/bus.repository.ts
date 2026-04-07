import { getDb } from '@saferide/firebase-admin';
import type { Bus, UpdateBusInput } from '@saferide/types';
import { BusSchema } from '@saferide/types';

export class BusRepository {
  private col() {
    return getDb().collection('buses');
  }

  private doc(id: string) {
    return this.col().doc(id);
  }

  async listByTenantId(tenantId: string): Promise<Bus[]> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => BusSchema.parse({ ...d.data(), id: d.id }));
  }

  async findById(id: string, tenantId: string): Promise<Bus | null> {
    const snap = await this.doc(id).get();
    if (!snap.exists) return null;
    const data = BusSchema.parse({ ...snap.data(), id: snap.id });
    if (data.tenantId !== tenantId) return null;
    return data;
  }

  /** Finds the bus currently assigned to the given route, or null. */
  async findByRouteId(routeId: string, tenantId: string): Promise<Bus | null> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .where('routeId', '==', routeId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const [d] = snap.docs;
    if (!d) return null;
    return BusSchema.parse({ ...d.data(), id: d.id });
  }

  async create(data: Omit<Bus, 'id'>): Promise<string> {
    const ref = await this.col().add(data);
    return ref.id;
  }

  async update(
    id: string,
    tenantId: string,
    updates: UpdateBusInput | { status: 'inactive' } | { driverId: string | null } | { routeId: string | null },
  ): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    await this.doc(id).update({ ...patch, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.doc(id).delete();
  }
}
