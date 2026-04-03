import { getDb } from '@saferide/firebase-admin';
import { WebhookSchema, WebhookDeliverySchema } from '@saferide/types';
import type { Webhook, WebhookDelivery, WebhookEvent } from '@saferide/types';

/** Internal shape that includes the HMAC secret — never exposed to API layer. */
export type WebhookWithSecret = Webhook & { secret: string };

export class WebhookRepository {
  private col() {
    return getDb().collection('webhooks');
  }

  private deliveriesCol() {
    return getDb().collection('webhookDeliveries');
  }

  async findById(id: string, tenantId: string): Promise<Webhook | null> {
    const snap = await this.col().doc(id).get();
    if (!snap.exists) return null;
    const raw = snap.data() as Record<string, unknown>;
    const data = WebhookSchema.parse({ ...raw, id: snap.id });
    if (data.tenantId !== tenantId) return null;
    return data;
  }

  async listByTenant(tenantId: string): Promise<Webhook[]> {
    // Equality-only query — no orderBy — so no composite index required before
    // `firebase deploy --only firestore:indexes` has been run.
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .where('isActive', '==', true)
      .get();
    const webhooks = snap.docs.map((d) => WebhookSchema.parse({ ...d.data(), id: d.id }));
    return webhooks.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Used by delivery logic only — returns secret alongside webhook data.
   * Filters in-memory by event to avoid a composite index on events array.
   */
  async listActiveForEvent(tenantId: string, event: WebhookEvent): Promise<WebhookWithSecret[]> {
    const snap = await this.col()
      .where('tenantId', '==', tenantId)
      .where('isActive', '==', true)
      .get();
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as WebhookWithSecret))
      .filter((w) => (w.events as string[]).includes(event));
  }

  async create(data: Omit<Webhook, 'id'> & { secret: string }): Promise<string> {
    const ref = await this.col().add(data);
    return ref.id;
  }

  async deactivate(id: string): Promise<void> {
    await this.col().doc(id).update({ isActive: false, updatedAt: Date.now() });
  }

  async createDelivery(data: Omit<WebhookDelivery, 'id'>): Promise<string> {
    const ref = await this.deliveriesCol().add(data);
    return ref.id;
  }

  async updateDelivery(
    id: string,
    update: Partial<Pick<WebhookDelivery, 'status' | 'statusCode' | 'attempts' | 'lastAttemptAt'>>,
  ): Promise<void> {
    await this.deliveriesCol().doc(id).update(update);
  }

  async listDeliveries(webhookId: string, tenantId: string, limit = 20): Promise<WebhookDelivery[]> {
    // Equality-only query — no orderBy — so no composite index required before
    // `firebase deploy --only firestore:indexes` has been run.
    const snap = await this.deliveriesCol()
      .where('tenantId',  '==', tenantId)
      .where('webhookId', '==', webhookId)
      .get();
    const deliveries = snap.docs.map((d) => WebhookDeliverySchema.parse({ ...d.data(), id: d.id }));
    return deliveries.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
}
