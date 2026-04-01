import { useEffect, useRef, useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wifi, WifiOff, Gauge, AlertTriangle } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient, type Bus, type Driver, type Route } from '@/api/route.client';
import { tripClient, type Trip } from '@/api/trip.client';

// ── Fleet entry — bus enriched with driver name, route name, live trip ────────

interface FleetEntry {
  bus:        Bus;
  driver:     Driver | null;
  route:      Route  | null;
  activeTrip: Trip   | null;
}

// ── Hook — fetches and joins all fleet data, polls every 15 s ─────────────────

function useFleet() {
  const [fleet,     setFleet]     = useState<FleetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      // 1. Fetch buses, drivers, routes in parallel (3 calls)
      const [buses, drivers, routes] = await Promise.all([
        routeClient.listBuses(),
        routeClient.listDrivers(),
        routeClient.listRoutes(),
      ]);

      // Build lookup maps so we don't scan arrays repeatedly
      const driverMap = new Map(drivers.map((d) => [d.id, d]));
      const routeMap  = new Map(routes.map((r)  => [r.id, r]));

      // 2. Fetch active trip for every bus in parallel (N calls)
      const activeTrips = await Promise.all(
        buses.map((b) => tripClient.getActiveForBus(b.id).catch(() => null)),
      );

      const entries: FleetEntry[] = buses.map((bus, i) => ({
        bus,
        driver:     bus.driverId ? (driverMap.get(bus.driverId) ?? null) : null,
        route:      bus.routeId  ? (routeMap.get(bus.routeId)   ?? null) : null,
        activeTrip: activeTrips[i] ?? null,
      }));

      // Sort: active trips first, then idle buses
      entries.sort((a, b) => {
        if (a.activeTrip && !b.activeTrip) return -1;
        if (!a.activeTrip && b.activeTrip)  return  1;
        return 0;
      });

      setFleet(entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fleet.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => { void load(); }, 15_000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [load]);

  return { fleet, isLoading, error, refresh: load };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ManagerFleetScreen() {
  const { fleet, isLoading, error, refresh } = useFleet();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const active  = fleet.filter((e) => e.activeTrip !== null).length;
  const sos     = fleet.filter((e) => e.activeTrip?.sosActive === true).length;
  const total   = fleet.length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          Fleet overview
        </SRText>
        <SRText variant="heading">All buses</SRText>

        <View style={styles.stats}>
          <Pill label={`${active} active`}      color={colors.sage} />
          {sos > 0 && <Pill label={`${sos} SOS`} color={colors.badgeAlertFg} />}
          <Pill label={`${total - active} idle`} color={colors.gold} />
          <Pill label={`${total} total`}         color={colors.slate} />
        </View>
      </View>

      {isLoading && fleet.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.sage} />
          <SRText variant="caption" color={colors.slate} style={{ marginTop: spacing[2] }}>
            Loading fleet…
          </SRText>
        </View>
      ) : error !== null ? (
        <View style={styles.center}>
          <SRText variant="body" color={colors.gold}>{error}</SRText>
          <TouchableOpacity onPress={() => { void refresh(); }} style={{ marginTop: spacing[3] }}>
            <SRText variant="caption" color={colors.slate}>Tap to retry</SRText>
          </TouchableOpacity>
        </View>
      ) : fleet.length === 0 ? (
        <View style={styles.center}>
          <SRText variant="body" color={colors.slate}>No buses added yet.</SRText>
        </View>
      ) : (
        <FlatList
          data={fleet}
          keyExtractor={(item) => item.bus.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />}
          renderItem={({ item }) => <BusRow entry={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Bus row ───────────────────────────────────────────────────────────────────

function BusRow({ entry }: { entry: FleetEntry }) {
  const { bus, driver, route, activeTrip } = entry;
  const isOnline  = activeTrip !== null;
  const hasSOS    = activeTrip?.sosActive === true;
  const speedKmh  = activeTrip?.latestSpeed ?? null;
  const pingAt    = activeTrip?.latestRecordedAt ?? null;

  const age = pingAt !== null ? Math.round((Date.now() - pingAt) / 1000) : null;
  const ageLabel = age === null
    ? null
    : age < 10
      ? 'just now'
      : age < 60
        ? `${age}s ago`
        : `${Math.round(age / 60)}m ago`;

  return (
    <TouchableOpacity activeOpacity={0.8} style={[styles.card, hasSOS && styles.cardSOS]}>
      {/* Bus number badge + optional SOS indicator below it */}
      <View style={styles.cardLeft}>
        <View style={[styles.busBadge, { backgroundColor: isOnline ? colors.forest : colors.stone }]}>
          <SRText variant="label" color={isOnline ? colors.mist : colors.slate} style={{ textAlign: 'center' }}>
            {bus.registrationNumber}
          </SRText>
        </View>
        {hasSOS && (
          <View style={styles.sosDot}>
            <AlertTriangle size={10} color={colors.badgeAlertFg} strokeWidth={2} />
            <SRText variant="label" color={colors.badgeAlertFg}>SOS</SRText>
          </View>
        )}
      </View>

      {/* Driver / route info */}
      <View style={styles.cardMid}>
        <SRText variant="body" style={{ fontWeight: '500' }}>
          {driver?.name ?? 'Unassigned'}
        </SRText>
        <SRText variant="caption" color={colors.slate}>
          {route?.name ?? 'No route assigned'}
        </SRText>
        {ageLabel !== null && (
          <SRText variant="caption" color={colors.slate}>
            Updated {ageLabel}
          </SRText>
        )}
      </View>

      {/* Status + speed */}
      <View style={styles.cardRight}>
        <SRBadge
          label={hasSOS ? 'SOS' : isOnline ? 'on route' : 'idle'}
          variant={hasSOS ? 'alert' : isOnline ? 'active' : 'muted'}
        />
        {speedKmh !== null && (
          <View style={styles.speed}>
            <Gauge size={iconSize.sm} color={colors.slate} strokeWidth={2} />
            <SRText variant="caption">{Math.round(speedKmh)} km/h</SRText>
          </View>
        )}
        {isOnline
          ? <Wifi    size={iconSize.sm} color={colors.sage}  strokeWidth={2} />
          : <WifiOff size={iconSize.sm} color={colors.stone} strokeWidth={2} />
        }
      </View>
    </TouchableOpacity>
  );
}

// ── Pill stat chip ────────────────────────────────────────────────────────────

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: color + '22' }]}>
      <SRText variant="label" color={color}>{label}</SRText>
    </View>
  );
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
  stats:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  list:   { padding: spacing[6], gap: spacing[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },

  card: {
    flexDirection:   'row',
    alignItems:      'flex-start',   // anchor all columns to the top
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
  },
  // paddingTop optically aligns the badge top with the first line of text
  cardLeft:  { alignItems: 'center', paddingTop: 2 },
  cardMid:   { flex: 1, gap: spacing[1] },
  cardRight: { alignItems: 'flex-end', gap: spacing[2] },

  busBadge: {
    // Wider to fit full registration numbers (e.g. "7XTR234")
    minWidth:       52,
    height:         52,
    borderRadius:   radius.lg,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
  },
  // Inline SOS indicator — sits below the badge, no absolute positioning
  sosDot: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             2,
    marginTop:       spacing[1],
    paddingVertical:  2,
    paddingHorizontal: spacing[1],
    backgroundColor: colors.badgeAlertBg,
    borderRadius:    radius.full,
  },
  speed: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});

const pillStyles = StyleSheet.create({
  pill: {
    paddingVertical:   spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius:      radius.full,
  },
});
