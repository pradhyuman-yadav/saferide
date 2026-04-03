import type { Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service';

const service = new WebhookService();

export class WebhookController {
  /** GET /api/v1/webhooks */
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId ?? '';
    if (!tenantId) { res.status(403).json({ success: false, error: { code: 'NO_TENANT', message: 'No tenant context.' } }); return; }

    const webhooks = await service.list(tenantId);
    res.json({ success: true, data: webhooks });
  }

  /** POST /api/v1/webhooks */
  async create(req: Request, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId ?? '';
    if (!tenantId) { res.status(403).json({ success: false, error: { code: 'NO_TENANT', message: 'No tenant context.' } }); return; }

    const webhook = await service.create(req.body as never, tenantId);
    res.status(201).json({ success: true, data: webhook });
  }

  /** DELETE /api/v1/webhooks/:id */
  async delete(req: Request, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId ?? '';
    if (!tenantId) { res.status(403).json({ success: false, error: { code: 'NO_TENANT', message: 'No tenant context.' } }); return; }

    try {
      await service.delete(req.params['id'] as string, tenantId);
      res.status(204).send();
    } catch (err) {
      if ((err as Error).message === 'WEBHOOK_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found.' } });
      } else {
        throw err;
      }
    }
  }

  /** GET /api/v1/webhooks/:id/deliveries */
  async listDeliveries(req: Request, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId ?? '';
    if (!tenantId) { res.status(403).json({ success: false, error: { code: 'NO_TENANT', message: 'No tenant context.' } }); return; }

    const deliveries = await service.listDeliveries(req.params['id'] as string, tenantId);
    res.json({ success: true, data: deliveries });
  }
}
