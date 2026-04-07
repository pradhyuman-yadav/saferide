import { getDb } from '@saferide/firebase-admin';
import type { Route, UpdateRouteInput } from '@saferide/types';
import { RouteSchema } from '@saferide/types';

export class RouteRepository {
  private col() {
    return getDb().collection('routes');
  }

  private doc(id: string) {
    return this.col().doc(id);
  }

  async listByTenantId(tenantId: string): Promise<Route[]> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => RouteSchema.parse({ ...d.data(), id: d.id }));
  }

  async findById(id: string, tenantId: string): Promise<Route | null> {
    const snap = await this.doc(id).get();
    if (!snap.exists) return null;
    const data = RouteSchema.parse({ ...snap.data(), id: snap.id });
    if (data.tenantId !== tenantId) return null;
    return data;
  }

  async create(data: Omit<Route, 'id'>): Promise<string> {
    const ref = await this.col().add(data);
    return ref.id;
  }

  async update(id: string, tenantId: string, updates: UpdateRouteInput | { isActive: boolean }): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error('NOT_FOUND');
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    await this.doc(id).update({ ...patch, updatedAt: Date.now() });
  }
}
