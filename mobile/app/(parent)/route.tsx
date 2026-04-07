/**
 * Route overview screen — parent-facing.
 *
 * Shows the ordered list of stops on the child's bus route, with
 * reached/upcoming state and live ETAs. When the bus is live (RTDB
 * connection active) a speed badge appears in the header.
 *
 * Stop data comes from route-service; connection + speed from RTDB.
 * ETA = estimatedOffsetMinutes - elapsed minutes since trip started.
 */

import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Circle, MapPin, Zap, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useLiveTrack } from '@/hooks/useLiveTrack';
import { useAuthStore } from '@/store/auth.store';
import { tripClient } from '@/api/trip.client';
import { routeClient } from '@/api/route.client';
import type { Stop, Driver } from '@/api/route.client';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';

// ── Derived stop shape ────────────────────────────────────────────────────────

interface StopRow {
  id:          string;
  name:        string;
  etaMinutes:  number;   // 0 = arriving now; only meaningful when connected
  reached:     boolean;
}

function deriveStops(stops: Stop[], tripStartedAt: number | null, isConnected: boolean): StopRow[] {
  return stops.map((s) => {
    if (!isConnected || tripStartedAt === null) {
      return { id: s.id, name: s.name, etaMinutes: 0, reached: false };
    }
    const elapsedMin = (Date.now() - tripStartedAt) / 60_000;
    const reached    = elapsedMin >= s.estimatedOffsetMinutes;
    const etaMinutes = reached ? 0 : Math.max(0, Math.ceil(s.estimatedOffsetMinutes - elapsedMin));
    return { id: s.id, name: s.name, etaMinutes, reached };
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RouteScreen() {
  const { t }   = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const busId   = profile?.busId ?? '';

  const { location, isConnected } = useLiveTrack(busId);

  const [rawStops,      setRawStops]      = useState<Stop[]>([]);
  const [driver,        setDriver]        = useState<Driver | null>(null);
  const [routeName,     setRouteName]     = useState<string | null>(null);
  const [tripStartedAt, setTripStartedAt] = useState<number | null>(null);
  const [isLoading,     setLoading]       = useState(true);

  useEffect(() => {
    if (!busId) { setLoading(false); return; }

    void (async () => {
      try {
        const bus = await routeClient.getBus(busId).catch(() => null);
        if (!bus) return;

        const [route, stops, driverData, activeTrip] = await Promise.all([
          bus.routeId  ? routeClient.getRoute(bus.routeId).catch(() => null)    : Promise.resolve(null),
          bus.routeId  ? routeClient.listStops(bus.routeId).catch((): Stop[] => [])  : Promise.resolve([]),
          bus.driverId ? routeClient.getDriver(bus.driverId).catch(() => null)  : Promise.resolve(null),
          tripClient.getActiveForBus(busId).catch(() => null),
        ]);

        if (route)      setRouteName(route.name);
        if (driverData) setDriver(driverData);
        setRawStops(stops);
        if (activeTrip) setTripStartedAt(activeTrip.startedAt);
      } finally {
        setLoading(false);
      }
    })();
  }, [busId]);

  const stops       = deriveStops(rawStops, tripStartedAt, isConnected);
  const speed       = location?.speed;
  const busLabel    = busId ? t('route.bus', { id: busId.slice(-4).toUpperCase() }) : 'Bus —';
  const driverLabel = driver?.name ?? t('route.driver');

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          {t('route.routeOverview')}
        </SRText>
        <SRText variant="heading">{routeName ?? '—'}</SRText>

        <View style={styles.badgeRow}>
          <SRBadge
            label={busLabel}
            variant={isConnected ? 'active' : 'muted'}
          />
          <SRBadge label={driverLabel} variant="muted" />
          {isConnected && speed !== null && speed !== undefined && speed > 0 && (
            <View style={styles.speedChip}>
              <Zap size={11} color={colors.sage} strokeWidth={2} />
              <SRText variant="caption" color={colors.sage} style={{ fontWeight: '500' }}>
                {Math.round(speed)} km/h
              </SRText>
            </View>
          )}
        </View>

        {/* Offline notice */}
        {!isConnected && (
          <View style={styles.offlineNotice}>
            <WifiOff size={13} color={colors.slate} strokeWidth={2} />
            <SRText variant="caption" color={colors.slate}>
              {t('route.notStarted')}
            </SRText>
          </View>
        )}
      </View>

      {/* ── Stop list ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.sage} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {stops.map((stop, i) => {
            const isLast    = i === stops.length - 1;
            const isCurrent = !stop.reached && (i === 0 || stops[i - 1]?.reached);

            return (
              <View key={stop.id} style={styles.stopRow}>

                {/* Timeline connector */}
                {!isLast && (
                  <View
                    style={[
                      styles.line,
                      stop.reached ? styles.lineReached : styles.linePending,
                    ]}
                  />
                )}

                {/* Icon */}
                <View style={[styles.iconWrap, isCurrent && styles.iconWrapCurrent]}>
                  {isLast ? (
                    <MapPin      size={iconSize.md} color={colors.forest} strokeWidth={2} />
                  ) : stop.reached ? (
                    <CheckCircle size={iconSize.md} color={colors.sage}   strokeWidth={2} />
                  ) : (
                    <Circle      size={iconSize.md} color={isConnected ? colors.stone : colors.mist} strokeWidth={2} />
                  )}
                </View>

                {/* Stop info */}
                <View style={styles.stopInfo}>
                  <SRText
                    variant="body"
                    color={
                      stop.reached  ? colors.slate  :
                      isCurrent     ? colors.forest :
                      colors.ink
                    }
                    style={{ fontWeight: isCurrent ? '500' : '400' }}
                  >
                    {stop.name}
                  </SRText>

                  {isConnected && !stop.reached && (
                    <SRText variant="caption" color={colors.slate}>
                      {stop.etaMinutes === 0
                        ? t('route.arrivingNow')
                        : t('route.minutes', { n: stop.etaMinutes })}
                    </SRText>
                  )}
                </View>

                {/* "Next stop" badge */}
                {isCurrent && isConnected && (
                  <SRBadge label={t('route.nextStop')} variant="alert" />
                )}
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

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    padding:           spacing[6],
    paddingBottom:     spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
    gap:               spacing[2],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing[2],
    marginTop:     spacing[1],
  },
  speedChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: spacing[2],
    paddingVertical:   2,
    backgroundColor:   colors.sageAlpha18,
    borderRadius:      radius.full,
  },
  offlineNotice: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    marginTop:         spacing[1],
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor:   colors.slateAlpha15,
    borderRadius:      radius.md,
  },

  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Stop list ────────────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[4],
  },
  stopRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing[3],
    gap:             spacing[3],
    position:        'relative',
  },
  line: {
    position:  'absolute',
    left:      iconSize.md / 2 - 1,
    top:       spacing[3] + iconSize.md,
    width:     2,
    height:    spacing[6] + spacing[3],
  },
  lineReached: { backgroundColor: colors.sage  },
  linePending: { backgroundColor: colors.stone },
  iconWrap: {
    width:      iconSize.md + spacing[2],
    alignItems: 'center',
  },
  iconWrapCurrent: {},
  stopInfo: { flex: 1 },
});
