import { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { colors, spacing, radius, iconSize } from '@/theme';
import { tripClient } from '@/api/trip.client';
import type { Trip } from '@/api/trip.client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
  });
}

function formatDuration(startMs: number, endMs?: number): string {
  if (!endMs) return '—';
  const minutes = Math.round((endMs - startMs) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DriverHistoryScreen() {
  const [trips,     setTrips]     = useState<Trip[]>([]);
  const [isLoading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    tripClient.listMyTrips()
      .then((data) => {
        if (!cancelled) {
          // Show ended trips only in history; skip any still-active trip
          setTrips(data.filter((t) => t.status === 'ended'));
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message ?? 'Could not load trip history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          Past trips
        </SRText>
        <SRText variant="heading">Trip history</SRText>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.sage} />
        </View>
      )}

      {!isLoading && loadError !== null && (
        <View style={styles.center}>
          <SRText variant="body" color={colors.slate} style={{ textAlign: 'center', paddingHorizontal: spacing[8] }}>
            {loadError}
          </SRText>
        </View>
      )}

      {!isLoading && loadError === null && trips.length === 0 && (
        <View style={styles.center}>
          <SRText variant="body" color={colors.slate} style={{ textAlign: 'center', paddingHorizontal: spacing[8] }}>
            No completed trips yet. Your history will appear here after your first trip.
          </SRText>
        </View>
      )}

      {!isLoading && loadError === null && trips.length > 0 && (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <TripCard trip={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── TripCard ──────────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: Trip }) {
  const duration = formatDuration(trip.startedAt, trip.endedAt);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.dateRow}>
          <Calendar size={iconSize.sm} color={colors.slate} strokeWidth={2} />
          <SRText variant="body" style={{ fontWeight: '500' }}>
            {formatDate(trip.startedAt)}
          </SRText>
        </View>
        <View style={styles.statusRow}>
          <CheckCircle size={14} color={colors.sage} strokeWidth={2} />
          <SRText variant="caption" color={colors.sage} style={{ fontWeight: '500' }}>
            Completed
          </SRText>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Clock size={iconSize.sm} color={colors.slate} strokeWidth={2} />
          <SRText variant="caption">{duration}</SRText>
        </View>
        {trip.latestSpeed !== undefined && trip.latestSpeed > 0 && (
          <View style={styles.metaItem}>
            <AlertCircle size={iconSize.sm} color={colors.slate} strokeWidth={2} />
            <SRText variant="caption">Peak {Math.round(trip.latestSpeed)} km/h</SRText>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
    paddingVertical: spacing[16],
  },
  list: { padding: spacing[6], gap: spacing[3] },
  card: {
    backgroundColor:  colors.surface,
    borderRadius:     radius.xl,
    padding:          spacing[4],
    borderWidth:      0.5,
    borderColor:      colors.stone,
    gap:              spacing[2],
  },
  cardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  metaRow: {
    flexDirection: 'row',
    gap:           spacing[4],
    marginTop:     spacing[1],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1],
  },
});
