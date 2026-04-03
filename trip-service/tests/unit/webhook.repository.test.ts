import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Webhook, WebhookDelivery } from '@saferide/types';

// ---------------------------------------------------------------------------
// Mocks — hoisted
// ---------------------------------------------------------------------------

const {
  mockWebhooksDoc,
  mockWebhooksCol,
  mockDeliveriesDoc,
  mockDeliveriesCol,
  mockDb,
} = vi.hoisted(() => {
  const mockWebhooksDoc = {
    get:    vi.fn(),
    update: vi.fn(),
  };
  const mockWebhooksCol = {
    doc:    vi.fn().mockReturnValue(mockWebhooksDoc),
    where:  vi.fn(),
    add:    vi.fn(),
  };
  const mockDeliveriesDoc = {
    update: vi.fn(),
  };
  const mockDeliveriesCol = {
    doc:   vi.fn().mockReturnValue(mockDeliveriesDoc),
    where: vi.fn(),
    add:   vi.fn(),
  };
  const mockDb = {
    collection: vi.fn((name: string) => {
      if (name === 'webhooks')          return mockWebhooksCol;
      if (name === 'webhookDeliveries') return mockDeliveriesCol;
      return mockWebhooksCol;
    }),
  };
  return { mockWebhooksDoc, mockWebhooksCol, mockDeliveriesDoc, mockDeliveriesCol, mockDb };
});

vi.mock('@saferide/firebase-admin', () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock('@saferide/logger', () => ({
  logger:   { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  auditLog: vi.fn(),
}));

import { WebhookRepository } from '../../src/repositories/webhook.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebhookData(overrides: Partial<Webhook & { secret: string }> = {}) {
  return {
    tenantId:  'tenant-001',
    url:       'https://example.com/hook',
    events:    ['trip.started'],
    isActive:  true,
    secret:    'abc123',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function makeDeliveryData(overrides: Partial<WebhookDelivery> = {}) {
  return {
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

function makeChainable(docs: { id: string; data: () => Record<string, unknown> }[]) {
  const chainable = {
    where:  function() { return this; },
    get:    vi.fn().mockResolvedValue({ docs, empty: docs.length === 0 }),
  };
  return chainable;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebhookRepository', () => {
  let repo: WebhookRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebhooksCol.doc.mockReturnValue(mockWebhooksDoc);
    mockDeliveriesCol.doc.mockReturnValue(mockDeliveriesDoc);
    repo = new WebhookRepository();
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns webhook when it exists and tenantId matches', async () => {
      const data = makeWebhookData();
      mockWebhooksDoc.get.mockResolvedValue({ exists: true, id: 'wh-001', data: () => data });
      mockWebhooksCol.doc.mockReturnValue(mockWebhooksDoc);

      const result = await repo.findById('wh-001', 'tenant-001');

      expect(result).toMatchObject({ id: 'wh-001', tenantId: 'tenant-001' });
    });

    it('returns null when doc does not exist', async () => {
      mockWebhooksDoc.get.mockResolvedValue({ exists: false, id: 'wh-999', data: () => undefined });
      mockWebhooksCol.doc.mockReturnValue(mockWebhooksDoc);

      const result = await repo.findById('wh-999', 'tenant-001');

      expect(result).toBeNull();
    });

    it('returns null when tenantId does not match (cross-tenant protection)', async () => {
      const data = makeWebhookData({ tenantId: 'tenant-002' });
      mockWebhooksDoc.get.mockResolvedValue({ exists: true, id: 'wh-001', data: () => data });
      mockWebhooksCol.doc.mockReturnValue(mockWebhooksDoc);

      const result = await repo.findById('wh-001', 'tenant-001');

      expect(result).toBeNull();
    });
  });

  // ── listByTenant ────────────────────────────────────────────────────────────

  describe('listByTenant()', () => {
    it('returns active webhooks for the tenant sorted by createdAt desc', async () => {
      const older = makeWebhookData({ createdAt: 1000 });
      const newer = makeWebhookData({ createdAt: 2000 });
      const chainable = makeChainable([
        { id: 'wh-a', data: () => older },
        { id: 'wh-b', data: () => newer },
      ]);
      mockWebhooksCol.where.mockReturnValue(chainable);

      const result = await repo.listByTenant('tenant-001');

      expect(result[0]!.createdAt).toBe(2000);
      expect(result[1]!.createdAt).toBe(1000);
    });

    it('returns empty array when no webhooks exist', async () => {
      const chainable = makeChainable([]);
      mockWebhooksCol.where.mockReturnValue(chainable);

      const result = await repo.listByTenant('tenant-001');
      expect(result).toEqual([]);
    });
  });

  // ── listActiveForEvent ──────────────────────────────────────────────────────

  describe('listActiveForEvent()', () => {
    it('filters webhooks by event in-memory', async () => {
      const matching    = makeWebhookData({ events: ['trip.started', 'trip.ended'] });
      const notMatching = makeWebhookData({ events: ['sos.triggered'] });
      const chainable   = makeChainable([
        { id: 'wh-a', data: () => matching },
        { id: 'wh-b', data: () => notMatching },
      ]);
      mockWebhooksCol.where.mockReturnValue(chainable);

      const result = await repo.listActiveForEvent('tenant-001', 'trip.started');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('wh-a');
    });

    it('returns empty array when no webhooks match the event', async () => {
      const notMatching = makeWebhookData({ events: ['sos.triggered'] });
      const chainable   = makeChainable([{ id: 'wh-a', data: () => notMatching }]);
      mockWebhooksCol.where.mockReturnValue(chainable);

      const result = await repo.listActiveForEvent('tenant-001', 'trip.started');
      expect(result).toEqual([]);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('adds a document and returns the new ID', async () => {
      mockWebhooksCol.add = vi.fn().mockResolvedValue({ id: 'wh-new' });

      const id = await repo.create(makeWebhookData() as never);

      expect(mockWebhooksCol.add).toHaveBeenCalledOnce();
      expect(id).toBe('wh-new');
    });
  });

  // ── deactivate ──────────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('sets isActive = false on the document', async () => {
      mockWebhooksDoc.update.mockResolvedValue(undefined);

      await repo.deactivate('wh-001');

      expect(mockWebhooksDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ── createDelivery ──────────────────────────────────────────────────────────

  describe('createDelivery()', () => {
    it('adds a delivery document and returns its ID', async () => {
      mockDeliveriesCol.add = vi.fn().mockResolvedValue({ id: 'del-new' });

      const id = await repo.createDelivery(makeDeliveryData() as never);

      expect(mockDeliveriesCol.add).toHaveBeenCalledOnce();
      expect(id).toBe('del-new');
    });
  });

  // ── updateDelivery ──────────────────────────────────────────────────────────

  describe('updateDelivery()', () => {
    it('updates the delivery document with provided fields', async () => {
      mockDeliveriesDoc.update.mockResolvedValue(undefined);

      await repo.updateDelivery('del-001', { status: 'success', statusCode: 200, lastAttemptAt: 1700000001000 });

      expect(mockDeliveriesDoc.update).toHaveBeenCalledWith({
        status: 'success', statusCode: 200, lastAttemptAt: 1700000001000,
      });
    });
  });

  // ── listDeliveries ──────────────────────────────────────────────────────────

  describe('listDeliveries()', () => {
    it('returns deliveries sorted by createdAt desc and capped at 20', async () => {
      const docs = Array.from({ length: 25 }, (_, i) => ({
        id:   `del-${i}`,
        data: () => makeDeliveryData({ createdAt: i * 1000 }),
      }));
      const chainable = makeChainable(docs);
      mockDeliveriesCol.where.mockReturnValue(chainable);

      const result = await repo.listDeliveries('wh-001', 'tenant-001');

      expect(result).toHaveLength(20);
      expect(result[0]!.createdAt).toBeGreaterThan(result[1]!.createdAt);
    });

    it('returns empty array when no deliveries exist', async () => {
      const chainable = makeChainable([]);
      mockDeliveriesCol.where.mockReturnValue(chainable);

      const result = await repo.listDeliveries('wh-001', 'tenant-001');
      expect(result).toEqual([]);
    });
  });
});
