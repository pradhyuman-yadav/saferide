import { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Map, Navigation, Bell, User, Bus, Crosshair } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useLiveTrack } from '@/hooks/useLiveTrack';
import { useBoardingStatus } from '@/hooks/useBoardingStatus';
import { useAuthStore } from '@/store/auth.store';
import { BusMarker } from '@/components/map/BusMarker';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { JADE_PEBBLE_MAP_STYLE } from '@/theme/mapStyle';

// Default map region — Bengaluru (shown when bus is offline)
const DEFAULT_REGION = {
  latitude:      12.9716,
  longitude:     77.5946,
  latitudeDelta:  0.08,
  longitudeDelta: 0.08,
};

export default function ParentHomeScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const mapRef  = useRef<MapView>(null);
  const profile = useAuthStore((s) => s.profile);
  const { t }   = useTranslation();

  function formatAge(ms: number): string {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 5)  return t('live.justNow');
    if (diff < 60) return t('live.secondsAgo', { n: diff });
    return t('live.minutesAgo', { n: Math.floor(diff / 60) });
  }

  const busId       = profile?.busId ?? '';
  const studentId   = profile?.studentId ?? '';
  const { location, isConnected } = useLiveTrack(busId);
  const boardingStatus = useBoardingStatus(busId);
  const myChildStatus  = studentId ? boardingStatus[studentId] : undefined;
  const isChildBoarded = myChildStatus?.status === 'boarded';

  // Locate-me: animate map to the user's current device position
  const handleLocateMe = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    mapRef.current?.animateToRegion(
      {
        latitude:      pos.coords.latitude,
        longitude:     pos.coords.longitude,
        latitudeDelta:  0.025,
        longitudeDelta: 0.025,
      },
      500,
    );
  }, []);

  // Smoothly follow the bus whenever its position changes
  useEffect(() => {
    if (!location) return;
    mapRef.current?.animateToRegion(
      {
        latitude:      location.lat,
        longitude:     location.lon,
        latitudeDelta:  0.025,
        longitudeDelta: 0.025,
      },
      700,
    );
  }, [location?.lat, location?.lon]);

  const busCoords = location
    ? { latitude: location.lat, longitude: location.lon }
    : null;

  // Short display label for the bus marker and card
  const busLabel = busId ? busId.slice(-4).toUpperCase() : '—';

  return (
    <View style={styles.container}>

      {/* ── Full-screen map ──────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        mapType="standard"
        customMapStyle={JADE_PEBBLE_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
      >
        {busCoords && (
          <BusMarker
            coords={busCoords}
            busNumber={busLabel}
            isActive={isConnected}
            heading={location?.heading !== null ? location?.heading : undefined}
          />
        )}
      </MapView>

      {/* ── Locate-me FAB (bottom-left, above card) ───────────────────── */}
      <TouchableOpacity
        style={[styles.locateFab, { bottom: 210 }]}
        onPress={handleLocateMe}
        activeOpacity={0.85}
      >
        <Crosshair size={iconSize.md} color={colors.forest} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── Live / Offline status pill (top-right) ───────────────────── */}
      <View style={[styles.statusPill, { top: insets.top + spacing[3] }]}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isConnected ? colors.sage : colors.slate },
          ]}
        />
        <SRText
          variant="label"
          color={isConnected ? colors.forest : colors.slate}
        >
          {isConnected ? t('live.statusLive') : t('live.statusOffline')}
        </SRText>
      </View>

      {/* ── Bottom card ──────────────────────────────────────────────── */}
      <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>

        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Trip state */}
        {isConnected && location ? (
          <LiveState
            childName={profile?.childName}
            busLabel={busLabel}
            location={location}
            formatAge={formatAge}
            isChildBoarded={isChildBoarded}
          />
        ) : (
          <OfflineState
            childName={profile?.childName}
            isChildBoarded={isChildBoarded}
          />
        )}

        {/* ── In-card tab navigation ───────────────────────────────── */}
        <View style={styles.tabRow}>
          <NavTab
            icon={<Map size={iconSize.md} color={colors.forest} strokeWidth={2} />}
            label={t('tab.live')}
            active
            onPress={() => {}}
          />
          <NavTab
            icon={<Navigation size={iconSize.md} color={colors.slate} strokeWidth={2} />}
            label={t('tab.route')}
            onPress={() => router.push('/(parent)/route')}
          />
          <NavTab
            icon={<Bell size={iconSize.md} color={colors.slate} strokeWidth={2} />}
            label={t('tab.alerts')}
            onPress={() => router.push('/(parent)/notifications')}
          />
          <NavTab
            icon={<User size={iconSize.md} color={colors.slate} strokeWidth={2} />}
            label={t('tab.profile')}
            onPress={() => router.push('/(parent)/profile')}
          />
        </View>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface LiveStateProps {
  childName?:     string;
  busLabel:       string;
  location:       { speed: number | null; updatedAt: number };
  formatAge:      (ms: number) => string;
  isChildBoarded: boolean;
}

function LiveState({ childName, busLabel, location, formatAge, isChildBoarded }: LiveStateProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.row}>
        <View style={styles.busIconWrap}>
          <Bus size={18} color={colors.forest} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <SRText variant="label" color={colors.slate}>
            {childName ? `${childName}'s bus` : `Bus ${busLabel}`}
          </SRText>
          <SRText variant="cardTitle">
            {t('live.busOnWay')}
          </SRText>
        </View>
        <SRText variant="caption" color={colors.slate}>
          {formatAge(location.updatedAt)}
        </SRText>
      </View>

      <View style={styles.badges}>
        <SRBadge label={t('live.onRoute')} variant="active" />
        {location.speed !== null && location.speed > 0 && (
          <SRBadge label={`${Math.round(location.speed)} ${t('live.kmh')}`} variant="muted" />
        )}
        <SRBadge
          label={isChildBoarded ? t('boarding.onBoard') : t('boarding.notBoarded')}
          variant={isChildBoarded ? 'active' : 'muted'}
        />
      </View>
    </>
  );
}

interface OfflineStateProps {
  childName?:     string;
  isChildBoarded: boolean;
}

function OfflineState({ childName, isChildBoarded }: OfflineStateProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.busIconWrap, styles.busIconOff]}>
          <Bus size={18} color={colors.slate} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <SRText variant="label" color={colors.slate}>
            {childName ?? 'Your child'}
          </SRText>
          <SRText variant="cardTitle">
            {t('live.busNotStarted')}
          </SRText>
        </View>
      </View>

      <View style={styles.badges}>
        <SRBadge
          label={isChildBoarded ? t('boarding.onBoard') : t('boarding.notBoarded')}
          variant={isChildBoarded ? 'active' : 'muted'}
        />
      </View>

      <SRText variant="caption" color={colors.slate} style={styles.offlineHint}>
        {t('live.busNotStartedHint')}
      </SRText>
    </>
  );
}

interface NavTabProps {
  icon:    React.ReactNode;
  label:   string;
  active?: boolean;
  onPress: () => void;
}

function NavTab({ icon, label, active = false, onPress }: NavTabProps) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <SRText
        variant="label"
        color={active ? colors.forest : colors.slate}
        style={active ? [styles.tabLabel, styles.tabLabelActive] : styles.tabLabel}
      >
        {label}
      </SRText>
      {active && <View style={styles.tabDot} />}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Locate-me FAB
  locateFab: {
    position:        'absolute',
    left:            spacing[4],
    width:           44,
    height:          44,
    borderRadius:    radius.full,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.12,
    shadowRadius:    6,
    elevation:       6,
  },

  // Status pill
  statusPill: {
    position:         'absolute',
    right:            spacing[4],
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing[1],
    backgroundColor:  colors.white,
    paddingHorizontal: spacing[3],
    paddingVertical:  spacing[1],
    borderRadius:     radius.full,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.10,
    shadowRadius:     4,
    elevation:        3,
  },
  statusDot: {
    width:        6,
    height:       6,
    borderRadius: radius.full,
  },

  // Bottom card
  card: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      colors.white,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingTop:           spacing[2],
    paddingHorizontal:    spacing[6],
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -3 },
    shadowOpacity:        0.08,
    shadowRadius:         12,
    elevation:            12,
  },
  handle: {
    alignSelf:        'center',
    width:            36,
    height:           4,
    borderRadius:     radius.full,
    backgroundColor:  colors.stone,
    marginBottom:     spacing[4],
  },

  // Live state
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing[3],
    marginBottom:   spacing[3],
  },
  busIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    radius.full,
    backgroundColor: colors.sageAlpha18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  busIconOff: {
    backgroundColor: colors.slateAlpha15,
  },
  badges: {
    flexDirection: 'row',
    gap:           spacing[2],
    marginBottom:  spacing[5],
  },

  // Offline state
  offlineHint: {
    marginBottom: spacing[5],
    lineHeight:   18,
  },

  // In-card tab row
  tabRow: {
    flexDirection:    'row',
    justifyContent:   'space-around',
    borderTopWidth:   StyleSheet.hairlineWidth,
    borderTopColor:   colors.stone,
    paddingTop:       spacing[3],
    marginTop:        spacing[1],
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    gap:            spacing[1],
    paddingVertical: spacing[1],
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: colors.forest,
  },
  tabDot: {
    width:           4,
    height:          4,
    borderRadius:    radius.full,
    backgroundColor: colors.sage,
  },
});
