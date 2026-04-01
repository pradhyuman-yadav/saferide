/**
 * notification.service.ts
 * Fire-and-forget push notification delivery via Expo Push API.
 *
 * All public methods are fire-and-forget — a failed notification never
 * causes the calling API request to fail. Errors are logged only.
 *
 * Token lookup strategy:
 *   - Parents: query students by busId → parentFirebaseUid → users/{uid}.expoPushToken
 *   - Managers: query users by tenantId + role === 'manager' → expoPushToken
 */
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { getDb } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';

const expo = new Expo();

export class NotificationService {
  /**
   * Sends a push notification to all parents whose child rides the given bus.
   * Resolves silently even if no tokens exist or delivery fails.
   */
  async notifyParentsOfBus(
    busId:    string,
    tenantId: string,
    title:    string,
    body:     string,
  ): Promise<void> {
    try {
      const db = getDb();

      // 1. Find all students on this bus
      const studentsSnap = await db.collection('students')
        .where('tenantId', '==', tenantId)
        .where('busId',    '==', busId)
        .get();

      if (studentsSnap.empty) return;

      // 2. Collect parent UIDs
      const parentUids = studentsSnap.docs.map(
        (d) => (d.data() as { parentFirebaseUid: string }).parentFirebaseUid,
      ).filter(Boolean);

      if (parentUids.length === 0) return;

      // 3. Fetch push tokens from user documents
      const tokens: string[] = [];
      await Promise.all(
        parentUids.map(async (uid) => {
          const snap = await db.collection('users').doc(uid).get();
          const token = (snap.data() as { expoPushToken?: string } | undefined)?.expoPushToken;
          if (token && Expo.isExpoPushToken(token)) tokens.push(token);
        }),
      );

      await this.sendPush(tokens, title, body);
    } catch (err) {
      logger.error({ err, busId, tenantId }, '[NotificationService] notifyParentsOfBus failed');
    }
  }

  /**
   * Sends a push notification to all transport managers in the tenant.
   * Resolves silently even if no tokens exist or delivery fails.
   */
  async notifyManagersOfTenant(
    tenantId: string,
    title:    string,
    body:     string,
  ): Promise<void> {
    try {
      const db = getDb();

      const managersSnap = await db.collection('users')
        .where('tenantId', '==', tenantId)
        .where('role',     '==', 'manager')
        .get();

      if (managersSnap.empty) return;

      const tokens = managersSnap.docs
        .map((d) => (d.data() as { expoPushToken?: string }).expoPushToken)
        .filter((t): t is string => typeof t === 'string' && Expo.isExpoPushToken(t));

      await this.sendPush(tokens, title, body);
    } catch (err) {
      logger.error({ err, tenantId }, '[NotificationService] notifyManagersOfTenant failed');
    }
  }

  /**
   * Sends push messages in Expo-recommended batches of 100.
   * Logs delivery errors but never throws.
   */
  private async sendPush(tokens: string[], title: string, body: string): Promise<void> {
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      data:  { source: 'saferide' },
    }));

    const chunks = expo.chunkPushNotifications(messages);

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk);
          receipts.forEach((receipt) => {
            if (receipt.status === 'error') {
              logger.warn({ receipt }, '[NotificationService] push delivery error');
            }
          });
        } catch (err) {
          logger.error({ err }, '[NotificationService] sendPushNotificationsAsync failed');
        }
      }),
    );
  }
}
