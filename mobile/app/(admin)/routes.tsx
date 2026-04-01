import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bus, MapPin, Route as RouteIcon } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient, type Route, type Bus as BusType, type Driver } from '@/api/route.client';

interface RouteEntry {
  route:  Route;
  bus:    BusType | null;
  driver: Driver  | null;
}

export default function AdminRoutesScreen() {
  const [entries,   setEntries]   = useState<RouteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const [routes, buses, drivers] = await Promise.all([
        routeClient.listRoutes(),
        routeClient.listBuses(),
        routeClient.listDrivers(),
      ]);

      // Map<busId, Bus> and Map<driverId, Driver> for O(1) lookups
      const driverMap = new Map(drivers.map((d) => [d.id, d]));

      const built: RouteEntry[] = routes.map((route) => {
        const bus    = buses.find((b) => b.routeId === route.id) ?? null;
        const driver = bus?.driverId ? (driverMap.get(bus.driverId) ?? null) : null;
        return { route, bus, driver };
      });

      // Active routes first
      built.sort((a, b) => {
        if (a.route.isActive && !b.route.isActive) return -1;
        if (!a.route.isActive && b.route.isActive)  return  1;
        return 0;
      });

      setEntries(built);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load routes.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    void load(true);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>Fleet management</SRText>
            <SRText variant="heading">Routes</SRText>
          </View>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.sage} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
            Fleet management
          </SRText>
          <SRText variant="heading">Routes</SRText>
        </View>
        <SRButton
          label="Add route"
          variant="secondary"
          size="sm"
          onPress={() => Alert.alert('Add route', 'Use the web portal to create and manage routes.')}
        />
      </View>

      {error ? (
        <View style={styles.center}>
          <SRText variant="caption" color={colors.slate}>{error}</SRText>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.route.id}
          contentContainerStyle={entries.length === 0 ? styles.centerList : styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <RouteIcon size={iconSize.xl} color={colors.stone} strokeWidth={1.5} />
              <SRText variant="body" color={colors.slate} style={{ marginTop: spacing[3], textAlign: 'center' }}>
                No routes yet.
              </SRText>
              <SRText variant="caption" style={{ marginTop: spacing[1], textAlign: 'center' }}>
                Add routes from the web portal.
              </SRText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <SRText variant="body" style={{ fontWeight: '500', flex: 1 }}>
                  {item.route.name}
                </SRText>
                <SRBadge
                  label={item.route.isActive ? 'Active' : 'Inactive'}
                  variant={item.route.isActive ? 'active' : 'muted'}
                />
              </View>

              <View style={styles.meta}>
                <MetaItem
                  icon={<Bus size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
                  label={item.bus
                    ? `${item.bus.registrationNumber} · ${item.driver?.name ?? 'No driver'}`
                    : 'No bus assigned'}
                />
                {item.route.description ? (
                  <MetaItem
                    icon={<MapPin size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
                    label={item.route.description}
                  />
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function MetaItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      {icon}
      <SRText variant="caption">{label}</SRText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-end',
    padding:           spacing[6],
    paddingBottom:     spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  list:       { padding: spacing[6], gap: spacing[3] },
  centerList: { flex: 1 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[10] },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    padding:         spacing[4],
    borderWidth:     0.5,
    borderColor:     colors.stone,
    gap:             spacing[2],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  meta: { gap: spacing[1] },
});
