/**
 * History screen — parent-facing.
 *
 * Shows the trip history for the child's assigned bus: date, duration,
 * and status badge for each completed trip. Pulls real data from
 * trip-service via tripClient.listTripsForBus().
 */

import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { tripClient } from '@/api/trip.client';
import type { Trip } from '@/api/trip.client';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function durationMin(start: number, end: number): number {
  return Math.round((end - start) / 60_000);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ParentHistoryScreen() {
  const profile = useAuthStore((s) => s.profile);
  const busId   = profile?.busId ?? '';

  const [trips,     setTrips]     = useState<Trip[]>([]);
  const [isLoading, setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!busId) {
      setLoading(false);
      return;
    }

    tripClient.listTripsForBus(busId)
      .then((data) => setTrips(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [busId]);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          Past trips
        </SRText>
        <SRText variant="heading">Trip history</SRText>
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
            Could not load trip history.
          </SRText>
        </View>
      ) : !busId ? (
        <View style={styles.center}>
          <SRText variant="body" color={colors.slate} style={styles.emptyText}>
            No bus assigned to your child yet.
          </SRText>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.center}>
          <Clock size={iconSize.xl} color={colors.stone} strokeWidth={1.5} />
          <SRText variant="body" color={colors.slate} style={styles.emptyText}>
            No trips recorded yet.
          </SRText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {trips.map((trip) => {
            const isCompleted = trip.status === 'ended' && !!trip.endedAt;
            const duration    = isCompleted ? durationMin(trip.startedAt, trip.endedAt!) : null;

            return (
              <View key={trip.id} style={styles.card}>
                {/* Left: icon */}
                <View style={[styles.iconWrap, isCompleted ? styles.iconCompleted : styles.iconActive]}>
                  {isCompleted
                    ? <CheckCircle size={iconSize.md} color={colors.sage}  strokeWidth={2} />
                    : <Clock       size={iconSize.md} color={colors.gold}  strokeWidth={2} />}
                </View>

                {/* Centre: date + time range */}
                <View style={styles.info}>
                  <SRText variant="body" style={{ fontWeight: '500' }}>
                    {formatDate(trip.startedAt)}
                  </SRText>
                  <SRText variant="caption" color={colors.slate}>
                    {formatTime(trip.startedAt)}
                    {trip.endedAt ? ` – ${formatTime(trip.endedAt)}` : ' – ongoing'}
                  </SRText>
                </View>

                {/* Right: badges */}
                <View style={styles.badges}>
                  <SRBadge
                    label={isCompleted ? 'Completed' : 'Active'}
                    variant={isCompleted ? 'active' : 'alert'}
                  />
                  {duration !== null && (
                    <SRText variant="caption" color={colors.slate}>
                      {`${duration} min`}
                    </SRText>
                  )}
                </View>
              </View>
            );
          })}
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
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[3],
    paddingHorizontal: spacing[6],
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },

  list: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[4],
    gap:               spacing[3],
  },

  card: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing[3],
    padding:        spacing[4],
    backgroundColor: colors.white,
    borderRadius:   radius.xl,
    borderWidth:    0.5,
    borderColor:    colors.stone,
  },

  iconWrap: {
    width:          40,
    height:         40,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconCompleted: { backgroundColor: colors.sageAlpha18 },
  iconActive:    { backgroundColor: colors.badgeAlertBg ?? colors.sageAlpha18 },

  info: {
    flex: 1,
    gap:  2,
  },

  badges: {
    alignItems: 'flex-end',
    gap:        spacing[1],
  },
});
