/**
 * WebhookService
 *
 * Manages webhook CRUD and event delivery.
 * deliverEvent() is fire-and-forget — it never throws and never blocks
 * the calling request path.
 *
 * Payload structure sent to subscriber URLs:
 *   {
 *     event:     'trip.started' | 'trip.ended' | 'sos.triggered' | 'sos.cancelled',
 *     tenantId:  string,
 *     data:      { tripId, busId, driverId, ... },
 *     timestamp: number,
 *   }
 *
 * Each request carries:
 *   X-SafeRide-Signature: sha256=<hmac-hex>
 *   X-SafeRide-Event:     <event name>
 *   X-SafeRide-Delivery:  <delivery doc ID>
 *
 * Receivers verify the signature with:
 *   sha256=HMAC-SHA256(secret, rawRequestBody)
 */
import { createHmac, randomBytes } from 'crypto';
import { logger } from '@saferide/logger';
import { WebhookRepository } from '../repositories/webhook.repository';
import type { WebhookWithSecret } from '../repositories/webhook.repository';
import type { Webhook, WebhookDelivery, WebhookEvent, CreateWebhookInput } from '@saferide/types';

const repo = new WebhookRepository();

function signPayload(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

export class WebhookService {
  /** List all active webhooks for a tenant (secret stripped). */
  list(tenantId: string): Promise<Webhook[]> {
    return repo.listByTenant(tenantId);
  }

  /** Create a webhook with an auto-generated HMAC secret. */
  async create(input: CreateWebhookInput, tenantId: string): Promise<Webhook> {
    const now    = Date.now();
    const secret = randomBytes(32).toString('hex'); // 64-char hex

    const id = await repo.create({
      tenantId,
      url:       input.url,
      secret,
      events:    input.events,
      isActive:  true,
      createdAt: now,
      updatedAt: now,
    });

    const created = await repo.findById(id, tenantId);
    if (!created) throw new Error('Failed to retrieve created webhook');
    return created;
  }

  /** Soft-delete: sets isActive = false and purges delivery logs older than 30 days. */
  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await repo.findById(id, tenantId);
    if (!existing) throw new Error('WEBHOOK_NOT_FOUND');
    await repo.deactivate(id);
    // DPDP 2023: purge delivery logs (which may contain trip event data) older
    // than 30 days. Fire-and-forget — failure here must not block the delete response.
    void repo.purgeOldDeliveries(id, tenantId, 30 * 24 * 60 * 60 * 1_000).catch((err) => {
      logger.warn({ err, webhookId: id, tenantId }, '[WebhookService] purgeOldDeliveries failed (non-fatal)');
    });
  }

  /** Recent delivery log for a single webhook. */
  listDeliveries(webhookId: string, tenantId: string): Promise<WebhookDelivery[]> {
    return repo.listDeliveries(webhookId, tenantId);
  }

  /**
   * Deliver an event to all matching webhooks for a tenant.
   * Fire-and-forget — logs errors, never propagates them.
   */
  async deliverEvent(
    event:    WebhookEvent,
    payload:  Record<string, unknown>,
    tenantId: string,
  ): Promise<void> {
    try {
      const webhooks = await repo.listActiveForEvent(tenantId, event);
      if (webhooks.length === 0) return;
      await Promise.all(webhooks.map((wh) => this.attemptDelivery(wh, event, payload, tenantId)));
    } catch (err) {
      logger.error({ err, event, tenantId }, '[WebhookService] deliverEvent failed');
    }
  }

  private async attemptDelivery(
    webhook:  WebhookWithSecret,
    event:    WebhookEvent,
    payload:  Record<string, unknown>,
    tenantId: string,
  ): Promise<void> {
    const now  = Date.now();
    const body = JSON.stringify({ event, tenantId, data: payload, timestamp: now });
    const sig  = signPayload(webhook.secret, body);

    const deliveryId = await repo.createDelivery({
      tenantId,
      webhookId:     webhook.id,
      event,
      status:        'pending',
      statusCode:    null,
      attempts:      1,
      lastAttemptAt: now,
      createdAt:     now,
    });

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(webhook.url, {
        method:  'POST',
        headers: {
          'Content-Type':           'application/json',
          'X-SafeRide-Signature':   sig,
          'X-SafeRide-Event':       event,
          'X-SafeRide-Delivery':    deliveryId,
        },
        body,
        signal: controller.signal,
      });

      await repo.updateDelivery(deliveryId, {
        status:        res.ok ? 'success' : 'failed',
        statusCode:    res.status,
        lastAttemptAt: Date.now(),
      });

      if (!res.ok) {
        logger.warn({ webhookId: webhook.id, event, status: res.status }, '[WebhookService] non-2xx response');
      }
    } catch (err) {
      const isTimeout = (err as Error).name === 'AbortError';
      logger.warn(
        { webhookId: webhook.id, event, err: isTimeout ? 'timeout (10s)' : err },
        '[WebhookService] delivery failed',
      );
      await repo.updateDelivery(deliveryId, {
        status:        'failed',
        statusCode:    null,
        lastAttemptAt: Date.now(),
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
