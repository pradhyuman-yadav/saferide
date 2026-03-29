/**
 * Driver trip screen — full-screen map, Google Maps-style.
 *
 * Layout:
 *   • MapView fills the entire screen (sits behind everything)
 *   • Status pill + speed badge float at the top (safe-area aware)
 *   • Dismissable bottom sheet with two snap points:
 *       expanded  → shows route/bus info, full action button, SOS
 *       collapsed → peek strip with bus reg + compact action button
 *   • Floating SOS button appears when sheet is collapsed during an active trip
 *   • Tab bar remains visible so History / Profile are always reachable
 *
 * Location:
 *   • Foreground: watchPositionAsync drives the marker + camera follow
 *   • Background: location.task.ts sends GPS pings to trip-service every 10 s
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Navigation, Zap, Crosshair } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, iconSize } from '@/theme';
import { tripClient } from '@/api/trip.client';
import type { Trip } from '@/api/trip.client';
import { routeClient } from '@/api/route.client';
import type { Bus, Route, Stop } from '@/api/route.client';
import { startLocationTracking, stopLocationTracking } from '@/tasks/location.task';

// ── Sheet snap constants ───────────────────────────────────────────────────────

const SHEET_PEEK    = 88;                         // handle (28) + peek row (60)
const SHEET_FULL    = 272;                        // peek + expanded content
const COLLAPSE_TO   = SHEET_FULL - SHEET_PEEK;   // translateY distance to collapse

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriverCoords {
  latitude:  number;
  longitude: number;
  speed?:    number; // km/h, already converted
}

// ── Default region (Bengaluru) ────────────────────────────────────────────────

const DEFAULT_REGION = {
  latitude:      12.9716,
  longitude:     77.5946,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DriverTripScreen() {
  const { profile }  = useAuthStore();
  const insets       = useSafeAreaInsets();
  const mapRef       = useRef<MapView>(null);

  const [trip,           setTrip]           = useState<Trip | null>(null);
  const [busInfo,        setBusInfo]        = useState<Bus | null>(null);
  const [routeInfo,      setRouteInfo]      = useState<Route | null>(null);
  const [stops,          setStops]          = useState<Stop[]>([]);
  const [isLoading,      setLoading]        = useState(true);
  const [isBusy,         setBusy]           = useState(false);
  const [driverLocation, setDriverLocation] = useState<DriverCoords | null>(null);

  // ── Sheet animation ─────────────────────────────────────────────────────────
  const sheetY    = useRef(new Animated.Value(0)).current;   // 0 = expanded
  const lastSnap  = useRef(0);                               // tracks current snap position

  const snapSheet = useCallback((toValue: number) => {
    lastSnap.current = toValue;
    Animated.spring(sheetY, {
      toValue,
      useNativeDriver: true,
      bounciness:      2,
    }).start();
  }, [sheetY]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sheetY.setOffset(lastSnap.current);
        sheetY.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dy: sheetY }], { useNativeDriver: true }),
      onPanResponderRelease: (_, { dy, vy }) => {
        sheetY.flattenOffset();
        // Tap (no real movement) → toggle
        if (Math.abs(dy) < 6) {
          const next = lastSnap.current === 0 ? COLLAPSE_TO : 0;
          lastSnap.current = next;
          Animated.spring(sheetY, { toValue: next, useNativeDriver: true, bounciness: 2 }).start();
          return;
        }
        // Drag → snap to nearest
        const total         = lastSnap.current + dy;
        const shouldCollapse = total > COLLAPSE_TO / 2 || vy > 0.5;
        const snapTo        = shouldCollapse ? COLLAPSE_TO : 0;
        lastSnap.current    = snapTo;
        Animated.spring(sheetY, { toValue: snapTo, useNativeDriver: true, bounciness: 2 }).start();
      },
    })
  ).current;

  // Derived animated values
  const expandedOpacity = sheetY.interpolate({
    inputRange:   [0, COLLAPSE_TO * 0.35],
    outputRange:  [1, 0],
    extrapolate:  'clamp',
  });
  const sosFabOpacity = sheetY.interpolate({
    inputRange:   [COLLAPSE_TO * 0.55, COLLAPSE_TO],
    outputRange:  [0, 1],
    extrapolate:  'clamp',
  });

  // ── Fetch active trip + assignment info on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const busId   = profile?.assignedBusId;
    const routeId = profile?.assignedRouteId;

    Promise.allSettled([
      tripClient.getActive(),
      busId   ? routeClient.getBus(busId)        : Promise.resolve(null),
      routeId ? routeClient.getRoute(routeId)    : Promise.resolve(null),
      routeId ? routeClient.listStops(routeId)   : Promise.resolve([]),
    ]).then(([tripRes, busRes, routeRes, stopsRes]) => {
      if (cancelled) return;
      if (tripRes.status  === 'fulfilled') setTrip(tripRes.value);
      if (busRes.status   === 'fulfilled') setBusInfo(busRes.value);
      if (routeRes.status === 'fulfilled') setRouteInfo(routeRes.value);
      if (stopsRes.status === 'fulfilled') setStops(stopsRes.value ?? []);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [profile]);

  // ── Watch foreground location ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let sub: Location.LocationSubscription | null = null;

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!active || status !== 'granted') return;

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 5 },
        (loc) => {
          if (!active) return;
          setDriverLocation({
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: loc.coords.speed !== null && loc.coords.speed > 0
              ? Math.round(loc.coords.speed * 3.6)
              : undefined,
          });
        },
      );
    })();

    return () => { active = false; sub?.remove(); };
  }, []);

  // ── Follow driver while active ──────────────────────────────────────────────
  useEffect(() => {
    if (!driverLocation || trip?.status !== 'active') return;
    mapRef.current?.animateToRegion(
      { ...driverLocation, latitudeDelta: 0.025, longitudeDelta: 0.025 },
      500,
    );
  }, [driverLocation, trip?.status]);

  // ── Collapse sheet when trip starts (maximise map view) ────────────────────
  useEffect(() => {
    if (trip?.status === 'active') snapSheet(COLLAPSE_TO);
    else                           snapSheet(0);
  }, [trip?.status, snapSheet]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartTrip = useCallback(async () => {
    const busId   = profile?.assignedBusId;
    const routeId = profile?.assignedRouteId;

    if (!busId || !routeId) {
      Alert.alert('No assignment', 'You are not assigned to a bus and route. Contact your transport manager.');
      return;
    }

    setBusy(true);
    try {
      const started = await tripClient.startTrip({ busId, routeId });
      setTrip(started);
      if (driverLocation) {
        mapRef.current?.animateToRegion(
          { ...driverLocation, latitudeDelta: 0.025, longitudeDelta: 0.025 },
          700,
        );
      }
      const tracking = await startLocationTracking(started.id);
      if (!tracking) {
        Alert.alert(
          'Location permission needed',
          'SafeRide needs background location to broadcast your position to parents. Enable it in Settings.',
        );
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'TRIP_ALREADY_ACTIVE') {
        const active = await tripClient.getActive().catch(() => null);
        setTrip(active);
      } else {
        Alert.alert('Could not start trip', (err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }, [profile, driverLocation]);

  const handleEndTrip = useCallback(() => {
    if (!trip) return;
    Alert.alert(
      'End trip',
      'Are you sure you want to end the trip? Parents will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End trip',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await stopLocationTracking();
              const ended = await tripClient.endTrip(trip.id);
              setTrip(ended);
            } catch (err) {
              Alert.alert('Could not end trip', (err as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [trip]);

  function handleRecenter() {
    if (!driverLocation) return;
    mapRef.current?.animateToRegion(
      { ...driverLocation, latitudeDelta: 0.025, longitudeDelta: 0.025 },
      400,
    );
  }

  function handleSOS() {
    Alert.alert(
      'SOS Alert',
      'This will immediately notify the transport manager and principal. Send SOS?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => Alert.alert('SOS sent', 'Transport manager has been notified.'),
        },
      ],
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const isActive      = trip?.status === 'active';
  const isEnded       = trip?.status === 'ended';
  const hasAssignment = !!profile?.assignedBusId;
  const speed         = driverLocation?.speed;

  const actionLabel = isBusy
    ? (isActive ? 'Ending…' : 'Starting…')
    : isActive ? 'End Trip' : 'Start Trip';

  const compactLabel = isBusy ? '…' : isActive ? 'End' : 'Start';

  const hintText = isActive
    ? 'GPS is broadcasting. Do not close the app.'
    : hasAssignment
    ? 'Tap "Start Trip" when you are ready to depart.'
    : 'You have not been assigned to a bus yet.';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Full-screen map ─────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={
          driverLocation
            ? { ...driverLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
            : DEFAULT_REGION
        }
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={isActive}
        mapType="standard"
        rotateEnabled={false}
      >
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.busMarker, isActive && styles.busMarkerActive]}>
              <Navigation
                size={18}
                color={isActive ? colors.white : colors.forest}
                strokeWidth={2}
                fill={isActive ? colors.sage : 'transparent'}
              />
            </View>
          </Marker>
        )}

        {/* Route polyline — drawn from stop coordinates when available */}
        {stops.length >= 2 && (
          <Polyline
            coordinates={stops.map((s) => ({ latitude: s.lat, longitude: s.lon }))}
            strokeColor={isActive ? colors.sage : colors.slate}
            strokeWidth={3}
            lineDashPattern={isActive ? undefined : [6, 4]}
          />
        )}
      </MapView>

      {/* ── Top overlay: status pill + speed ────────────────────────────── */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + spacing[2] }]}>
        {/* Status pill */}
        {isLoading ? (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={colors.slate} />
          </View>
        ) : (
          <View style={[styles.statusPill, isActive && styles.statusPillActive]}>
            <View style={[styles.statusDot, isActive ? styles.dotActive : styles.dotIdle]} />
            <SRText variant="caption" color={isActive ? colors.sage : colors.slate} style={{ fontWeight: '500' }}>
              {isActive ? 'Trip active' : 'Off duty'}
            </SRText>
          </View>
        )}

        {/* Speed badge — top-right, only while active and moving */}
        {isActive && speed !== undefined && speed > 0 && (
          <View style={styles.speedBadge}>
            <Zap size={12} color={colors.sage} strokeWidth={2} />
            <SRText variant="caption" color={colors.sage} style={{ fontWeight: '500' }}>
              {speed} km/h
            </SRText>
          </View>
        )}

        {/* Recenter button — always visible when location known */}
        {driverLocation && (
          <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter} activeOpacity={0.85}>
            <Crosshair size={iconSize.sm} color={colors.forest} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Floating SOS button (appears when sheet collapses during trip) ─ */}
      {isActive && (
        <Animated.View
          style={[
            styles.sosFab,
            { bottom: SHEET_PEEK + spacing[4] },
            { opacity: sosFabOpacity },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={styles.sosFabInner} onPress={handleSOS} activeOpacity={0.85}>
            <AlertTriangle size={iconSize.sm} color={colors.gold} strokeWidth={2} />
            <SRText variant="caption" color={colors.gold} style={{ fontWeight: '500' }}>
              SOS
            </SRText>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Dismissable bottom sheet ─────────────────────────────────────── */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>

        {/* Drag handle — pan gesture target */}
        <View {...pan.panHandlers} style={styles.handleArea}>
          <View style={styles.handleBar} />
        </View>

        {/* ── Peek row (always visible) ──────────────────────────────────── */}
        <View style={styles.peekRow}>
          <View style={{ flex: 1, marginRight: spacing[3] }}>
            <SRText variant="caption" color={colors.slate} numberOfLines={1}>
              {isLoading ? 'Loading…' : routeInfo?.name ?? (hasAssignment ? 'Route assigned' : 'No route')}
            </SRText>
            <SRText variant="heading" numberOfLines={1}>
              {isLoading ? '—' : busInfo?.registrationNumber ?? (hasAssignment ? 'Bus assigned' : 'Contact manager')}
            </SRText>
          </View>

          {!isLoading && !isEnded && (
            <SRButton
              label={compactLabel}
              size="sm"
              variant={isActive ? 'secondary' : 'primary'}
              onPress={isActive ? handleEndTrip : handleStartTrip}
              disabled={isBusy || (!hasAssignment && !isActive)}
            />
          )}
        </View>

        {/* ── Expanded content (fades out as sheet collapses) ───────────── */}
        <Animated.View style={[styles.expanded, { opacity: expandedOpacity }]}>

          {/* Bus make / model / capacity */}
          {busInfo && (
            <SRText variant="caption" color={colors.slate}>
              {busInfo.make} {busInfo.model} · {busInfo.capacity} seats
            </SRText>
          )}

          {/* Main action button */}
          {!isEnded && (
            <SRButton
              label={actionLabel}
              size="lg"
              variant={isActive ? 'secondary' : 'primary'}
              style={styles.actionBtn}
              onPress={isActive ? handleEndTrip : handleStartTrip}
              disabled={isBusy || (!hasAssignment && !isActive)}
            />
          )}

          {isEnded && (
            <View style={styles.endedCard}>
              <SRText variant="body" color={colors.slate} style={{ textAlign: 'center' }}>
                Trip ended. Have a safe journey back.
              </SRText>
            </View>
          )}

          {/* SOS — inline in expanded state */}
          {isActive && (
            <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} activeOpacity={0.85}>
              <AlertTriangle size={iconSize.sm} color={colors.badgeAlertFg} strokeWidth={2} />
              <SRText variant="body" color={colors.badgeAlertFg} style={{ fontWeight: '500' }}>
                SOS — Emergency
              </SRText>
            </TouchableOpacity>
          )}

          <SRText variant="caption" color={colors.slate} style={styles.hint}>
            {hintText}
          </SRText>
        </Animated.View>

      </Animated.View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.background,
  },

  // ── Top overlay ─────────────────────────────────────────────────────────────
  topOverlay: {
    position:       'absolute',
    top:            0,
    left:           spacing[4],
    right:          spacing[4],
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    zIndex:         10,
  },
  statusPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1] + 2,
    backgroundColor:   colors.white,
    borderRadius:      radius.full,
    borderWidth:       0.5,
    borderColor:       colors.stone,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.08,
    shadowRadius:      4,
    elevation:         3,
  },
  statusPillActive: { borderColor: colors.sage + '44' },
  statusDot:        { width: 7, height: 7, borderRadius: 4 },
  dotActive:        { backgroundColor: colors.sage },
  dotIdle:          { backgroundColor: colors.slate },
  speedBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1] + 2,
    backgroundColor:   colors.white,
    borderRadius:      radius.full,
    borderWidth:       0.5,
    borderColor:       colors.sage + '44',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.08,
    shadowRadius:      4,
    elevation:         3,
  },

  // ── Recenter button ─────────────────────────────────────────────────────────
  recenterBtn: {
    width:           40,
    height:          40,
    borderRadius:    radius.full,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    4,
    elevation:       3,
  },

  // ── Bus marker ──────────────────────────────────────────────────────────────
  busMarker: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     colors.forest,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.15,
    shadowRadius:    4,
    elevation:       5,
  },
  busMarkerActive: {
    backgroundColor: colors.sage,
    borderColor:     colors.forest,
  },

  // ── Floating SOS button ──────────────────────────────────────────────────────
  sosFab: {
    position: 'absolute',
    right:    spacing[4],
    zIndex:   20,
  },
  sosFabInner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing[1],
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.white,
    borderRadius:    radius.full,
    borderWidth:     1,
    borderColor:     colors.gold,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.12,
    shadowRadius:    6,
    elevation:       6,
  },

  // ── Bottom sheet ─────────────────────────────────────────────────────────────
  sheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          SHEET_FULL,
    backgroundColor: colors.white,
    borderTopLeftRadius:  radius.xxl,
    borderTopRightRadius: radius.xxl,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.08,
    shadowRadius:    12,
    elevation:       24,
  },

  // ── Handle ───────────────────────────────────────────────────────────────────
  handleArea: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],          // generous touch target
  },
  handleBar: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.stone,
  },

  // ── Peek row ─────────────────────────────────────────────────────────────────
  peekRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing[6],
    paddingBottom:     spacing[3],
    height:            SHEET_PEEK - 28,   // fill the visible peek area below the handle
  },

  // ── Expanded content ─────────────────────────────────────────────────────────
  expanded: {
    paddingHorizontal: spacing[6],
    paddingTop:        spacing[2],
    gap:               spacing[3],
  },
  actionBtn: {
    marginTop: spacing[1],
  },
  endedCard: {
    padding:         spacing[4],
    backgroundColor: colors.sageAlpha18,
    borderRadius:    radius.xl,
    alignItems:      'center',
  },
  sosBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[2],
    padding:        spacing[4],
    backgroundColor: colors.badgeAlertBg,
    borderRadius:   radius.xl,
    borderWidth:    1,
    borderColor:    colors.gold,
  },
  hint: {
    textAlign: 'center',
    marginTop: spacing[1],
  },
});
