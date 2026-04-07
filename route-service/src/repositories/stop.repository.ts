import { getDb } from '@saferide/firebase-admin';
import type { Stop, UpdateStopInput } from '@saferide/types';
import { StopSchema } from '@saferide/types';

export class StopRepository {
  private col() {
    return getDb().collection('stops');
  }

  private doc(id: string) {
    return this.col().doc(id);
  }

  async listByRouteId(routeId: string, tenantId: string): Promise<Stop[]> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .where('routeId', '==', routeId)
      .orderBy('sequence', 'asc')
      .get();
    return snap.docs.map((d) => StopSchema.parse({ ...d.data(), id: d.id }));
  }

  async findById(id: string, tenantId: string): Promise<Stop | null> {
    const snap = await this.doc(id).get();
    if (!snap.exists) return null;
    const data = StopSchema.parse({ ...snap.data(), id: snap.id });
    if (data.tenantId !== tenantId) return null;
    return data;
  }

  async create(data: Omit<Stop, 'id'>): Promise<string> {
    const ref = await this.col().add(data);
    return ref.id;
  }

  async update(id: string, tenantId: string, updates: UpdateStopInput): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    await this.doc(id).update({ ...patch, updatedAt: Date.now() });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    await this.doc(id).delete();
  }
}
