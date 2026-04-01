import { useEffect, useRef, useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, WifiOff, CheckCircle } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient, type Bus, type Driver } from '@/api/route.client';
import { tripClient, type Trip } from '@/api/trip.client';

// ── Alert model ───────────────────────────────────────────────────────────────

type AlertKind = 'sos' | 'offline';

interface LiveAlert {
  id:           string;
  kind:         AlertKind;
  bus:          Bus;
  driver:       Driver | null;
  trip:         Trip   | null;
  occurredAt:   number;
}

// ── Hook — derives real alerts from fleet state, polls every 20 s ─────────────

function useAlerts() {
  const [alerts,    setAlerts]    = useState<LiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [buses, drivers] = await Promise.all([
        routeClient.listBuses(),
        routeClient.listDrivers(),
      ]);

      const driverMap = new Map(drivers.map((d) => [d.id, d]));

      const activeTrips = await Promise.all(
        buses.map((b) => tripClient.getActiveForBus(b.id).catch(() => null)),
      );

      const derived: LiveAlert[] = [];

      buses.forEach((bus, i) => {
        const trip   = activeTrips[i] ?? null;
        const driver = bus.driverId ? (driverMap.get(bus.driverId) ?? null) : null;

        // SOS: trip is active and driver triggered SOS
        if (trip?.sosActive === true) {
          derived.push({
            id:         `sos-${bus.id}`,
            kind:       'sos',
            bus,
            driver,
            trip,
            occurredAt: trip.sosTriggeredAt ?? trip.updatedAt,
          });
        }

        // Offline: active bus (has driver assigned) but no active trip
        // or ping is stale > 5 minutes during a trip
        const isStale = trip !== null && trip.latestRecordedAt !== undefined
          && (Date.now() - trip.latestRecordedAt) > 5 * 60 * 1000;

        if (bus.status === 'active' && bus.driverId !== null && trip === null) {
          derived.push({
            id:         `offline-${bus.id}`,
            kind:       'offline',
            bus,
            driver,
            trip:       null,
            occurredAt: Date.now(),
          });
        } else if (isStale) {
          derived.push({
            id:         `stale-${bus.id}`,
            kind:       'offline',
            bus,
            driver,
            trip,
            occurredAt: trip?.latestRecordedAt ?? Date.now(),
          });
        }
      });

      // SOS first, then offline, newest within each group
      derived.sort((a, b) => {
        if (a.kind === 'sos' && b.kind !== 'sos') return -1;
        if (a.kind !== 'sos' && b.kind === 'sos')  return  1;
        return b.occurredAt - a.occurredAt;
      });

      setAlerts(derived);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => { void load(); }, 20_000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [load]);

  return { alerts, isLoading, error, refresh: load };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ManagerAlertsScreen() {
  const { alerts, isLoading, error, refresh } = useAlerts();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const sosCount = alerts.filter((a) => a.kind === 'sos').length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          Requires attention
        </SRText>
        <SRText variant="heading">Alerts</SRText>
        {sosCount > 0 && (
          <SRBadge
            label={`${sosCount} SOS active`}
            variant="alert"
            style={{ marginTop: spacing[2] }}
          />
        )}
      </View>

      {isLoading && alerts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.sage} />
          <SRText variant="caption" color={colors.slate} style={{ marginTop: spacing[2] }}>
            Checking fleet…
          </SRText>
        </View>
      ) : error !== null ? (
        <View style={styles.center}>
          <SRText variant="body" color={colors.gold}>{error}</SRText>
          <TouchableOpacity onPress={() => { void refresh(); }} style={{ marginTop: spacing[3] }}>
            <SRText variant="caption" color={colors.slate}>Tap to retry</SRText>
          </TouchableOpacity>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.center}>
          <CheckCircle size={iconSize.xl} color={colors.sage} strokeWidth={1.5} />
          <SRText variant="body" color={colors.forest} style={{ marginTop: spacing[3] }}>
            All clear
          </SRText>
          <SRText variant="caption" color={colors.slate} style={{ marginTop: spacing[1], textAlign: 'center' }}>
            No active SOS alerts or offline buses.
          </SRText>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
          renderItem={({ item }) => <AlertRow alert={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: LiveAlert }) {
  const isSOS = alert.kind === 'sos';

  const timeLabel = formatTime(alert.occurredAt);
  const message   = isSOS
    ? `SOS triggered${alert.trip?.latestLat !== undefined ? ' — location available' : ''}`
    : alert.trip !== null
      ? `No GPS ping for ${formatStaleness(alert.trip.latestRecordedAt)}`
      : 'Bus has no active trip';

  return (
    <View style={[styles.card, isSOS && styles.cardSOS]}>
      <View style={[styles.iconBg, isSOS && styles.iconBgSOS]}>
        {isSOS
          ? <AlertTriangle size={iconSize.md} color={colors.badgeAlertFg} strokeWidth={2} />
          : <WifiOff       size={iconSize.md} color={colors.gold}         strokeWidth={2} />
        }
      </View>
      <View style={styles.info}>
        <View style={styles.topRow}>
          <SRText variant="body" style={{ fontWeight: '500', flex: 1 }}>
            {alert.bus.registrationNumber}
            {alert.driver !== null ? ` — ${alert.driver.name}` : ''}
          </SRText>
          <SRText variant="caption" color={colors.slate}>{timeLabel}</SRText>
        </View>
        <SRText variant="caption" color={colors.slate}>{message}</SRText>
        <SRBadge
          label={isSOS ? 'SOS active' : 'offline'}
          variant={isSOS ? 'alert' : 'muted'}
          style={{ marginTop: spacing[1], alignSelf: 'flex-start' }}
        />
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000)         return 'just now';
  if (diff < 3_600_000)      return `${Math.round(diff / 60_000)}m ago`;
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatStaleness(ms: number | undefined): string {
  if (ms === undefined) return 'unknown duration';
  const mins = Math.round((Date.now() - ms) / 60_000);
  return `${mins} minute${mins === 1 ? '' : 's'}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  header: {
    padding:           spacing[6],
    paddingBottom:     spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  list:   { padding: spacing[6], gap: spacing[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },

  card: {
    flexDirection:   'row',
    alignItems:      'flex-start',   // icon and text both anchor to top
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    padding:         spacing[4],
    borderWidth:     0.5,
    borderColor:     colors.stone,
    gap:             spacing[3],
  },
  cardSOS: {
    borderColor: colors.badgeAlertBg,
    borderWidth: 1.5,
    backgroundColor: colors.badgeAlertBg + '18',
  },
  iconBg: {
    width:           48,
    height:          48,
    borderRadius:    radius.lg,
    backgroundColor: colors.goldAlpha20,
    alignItems:      'center',
    justifyContent:  'center',
    // Keep icon block top-aligned with the first line of text
    marginTop:       2,
  },
  iconBgSOS:  { backgroundColor: colors.badgeAlertBg },
  info:       { flex: 1, gap: spacing[1] },
  // alignItems: 'flex-start' pins the timestamp to the top even when the
  // bus name + driver text wraps to a second line
  topRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
});
