/**
 * listener.ts
 * Notification event listeners for the SafeRide app.
 *
 * Call `useNotificationListeners()` once from the root layout component.
 * It sets up two subscriptions:
 *
 *  1. Foreground listener  — notification arrives while app is open.
 *     → Shows an in-app SRToast so the native OS banner is not the only signal.
 *
 *  2. Response listener    — user taps a notification (from background/killed state).
 *     → Reads the `screen` field from notification data and navigates there.
 *
 * Notification payload convention (backend must follow this shape):
 *   {
 *     title: string,
 *     body:  string,
 *     data: {
 *       screen?: string,   // e.g. '/(parent)/' or '/(driver)/'
 *       type?:   'trip_start' | 'trip_end' | 'sos' | 'general'
 *     }
 *   }
 */

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useToastStore } from '@/store/toast.store';
import type { ToastType } from '@/store/toast.store';

// Maps notification type field → toast severity
const TYPE_TO_TOAST: Record<string, ToastType> = {
  trip_start: 'info',
  trip_end:   'success',
  sos:        'warning',
  general:    'info',
};

export function useNotificationListeners(): void {
  const router = useRouter();
  const show   = useToastStore((s) => s.show);

  useEffect(() => {
    // ── Foreground: show in-app toast when a push arrives ─────────────────────
    const foregroundSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body, data } = notification.request.content;
        if (!title) return;

        const notifType = (data as Record<string, unknown>)['type'] as string | undefined;
        const toastType: ToastType = (notifType && TYPE_TO_TOAST[notifType]) ?? 'info';

        show({
          title,
          body:     body ?? undefined,
          type:     toastType,
          duration: notifType === 'sos' ? 8000 : 4000, // SOS banners linger longer
        });
      },
    );

    // ── Response: user tapped a notification → navigate to target screen ──────
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data   = response.notification.request.content.data as Record<string, unknown>;
        const screen = data['screen'] as string | undefined;
        if (screen) {
          router.push(screen as never);
        }
      },
    );

    // Check if app was launched by tapping a notification (killed state)
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data   = response.notification.request.content.data as Record<string, unknown>;
      const screen = data['screen'] as string | undefined;
      if (screen) {
        router.push(screen as never);
      }
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, []);
}
