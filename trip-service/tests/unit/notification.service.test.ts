import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted so they're available inside vi.mock() factories
// ---------------------------------------------------------------------------

// All Firestore mocks in one hoisted block so they can cross-reference
const { collectionMock, docGetMock, dbMock } = vi.hoisted(() => {
  const docGetFn = vi.fn().mockResolvedValue({ data: () => undefined });

  const queryMock = {
    where: vi.fn(),
    get:   vi.fn(),
    // collection('users').doc(uid).get() — needed by notifyParentsOfBus
    doc:   vi.fn().mockReturnValue({ get: docGetFn }),
  };
  queryMock.where.mockReturnValue(queryMock);
  queryMock.get.mockResolvedValue({ empty: true, docs: [] });

  const db = {
    collection: vi.fn().mockReturnValue(queryMock),
  };

  return { collectionMock: queryMock, docGetMock: docGetFn, dbMock: db };
});

// Expo SDK
const expoSendMock     = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const expoChunkMock    = vi.hoisted(() => vi.fn().mockImplementation((msgs: unknown[]) => [msgs]));
const expoIsTokenMock  = vi.hoisted(() => vi.fn().mockImplementation(
  (t: unknown) => typeof t === 'string' && t.startsWith('ExponentPushToken['),
));

vi.mock('@saferide/firebase-admin', () => ({
  getDb: vi.fn().mockReturnValue(dbMock),
}));

vi.mock('@saferide/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('expo-server-sdk', () => ({
  Expo: vi.fn().mockImplementation(() => ({
    chunkPushNotifications:    expoChunkMock,
    sendPushNotificationsAsync: expoSendMock,
  })),
}));

// Patch static method after mock is registered
import * as ExpoModule from 'expo-server-sdk';
(ExpoModule.Expo as unknown as { isExpoPushToken: typeof expoIsTokenMock }).isExpoPushToken =
  expoIsTokenMock;

import { NotificationService } from '../../src/services/notification.service';
import { logger } from '@saferide/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TOKEN  = 'ExponentPushToken[abc123]';
const VALID_TOKEN2 = 'ExponentPushToken[def456]';

const makeQuerySnapshot = (docs: Record<string, unknown>[]) => ({
  empty: docs.length === 0,
  docs:  docs.map((data) => ({ data: () => data })),
});

/** Reset the Firestore collection mock chain for a new test */
function resetCollectionMock() {
  collectionMock.where.mockReset();
  collectionMock.get.mockReset();
  collectionMock.doc.mockReset();
  docGetMock.mockReset();
  collectionMock.where.mockReturnValue(collectionMock);
  collectionMock.get.mockResolvedValue(makeQuerySnapshot([]));
  collectionMock.doc.mockReturnValue({ get: docGetMock });
  docGetMock.mockResolvedValue({ data: () => undefined });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCollectionMock();
    // Restore chainable where
    collectionMock.where.mockReturnValue(collectionMock);
    dbMock.collection.mockReturnValue(collectionMock);
    service = new NotificationService();
  });

  // ── notifyParentsOfBus ────────────────────────────────────────────────────

  describe('notifyParentsOfBus()', () => {
    it('resolves silently when no students are on the bus', async () => {
      collectionMock.get.mockResolvedValue(makeQuerySnapshot([]));

      await service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body');

      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('resolves silently when students exist but have no parentFirebaseUid', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ busId: 'bus-001', tenantId: 'tenant-001' }]),
      );

      await service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body');

      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('resolves silently when parent user documents have no push token', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ parentFirebaseUid: 'uid-parent-1' }]),
      );
      docGetMock.mockResolvedValue({ data: () => ({ expoPushToken: undefined }) });

      await service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body');

      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('resolves silently when parent token is not a valid Expo push token', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ parentFirebaseUid: 'uid-parent-1' }]),
      );
      docGetMock.mockResolvedValue({ data: () => ({ expoPushToken: 'not-a-valid-token' }) });

      await service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body');

      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('sends push to parent when a valid token is found', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ parentFirebaseUid: 'uid-parent-1' }]),
      );
      docGetMock.mockResolvedValue({ data: () => ({ expoPushToken: VALID_TOKEN }) });
      expoSendMock.mockResolvedValue([{ status: 'ok' }]);

      await service.notifyParentsOfBus('bus-001', 'tenant-001', 'Bus is on the way', 'Track now');

      expect(expoSendMock).toHaveBeenCalledOnce();
      const sentMessages = expoChunkMock.mock.calls[0]![0] as Array<{ to: string; title: string }>;
      expect(sentMessages[0]!.to).toBe(VALID_TOKEN);
      expect(sentMessages[0]!.title).toBe('Bus is on the way');
    });

    it('sends push to multiple parents when several valid tokens exist', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([
          { parentFirebaseUid: 'uid-parent-1' },
          { parentFirebaseUid: 'uid-parent-2' },
        ]),
      );
      docGetMock
        .mockResolvedValueOnce({ data: () => ({ expoPushToken: VALID_TOKEN  }) })
        .mockResolvedValueOnce({ data: () => ({ expoPushToken: VALID_TOKEN2 }) });
      expoSendMock.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }]);

      await service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body');

      const sentMessages = expoChunkMock.mock.calls[0]![0] as Array<{ to: string }>;
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages.map((m) => m.to)).toContain(VALID_TOKEN);
      expect(sentMessages.map((m) => m.to)).toContain(VALID_TOKEN2);
    });

    it('logs a warning but does not throw when Expo reports a delivery error', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ parentFirebaseUid: 'uid-parent-1' }]),
      );
      docGetMock.mockResolvedValue({ data: () => ({ expoPushToken: VALID_TOKEN }) });
      expoSendMock.mockResolvedValue([{ status: 'error', message: 'DeviceNotRegistered' }]);

      await expect(
        service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body'),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('logs an error but does not throw when Firestore throws', async () => {
      collectionMock.get.mockRejectedValue(new Error('Firestore unavailable'));

      await expect(
        service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body'),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledOnce();
      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('logs an error but does not throw when expo.sendPushNotificationsAsync throws', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ parentFirebaseUid: 'uid-parent-1' }]),
      );
      docGetMock.mockResolvedValue({ data: () => ({ expoPushToken: VALID_TOKEN }) });
      expoSendMock.mockRejectedValue(new Error('Expo API down'));

      await expect(
        service.notifyParentsOfBus('bus-001', 'tenant-001', 'Title', 'Body'),
      ).resolves.toBeUndefined();

      // error logged inside sendPush chunk handler
      expect(logger.error).toHaveBeenCalledOnce();
    });
  });

  // ── notifyManagersOfTenant ────────────────────────────────────────────────

  describe('notifyManagersOfTenant()', () => {
    it('resolves silently when no managers are in the tenant', async () => {
      collectionMock.get.mockResolvedValue(makeQuerySnapshot([]));

      await service.notifyManagersOfTenant('tenant-001', 'SOS Alert', 'A driver triggered SOS');

      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('resolves silently when managers have no push tokens', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ role: 'manager', tenantId: 'tenant-001' }]),
      );

      await service.notifyManagersOfTenant('tenant-001', 'SOS Alert', 'A driver triggered SOS');

      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('resolves silently when manager token is not a valid Expo push token', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ role: 'manager', expoPushToken: 'garbage-token' }]),
      );

      await service.notifyManagersOfTenant('tenant-001', 'SOS Alert', 'A driver triggered SOS');

      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('sends push to manager when a valid token is found', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ role: 'manager', expoPushToken: VALID_TOKEN }]),
      );
      expoSendMock.mockResolvedValue([{ status: 'ok' }]);

      await service.notifyManagersOfTenant('tenant-001', 'SOS Alert', 'A driver triggered SOS');

      expect(expoSendMock).toHaveBeenCalledOnce();
      const sentMessages = expoChunkMock.mock.calls[0]![0] as Array<{ to: string; title: string }>;
      expect(sentMessages[0]!.to).toBe(VALID_TOKEN);
      expect(sentMessages[0]!.title).toBe('SOS Alert');
    });

    it('sends push to all managers when multiple valid tokens exist', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([
          { role: 'manager', expoPushToken: VALID_TOKEN  },
          { role: 'manager', expoPushToken: VALID_TOKEN2 },
        ]),
      );
      expoSendMock.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }]);

      await service.notifyManagersOfTenant('tenant-001', 'Title', 'Body');

      const sentMessages = expoChunkMock.mock.calls[0]![0] as Array<{ to: string }>;
      expect(sentMessages).toHaveLength(2);
    });

    it('logs a warning but does not throw when Expo reports a delivery error', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([{ role: 'manager', expoPushToken: VALID_TOKEN }]),
      );
      expoSendMock.mockResolvedValue([{ status: 'error', message: 'InvalidCredentials' }]);

      await expect(
        service.notifyManagersOfTenant('tenant-001', 'Title', 'Body'),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('logs an error but does not throw when Firestore throws', async () => {
      collectionMock.get.mockRejectedValue(new Error('Firestore unavailable'));

      await expect(
        service.notifyManagersOfTenant('tenant-001', 'Title', 'Body'),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledOnce();
      expect(expoSendMock).not.toHaveBeenCalled();
    });

    it('filters out managers whose tokens are missing from the batch', async () => {
      collectionMock.get.mockResolvedValue(
        makeQuerySnapshot([
          { role: 'manager', expoPushToken: VALID_TOKEN  },
          { role: 'manager' /* no token */               },
          { role: 'manager', expoPushToken: 'bad-token'  },
        ]),
      );
      expoSendMock.mockResolvedValue([{ status: 'ok' }]);

      await service.notifyManagersOfTenant('tenant-001', 'Title', 'Body');

      // Only the one valid token should be in the batch
      const sentMessages = expoChunkMock.mock.calls[0]![0] as Array<{ to: string }>;
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]!.to).toBe(VALID_TOKEN);
    });
  });
});
