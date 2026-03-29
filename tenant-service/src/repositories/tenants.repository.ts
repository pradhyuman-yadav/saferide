import { getDb } from '@saferide/firebase-admin';
import type { Tenant, TenantStatus } from '@saferide/types';
import { TenantSchema } from '@saferide/types';

export class TenantsRepository {
  private col() {
    return getDb().collection('tenants');
  }

  async listAll(): Promise<Tenant[]> {
    const snap = await this.col().orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => TenantSchema.parse({ ...d.data(), id: d.id }));
  }

  async findById(id: string): Promise<Tenant | null> {
    const snap = await this.col().doc(id).get();
    if (!snap.exists) return null;
    return TenantSchema.parse({ ...snap.data(), id: snap.id });
  }

  async create(data: Omit<Tenant, 'id'>): Promise<string> {
    const ref = await this.col().add(data);
    return ref.id;
  }

  async updateStatus(id: string, status: TenantStatus): Promise<void> {
    await this.col().doc(id).update({ status, updatedAt: Date.now() });
  }

  async createInvite(inviteKey: string, data: Record<string, unknown>): Promise<void> {
    await getDb().collection('pendingInvites').doc(inviteKey).set(data);
  }
}
