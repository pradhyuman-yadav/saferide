import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Webhook, WebhookDelivery } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — hoisted so they're available inside vi.mock() factories
// ---------------------------------------------------------------------------

const repoMock = vi.hoisted(() => ({
  listByTenant:       vi.fn(),
  listActiveForEvent: vi.fn(),
  findById:           vi.fn(),
  create:             vi.fn(),
  deactivate:         vi.fn(),
  createDelivery:     vi.fn(),
  updateDelivery:     vi.fn(),
  listDeliveries:     vi.fn(),
}));

vi.mock('../../src/repositories/webhook.repository', () => ({
  WebhookRepository: vi.fn().mockImplementation(() => repoMock),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auditLog: vi.fn(),
}));

import { WebhookService } from '../../src/services/webhook.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebhook(overrides: Partial<Webhook> = {}): Webhook {
  return {
    id:        'wh-001',
    tenantId:  'tenant-001',
    url:       'https://example.com/hook',
    events:    ['trip.started'],
    isActive:  true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function makeDelivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    id:            'del-001',
    tenantId:      'tenant-001',
    webhookId:     'wh-001',
    event:         'trip.started',
    status:        'success',
    statusCode:    200,
    attempts:      1,
    lastAttemptAt: 1700000000000,
    createdAt:     1700000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.create.mockResolvedValue('wh-001');
    repoMock.findById.mockResolvedValue(makeWebhook());
    repoMock.listByTenant.mockResolvedValue([makeWebhook()]);
    repoMock.listActiveForEvent.mockResolvedValue([]);
    repoMock.createDelivery.mockResolvedValue('del-001');
    repoMock.updateDelivery.mockResolvedValue(undefined);
    repoMock.deactivate.mockResolvedValue(undefined);
    repoMock.listDeliveries.mockResolvedValue([makeDelivery()]);
    service = new WebhookService();
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns webhooks for a tenant', async () => {
      const webhooks = [makeWebhook()];
      repoMock.listByTenant.mockResolvedValue(webhooks);

      const result = await service.list('tenant-001');

      expect(repoMock.listByTenant).toHaveBeenCalledWith('tenant-001');
      expect(result).toEqual(webhooks);
    });

    it('returns empty array when tenant has no webhooks', async () => {
      repoMock.listByTenant.mockResolvedValue([]);
      const result = await service.list('tenant-001');
      expect(result).toEqual([]);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a webhook and returns it (secret auto-generated)', async () => {
      const wh = makeWebhook();
      repoMock.create.mockResolvedValue('wh-001');
      repoMock.findById.mockResolvedValue(wh);

      const result = await service.create({ url: 'https://example.com/hook', events: ['trip.started'] }, 'tenant-001');

      expect(repoMock.create).toHaveBeenCalledOnce();
      const createArg = repoMock.create.mock.calls[0][0] as Record<string, unknown>;
      expect(createArg['tenantId']).toBe('tenant-001');
      expect(createArg['url']).toBe('https://example.com/hook');
      expect(typeof createArg['secret']).toBe('string');
      expect((createArg['secret'] as string).length).toBe(64); // 32 bytes hex
      expect(result).toEqual(wh);
    });

    it('throws if the created webhook cannot be fetched back', async () => {
      repoMock.create.mockResolvedValue('wh-001');
      repoMock.findById.mockResolvedValue(null);

      await expect(
        service.create({ url: 'https://example.com/hook', events: ['trip.started'] }, 'tenant-001'),
      ).rejects.toThrow('Failed to retrieve created webhook');
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('deactivates an existing webhook', async () => {
      repoMock.findById.mockResolvedValue(makeWebhook());

      await service.delete('wh-001', 'tenant-001');

      expect(repoMock.deactivate).toHaveBeenCalledWith('wh-001');
    });

    it('throws WEBHOOK_NOT_FOUND when webhook does not exist', async () => {
      repoMock.findById.mockResolvedValue(null);

      await expect(service.delete('wh-missing', 'tenant-001')).rejects.toThrow('WEBHOOK_NOT_FOUND');
      expect(repoMock.deactivate).not.toHaveBeenCalled();
    });
  });

  // ── listDeliveries ──────────────────────────────────────────────────────────

  describe('listDeliveries()', () => {
    it('returns deliveries for a webhook', async () => {
      const deliveries = [makeDelivery()];
      repoMock.listDeliveries.mockResolvedValue(deliveries);

      const result = await service.listDeliveries('wh-001', 'tenant-001');

      expect(repoMock.listDeliveries).toHaveBeenCalledWith('wh-001', 'tenant-001');
      expect(result).toEqual(deliveries);
    });
  });

  // ── deliverEvent ────────────────────────────────────────────────────────────

  describe('deliverEvent()', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('does nothing when no active webhooks match the event', async () => {
      repoMock.listActiveForEvent.mockResolvedValue([]);

      await service.deliverEvent('trip.started', { tripId: 't-1' }, 'tenant-001');

      expect(repoMock.createDelivery).not.toHaveBeenCalled();
    });

    it('creates a delivery record and marks it success on 2xx response', async () => {
      const wh = { ...makeWebhook(), secret: 'a'.repeat(64) };
      repoMock.listActiveForEvent.mockResolvedValue([wh]);
      repoMock.createDelivery.mockResolvedValue('del-001');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      await service.deliverEvent('trip.started', { tripId: 't-1' }, 'tenant-001');

      expect(repoMock.createDelivery).toHaveBeenCalledOnce();
      expect(repoMock.updateDelivery).toHaveBeenCalledWith('del-001', expect.objectContaining({
        status: 'success', statusCode: 200,
      }));
    });

    it('marks delivery failed on non-2xx response', async () => {
      const wh = { ...makeWebhook(), secret: 'b'.repeat(64) };
      repoMock.listActiveForEvent.mockResolvedValue([wh]);
      repoMock.createDelivery.mockResolvedValue('del-002');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      await service.deliverEvent('trip.ended', { tripId: 't-1' }, 'tenant-001');

      expect(repoMock.updateDelivery).toHaveBeenCalledWith('del-002', expect.objectContaining({
        status: 'failed', statusCode: 500,
      }));
    });

    it('marks delivery failed when fetch throws (network error)', async () => {
      const wh = { ...makeWebhook(), secret: 'c'.repeat(64) };
      repoMock.listActiveForEvent.mockResolvedValue([wh]);
      repoMock.createDelivery.mockResolvedValue('del-003');

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await service.deliverEvent('sos.triggered', { tripId: 't-1' }, 'tenant-001');

      expect(repoMock.updateDelivery).toHaveBeenCalledWith('del-003', expect.objectContaining({
        status: 'failed', statusCode: null,
      }));
    });

    it('never throws even when the repo itself errors (fire-and-forget)', async () => {
      repoMock.listActiveForEvent.mockRejectedValue(new Error('Firestore down'));

      await expect(
        service.deliverEvent('trip.started', { tripId: 't-1' }, 'tenant-001'),
      ).resolves.toBeUndefined();
    });

    it('sends correct HMAC signature header', async () => {
      const secret = 'd'.repeat(64);
      const wh = { ...makeWebhook(), secret };
      repoMock.listActiveForEvent.mockResolvedValue([wh]);
      repoMock.createDelivery.mockResolvedValue('del-004');

      const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', fetchSpy);

      await service.deliverEvent('trip.started', { tripId: 't-1' }, 'tenant-001');

      const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = opts.headers as Record<string, string>;
      expect(headers['X-SafeRide-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(headers['X-SafeRide-Event']).toBe('trip.started');
    });
  });
});
