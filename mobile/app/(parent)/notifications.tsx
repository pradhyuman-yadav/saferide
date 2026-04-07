/**
 * Notifications / Alerts screen — parent-facing.
 *
 * Generates trip events (start / end) from the bus trip history returned
 * by trip-service. Uses tripClient.listTripsForBus() which calls
 * GET /api/v1/trips/bus/:busId.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuthStore } from '@/store/auth.store';
import { tripClient } from '@/api/trip.client';
import type { Trip } from '@/api/trip.client';
import { SRText } from '@/components/ui/SRText';
import { colors, spacing, radius, iconSize } from '@/theme';

// ── Event types ───────────────────────────────────────────────────────────────

type EventType = 'started' | 'ended';

interface TripEvent {
  id:    string;
  type:  EventType;
  title: string;
  body:  string;
  time:  number;   // timestamp ms — used for display + sorting
}

const EVENT_ICON: Record<EventType, React.ReactNode> = {
  started: <Bell        size={iconSize.md} color={colors.sage} strokeWidth={2} />,
  ended:   <CheckCircle size={iconSize.md} color={colors.sage} strokeWidth={2} />,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const diff = Date.now() - ms;
  const DAY  = 86_400_000;

  if (diff < DAY) {
    return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 2 * DAY) return 'Yesterday';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function tripsToEvents(trips: Trip[], t: TFunction): TripEvent[] {
  const events: TripEvent[] = [];
  for (const trip of trips) {
    events.push({
      id:    `${trip.id}-started`,
      type:  'started',
      title: t('alerts.tripStarted'),
      body:  t('alerts.tripStartedBody', { time: new Date(trip.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }),
      time:  trip.startedAt,
    });
    if (trip.endedAt) {
      const durMin = Math.round((trip.endedAt - trip.startedAt) / 60_000);
      events.push({
        id:    `${trip.id}-ended`,
        type:  'ended',
        title: t('alerts.tripEnded'),
        body:  t('alerts.tripEndedBody', { duration: durMin }),
        time:  trip.endedAt,
      });
    }
  }
  return events.sort((a, b) => b.time - a.time);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { t }   = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const busId   = profile?.busId ?? '';

  const [events,    setEvents]   = useState<TripEvent[]>([]);
  const [isLoading, setLoading]  = useState(true);
  const [error,     setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!busId) { setLoading(false); return; }

    tripClient.listTripsForBus(busId)
      .then((trips) => setEvents(tripsToEvents(trips, t)))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [busId]);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          {t('alerts.today')}
        </SRText>
        <SRText variant="heading">{t('alerts.heading')}</SRText>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.sage} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <AlertCircle size={iconSize.lg} color={colors.gold} strokeWidth={2} />
          <SRText variant="body" color={colors.slate} style={styles.emptyText}>
            {t('alerts.loadError')}
          </SRText>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Clock size={iconSize.xl} color={colors.stone} strokeWidth={1.5} />
          <SRText variant="body" color={colors.slate} style={styles.emptyText}>
            {t('alerts.empty')}
          </SRText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {events.map((ev) => (
            <View key={ev.id} style={styles.row}>
              <View style={styles.iconBg}>
                {EVENT_ICON[ev.type]}
              </View>
              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <SRText variant="body" style={{ fontWeight: '500', flex: 1 }}>
                    {ev.title}
                  </SRText>
                  <SRText variant="caption" color={colors.slate}>
                    {formatTime(ev.time)}
                  </SRText>
                </View>
                <SRText variant="caption" color={colors.slate}>{ev.body}</SRText>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    padding:           spacing[6],
    paddingBottom:     spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  center: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing[3],
    paddingHorizontal: spacing[6],
  },
  emptyText: {
    textAlign:  'center',
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[4],
    gap:               spacing[3],
  },
  row: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing[3],
    paddingVertical:   spacing[3],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  iconBg: {
    width:           40,
    height:          40,
    borderRadius:    radius.md,
    backgroundColor: colors.sageAlpha18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  content:  { flex: 1, gap: spacing[1] },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
});
