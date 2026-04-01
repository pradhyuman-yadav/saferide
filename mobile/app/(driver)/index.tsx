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
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Navigation, Zap, Crosshair, Map, PhoneCall, X } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, iconSize } from '@/theme';
import { JADE_PEBBLE_MAP_STYLE } from '@/theme/mapStyle';
import { tripClient } from '@/api/trip.client';
import type { Trip } from '@/api/trip.client';
import { routeClient } from '@/api/route.client';
import type { Bus, Route, Stop } from '@/api/route.client';
import { startLocationTracking, stopLocationTracking } from '@/tasks/location.task';

// ── Google Maps API key (runtime — for Directions REST calls) ─────────────────

const MAPS_API_KEY = process.env['EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? '';

// ── Google encoded-polyline decoder ───────────────────────────────────────────

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const pts: { latitude: number; longitude: number }[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pts;
}

// ── Directions API fetch ───────────────────────────────────────────────────────

interface LatLon { lat: number; lon: number }

async function fetchDirectionsPolyline(
  stops: LatLon[],
  apiKey: string,
): Promise<{ latitude: number; longitude: number }[]> {
  if (stops.length < 2) return [];
  if (!apiKey) {
    console.warn('[Directions] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set — showing straight lines');
    return [];
  }
  const origin      = stops[0]!;
  const destination = stops[stops.length - 1]!;
  const middle      = stops.slice(1, -1);
  const wpStr       = middle.length > 0
    ? `&waypoints=optimize:false|${middle.map((w) => `${w.lat},${w.lon}`).join('|')}`
    : '';
  const url = `https://maps.googleapis.com/maps/api/directions/json`
            + `?origin=${origin.lat},${origin.lon}`
            + `&destination=${destination.lat},${destination.lon}`
            + wpStr
            + `&travelmode=driving`
            + `&key=${apiKey}`;
  try {
    const res  = await fetch(url);
    const data = await res.json() as {
      status: string;
      error_message?: string;
      routes?: { overview_polyline?: { points: string } }[];
    };
    if (data.status !== 'OK') {
      console.warn('[Directions] API returned status:', data.status, data.error_message ?? '');
      return [];
    }
    const pts = data.routes?.[0]?.overview_polyline?.points;
    return pts ? decodePolyline(pts) : [];
  } catch (e) {
    console.warn('[Directions] fetch failed:', e);
    return [];
  }
}

// ── Open Google Maps with all stops as waypoints ──────────────────────────────

function openGoogleMapsNavigation(stops: Stop[], driverLoc?: DriverCoords | null): void {
  if (stops.length === 0) return;
  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);

  const origin      = driverLoc
    ? `${driverLoc.latitude},${driverLoc.longitude}`
    : `${sorted[0]!.lat},${sorted[0]!.lon}`;
  const destination = `${sorted[sorted.length - 1]!.lat},${sorted[sorted.length - 1]!.lon}`;
  const middleWPs   = sorted.slice(0, -1);   // all stops except last become waypoints
  const waypoints   = middleWPs.length > 1
    ? middleWPs.slice(1).map((s) => `${s.lat},${s.lon}`).join('%7C')  // %7C = |
    : '';

  // Universal Google Maps URL — works on both platforms; opens app if installed, else browser
  let gmUrl = `https://www.google.com/maps/dir/?api=1`
    + `&origin=${origin}`
    + `&destination=${destination}`
    + (waypoints ? `&waypoints=${waypoints}` : '')
    + `&travelmode=driving`;

  Linking.canOpenURL('comgooglemaps://').then((canOpen) => {
    if (canOpen) {
      // Native Google Maps deep-link (iOS)
      gmUrl = `comgooglemaps://?saddr=${origin}`
        + `&daddr=${destination}`
        + `&directionsmode=driving`;
    }
    Linking.openURL(gmUrl).catch(() =>
      Alert.alert('Could not open Google Maps', 'Make sure Google Maps is installed.'),
    );
  });
}

// ── Sheet snap constants ───────────────────────────────────────────────────────

const SHEET_PEEK    = 88;                         // handle (28) + peek row (60)
const SHEET_FULL    = 272;                        // peek + expanded content
const COLLAPSE_TO   = SHEET_FULL - SHEET_PEEK;   // translateY distance to collapse

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriverCoords {
  latitude:  number;
  longitude: number;
  speed?:    number;   // km/h, already converted
  heading?:  number;   // degrees 0–360, 0 = North. -1 when unavailable.
}

// ── Geo utilities ─────────────────────────────────────────────────────────────

/** Haversine distance between two coordinates, in metres. */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Human-readable distance: "50 m" below 1 km, "1.2 km" above. */
function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Auto-advance threshold: within this distance → stop is considered reached. */
const ARRIVE_METRES = 80;

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
  // Index into `stops` for the stop the driver is currently heading toward (0-based).
  const [currentStopIdx, setCurrentStopIdx] = useState(0);
  // True for 3 s after a trip ends — shows "Trip ended" in the peek row then resets.
  const [tripJustEnded,  setTripJustEnded]  = useState(false);
  // Road-following polyline for the full route (all stops in sequence)
  const [routePolyline,  setRoutePolyline]  = useState<{ latitude: number; longitude: number }[]>([]);
  // Road-following polyline from current driver position to the current target stop
  const [navPolyline,    setNavPolyline]    = useState<{ latitude: number; longitude: number }[]>([]);
  // SOS state
  const [sosActive,      setSosActive]      = useState(false);
  const [sosSending,     setSosSending]     = useState(false);
  // When true, custom marker views have had their initial render — set tracksViewChanges to false
  // to stop redundant re-renders. Starts false so the initial paint always goes through.
  const [markersReady,   setMarkersReady]   = useState(false);
  // Ref to prevent concurrent nav fetches
  const navFetchingRef = useRef(false);

  // ── Flip markersReady after first mount so custom marker views paint correctly
  useEffect(() => {
    const t = setTimeout(() => setMarkersReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  // ── Stable refs for values needed inside effects with narrow deps ───────────
  const driverLocationRef  = useRef(driverLocation);
  const isActiveRef        = useRef(trip?.status === 'active');
  const sortedStopsRef     = useRef<typeof stops>([]);
  useEffect(() => { driverLocationRef.current = driverLocation; },   [driverLocation]);
  useEffect(() => { isActiveRef.current = trip?.status === 'active'; }, [trip?.status]);
  useEffect(() => {
    sortedStopsRef.current = [...stops].sort((a, b) => a.sequence - b.sequence);
  }, [stops]);

  // ── Sheet animation ─────────────────────────────────────────────────────────
  const sheetY    = useRef(new Animated.Value(0)).current;   // 0 = expanded
  const lastSnap  = useRef(0);                               // tracks current snap position

  const snapSheet = useCallback((toValue: number) => {
    lastSnap.current = toValue;
    Animated.spring(sheetY, {
      toValue,
      useNativeDriver: false,   // must match onPanResponderMove — PanResponder is JS-thread only
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
      // useNativeDriver: false is mandatory here — Animated.event inside onPanResponderMove
      // cannot use the native driver because PanResponder callbacks execute on the JS thread.
      // All animations on the same Animated.Value must share the same driver setting.
      onPanResponderMove: Animated.event([null, { dy: sheetY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dy, vy }) => {
        sheetY.flattenOffset();
        // Tap (no real movement) → toggle
        if (Math.abs(dy) < 6) {
          const next = lastSnap.current === 0 ? COLLAPSE_TO : 0;
          lastSnap.current = next;
          Animated.spring(sheetY, { toValue: next, useNativeDriver: false, bounciness: 2 }).start();
          return;
        }
        // Drag → snap to nearest
        const total          = lastSnap.current + dy;
        const shouldCollapse = total > COLLAPSE_TO / 2 || vy > 0.5;
        const snapTo         = shouldCollapse ? COLLAPSE_TO : 0;
        lastSnap.current     = snapTo;
        Animated.spring(sheetY, { toValue: snapTo, useNativeDriver: false, bounciness: 2 }).start();
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
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          if (!active) return;
          setDriverLocation({
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: loc.coords.speed !== null && loc.coords.speed > 0
              ? Math.round(loc.coords.speed * 3.6)
              : undefined,
            // heading is -1 when the device cannot determine direction (stationary / no GPS fix)
            heading: loc.coords.heading !== null && loc.coords.heading >= 0
              ? loc.coords.heading
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
      300,
    );
  }, [driverLocation, trip?.status]);

  // ── Auto-advance to next stop when driver arrives ──────────────────────────
  useEffect(() => {
    if (!driverLocation || trip?.status !== 'active') return;
    const target = stops[currentStopIdx];
    if (!target) return;

    const dist = distanceMeters(
      driverLocation.latitude, driverLocation.longitude,
      target.lat, target.lon,
    );
    if (dist <= ARRIVE_METRES && currentStopIdx < stops.length - 1) {
      setCurrentStopIdx((i) => i + 1);
    }
  }, [driverLocation, trip?.status, stops, currentStopIdx]);

  // ── Reset stop index when a new trip starts ─────────────────────────────────
  useEffect(() => {
    if (trip?.status === 'active') setCurrentStopIdx(0);
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch road-following polyline for the full route ────────────────────────
  useEffect(() => {
    if (stops.length < 2) { setRoutePolyline([]); return; }
    const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
    fetchDirectionsPolyline(sorted.map((s) => ({ lat: s.lat, lon: s.lon })), MAPS_API_KEY)
      .then((pts) => { if (pts.length > 0) setRoutePolyline(pts); });
  }, [stops]);

  // ── Fetch road-following line from current position to current target stop ──
  // Refetches when target stop changes OR when a location first becomes available
  // while a trip is already active (handles the race where trip starts before GPS fix).
  const fetchNavPolyline = useCallback(() => {
    const target = sortedStopsRef.current[currentStopIdx];
    const loc    = driverLocationRef.current;
    if (!isActiveRef.current || !loc || !target) { setNavPolyline([]); return; }
    if (navFetchingRef.current) return;
    navFetchingRef.current = true;
    fetchDirectionsPolyline(
      [{ lat: loc.latitude, lon: loc.longitude }, { lat: target.lat, lon: target.lon }],
      MAPS_API_KEY,
    ).then((pts) => { setNavPolyline(pts); navFetchingRef.current = false; });
  }, [currentStopIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger when stop index or trip changes
  useEffect(() => { fetchNavPolyline(); }, [fetchNavPolyline, trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger once when driverLocation first becomes available during an active trip
  const hasLocationRef = useRef(false);
  useEffect(() => {
    if (!driverLocation) return;
    if (!hasLocationRef.current) {
      hasLocationRef.current = true;
      if (isActiveRef.current) fetchNavPolyline();
    }
  }, [driverLocation, fetchNavPolyline]);

  // ── Sheet is always at peek — driver pulls up for bus details ───────────────
  useEffect(() => {
    snapSheet(COLLAPSE_TO);
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
              await tripClient.endTrip(trip.id);
              // Show "Trip ended" message in the peek row for 3 s, then fully reset.
              setTripJustEnded(true);
              setTrip(null);
              setCurrentStopIdx(0);
              setSosActive(false);
              setTimeout(() => setTripJustEnded(false), 3000);
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

  const handleSOS = useCallback(() => {
    if (sosActive) {
      // Cancel active SOS
      Alert.alert(
        'Cancel SOS?',
        'Confirm you are safe and want to cancel the emergency alert.',
        [
          { text: 'Keep SOS active', style: 'cancel' },
          {
            text: 'I am safe — cancel',
            onPress: async () => {
              setSosSending(true);
              try {
                if (trip) await tripClient.cancelSOS(trip.id).catch(() => {});
              } finally {
                setSosActive(false);
                setSosSending(false);
              }
            },
          },
        ],
      );
      return;
    }

    // Send new SOS
    Alert.alert(
      '🚨 Send SOS Alert?',
      'This will immediately notify your transport manager and school principal with your current location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSosSending(true);
            // Best-effort backend call — show SOS active even if it fails
            if (trip) {
              await tripClient.sendSOS(trip.id).catch((err: Error) => {
                console.warn('[SOS] backend call failed (will show active state anyway):', err.message);
              });
            }
            setSosActive(true);
            setSosSending(false);
            Alert.alert(
              'SOS sent',
              'Your transport manager has been notified. Stay calm — help is on the way.\n\nTap SOS again to cancel when you are safe.',
              [{ text: 'OK' }],
            );
          },
        },
      ],
    );
  }, [sosActive, trip]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isActive      = trip?.status === 'active';
  const hasAssignment = !!profile?.assignedBusId;
  const speed         = driverLocation?.speed;

  const compactLabel = isBusy ? '…' : isActive ? 'End trip' : 'Start trip';

  const hintText = isActive
    ? 'GPS is broadcasting. Do not close the app.'
    : hasAssignment
    ? 'Pull up for bus details. Tap Start trip when ready.'
    : 'You have not been assigned to a bus yet.';

  // ── Navigation banner derived values ───────────────────────────────────────
  const sortedStops    = [...stops].sort((a, b) => a.sequence - b.sequence);
  const targetStop     = sortedStops[currentStopIdx] ?? null;
  const allStopsServed = isActive && sortedStops.length > 0 && currentStopIdx >= sortedStops.length;

  const distToTarget = driverLocation && targetStop
    ? distanceMeters(driverLocation.latitude, driverLocation.longitude, targetStop.lat, targetStop.lon)
    : null;

  const isArriving = distToTarget !== null && distToTarget <= ARRIVE_METRES * 2;

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
        customMapStyle={JADE_PEBBLE_MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={false}
        mapType="standard"
        rotateEnabled={false}
      >
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={true}
            // Rotate the marker to face direction of travel
            rotation={driverLocation.heading ?? 0}
          >
            <View style={[styles.busMarker, isActive && styles.busMarkerActive]}>
              {/* Lucide Navigation icon naturally points northeast (~45°).
                  Pre-rotate -45° so it points north at heading=0;
                  the Marker rotation prop then rotates it to the actual bearing. */}
              <View style={styles.navIconPreRotate}>
                <Navigation
                  size={18}
                  color={isActive ? colors.white : colors.forest}
                  strokeWidth={2}
                  fill={isActive ? colors.sage : 'transparent'}
                />
              </View>
            </View>
          </Marker>
        )}

        {/* Full route polyline — dark ink dashes, clearly distinct from map traffic colours */}
        {sortedStops.length >= 2 && (
          <Polyline
            coordinates={
              routePolyline.length > 0
                ? routePolyline
                : sortedStops.map((s) => ({ latitude: s.lat, longitude: s.lon }))
            }
            strokeColor="#2A2A2A66"   /* colors.ink at ~40% opacity — subtle dark dash */
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* Navigation polyline — forest (#404E3B) is dark enough to read over any map tile
            and will never be confused with Google Maps' green traffic layer */}
        {isActive && driverLocation && targetStop && (
          <Polyline
            coordinates={
              navPolyline.length > 0
                ? navPolyline
                : [
                    { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                    { latitude: targetStop.lat,          longitude: targetStop.lon          },
                  ]
            }
            strokeColor={colors.forest}
            strokeWidth={5}
            lineDashPattern={navPolyline.length > 0 ? undefined : [10, 5]}
          />
        )}

        {/* Numbered stop markers — same style as web admin */}
        {sortedStops.map((stop, idx) => {
          const isPast    = isActive && idx < currentStopIdx;
          const isCurrent = isActive && idx === currentStopIdx;
          return (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.lat, longitude: stop.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={!markersReady}
            >
              <View style={[
                styles.stopMarker,
                isPast    && styles.stopMarkerPast,
                isCurrent && styles.stopMarkerCurrent,
              ]}>
                {/* Past stops have a near-white (stone) background — use dark text.
                    Active/future/current use coloured backgrounds — white text. */}
                <Text style={[styles.stopSeq, { color: isPast ? colors.slate : colors.white }]}>
                  {stop.sequence}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── SOS Active border + banner ───────────────────────────────────── */}
      {sosActive && (
        <View style={styles.sosBorder} pointerEvents="none" />
      )}
      {sosActive && (
        <TouchableOpacity
          style={[styles.sosActiveBanner, { paddingTop: insets.top + spacing[2] }]}
          onPress={handleSOS}
          activeOpacity={0.85}
        >
          <AlertTriangle size={14} color={colors.white} strokeWidth={2} />
          <SRText variant="caption" color={colors.white} style={{ fontWeight: '500', flex: 1 }}>
            SOS Active — Tap to cancel when safe
          </SRText>
          <X size={14} color={colors.white} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {/* ── Top overlay: status pill + speed ────────────────────────────── */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + (sosActive ? 44 : 0) + spacing[2] }]}>
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

      {/* ── Navigation banner (active trip only) ───────────────────────── */}
      {isActive && sortedStops.length > 0 && (
        <View style={[styles.navBanner, { top: insets.top + 56 }]}>
          {allStopsServed ? (
            // All stops done
            <View style={styles.navRow}>
              <View style={styles.navStopBadge}>
                <Text style={[styles.stopSeq, { color: colors.white }]}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <SRText variant="caption" color={colors.slate}>Route complete</SRText>
                <SRText variant="body" color={colors.forest} style={{ fontWeight: '500' }}>
                  All stops served
                </SRText>
              </View>
            </View>
          ) : targetStop ? (
            <View style={styles.navRow}>
              {/* Stop sequence badge */}
              <View style={[styles.navStopBadge, isArriving && styles.navStopBadgeArriving]}>
                <Text style={[styles.stopSeq, { color: colors.white }]}>
                  {targetStop.sequence}
                </Text>
              </View>

              {/* Stop info */}
              <View style={{ flex: 1 }}>
                <SRText variant="caption" color={colors.slate}>
                  {isArriving
                    ? 'Arriving'
                    : `Stop ${currentStopIdx + 1} of ${sortedStops.length}`}
                </SRText>
                <SRText variant="body" color={colors.forest} style={{ fontWeight: '500' }} numberOfLines={1}>
                  {targetStop.name}
                </SRText>
              </View>

              {/* Distance */}
              {distToTarget !== null && !isArriving && (
                <SRText variant="caption" color={colors.slate} style={{ fontWeight: '500' }}>
                  {formatDistance(distToTarget)}
                </SRText>
              )}

              {/* Manual skip */}
              {currentStopIdx < sortedStops.length - 1 && (
                <TouchableOpacity
                  style={styles.navSkip}
                  onPress={() => setCurrentStopIdx((i) => Math.min(i + 1, sortedStops.length - 1))}
                  activeOpacity={0.7}
                >
                  <SRText variant="caption" color={colors.sage} style={{ fontWeight: '500' }}>
                    Next
                  </SRText>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>
      )}

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
          <TouchableOpacity
            style={[styles.sosFabInner, sosActive && styles.sosFabInnerActive]}
            onPress={handleSOS}
            activeOpacity={0.85}
            disabled={sosSending}
          >
            {sosSending
              ? <ActivityIndicator size="small" color={colors.gold} />
              : <AlertTriangle size={iconSize.sm} color={colors.gold} strokeWidth={2} />
            }
            <SRText variant="caption" color={colors.gold} style={{ fontWeight: '500' }}>
              {sosActive ? 'SOS Active' : 'SOS'}
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
            {tripJustEnded ? (
              // Transient "Trip ended" state — shown for 3 s after ending
              <>
                <SRText variant="caption" color={colors.slate}>Trip complete</SRText>
                <SRText variant="heading" color={colors.forest}>Have a safe return.</SRText>
              </>
            ) : (
              <>
                <SRText variant="caption" color={colors.slate} numberOfLines={1}>
                  {isLoading ? 'Loading…' : routeInfo?.name ?? (hasAssignment ? 'Route assigned' : 'No route')}
                </SRText>
                <SRText variant="heading" numberOfLines={1}>
                  {isLoading ? '—' : busInfo?.registrationNumber ?? (hasAssignment ? 'Bus assigned' : 'Contact manager')}
                </SRText>
              </>
            )}
          </View>

          {/* Single action button — hidden during the "Trip ended" message */}
          {!isLoading && !tripJustEnded && (
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

          {/* Navigate with Google Maps — visible when stops are loaded */}
          {sortedStops.length > 0 && (
            <TouchableOpacity
              style={styles.gmapsBtn}
              onPress={() => openGoogleMapsNavigation(sortedStops, driverLocation)}
              activeOpacity={0.85}
            >
              <Map size={iconSize.sm} color={colors.forest} strokeWidth={2} />
              <SRText variant="body" color={colors.forest} style={{ fontWeight: '500' }}>
                Navigate with Google Maps
              </SRText>
            </TouchableOpacity>
          )}

          {/* SOS — inline in expanded state */}
          {isActive && (
            <TouchableOpacity
              style={[styles.sosBtn, sosActive && styles.sosBtnActive]}
              onPress={handleSOS}
              activeOpacity={0.85}
              disabled={sosSending}
            >
              {sosSending ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <AlertTriangle size={iconSize.sm} color={colors.badgeAlertFg} strokeWidth={2} />
              )}
              <SRText variant="body" color={colors.badgeAlertFg} style={{ fontWeight: '500' }}>
                {sosActive ? 'SOS Active — Tap to cancel' : 'SOS — Emergency'}
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

  // ── Stop markers (numbered circles, matching web admin style) ───────────────
  stopMarker: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: colors.sage,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     colors.white,
  },
  stopMarkerPast: {
    backgroundColor: colors.stone,
    borderColor:     colors.slate,
  },
  stopMarkerCurrent: {
    backgroundColor: colors.forest,
    borderColor:     colors.mist,
    width:           28,
    height:          28,
    borderRadius:    14,
  },
  stopSeq: {
    // Keep this style minimal — centering is handled entirely by the parent View's
    // alignItems/justifyContent. Adding lineHeight, textAlignVertical, or
    // includeFontPadding here conflicts with how RN measures the Text node and
    // causes the number to sit off-centre on Android.
    fontSize:   10,
    fontWeight: '500',
    textAlign:  'center',
  },

  // ── Bus marker direction icon ────────────────────────────────────────────────
  navIconPreRotate: {
    // Lucide Navigation icon points northeast (~45°). Offset by -45° so that
    // heading=0 (north) renders the arrow pointing straight up.
    transform: [{ rotate: '-45deg' }],
  },

  // ── Navigation banner ────────────────────────────────────────────────────────
  navBanner: {
    position:          'absolute',
    left:              spacing[4],
    right:             spacing[4],
    backgroundColor:   colors.white,
    borderRadius:      radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.10,
    shadowRadius:      8,
    elevation:         8,
    zIndex:            10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
  },
  navStopBadge: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: colors.sage,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  navStopBadgeArriving: {
    backgroundColor: colors.forest,
  },
  navSkip: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1] + 2,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.sage,
    flexShrink:        0,
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
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1],
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor:   colors.white,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.gold,
    // No shadow — brand guidelines prohibit drop shadows; border provides
    // sufficient visual separation from the map beneath.
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
  sosBtnActive: {
    backgroundColor: colors.gold + '22',
    borderColor:     colors.gold,
    borderWidth:     2,
  },
  sosFabInnerActive: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.gold + '18',
  },

  // ── SOS Active border overlay ────────────────────────────────────────────────
  sosBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: colors.gold,
    zIndex: 50,
  },
  sosActiveBanner: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[2],
    backgroundColor:   colors.gold,
    zIndex:            51,
  },

  // ── Google Maps navigation button ────────────────────────────────────────────
  gmapsBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[2],
    padding:        spacing[4],
    backgroundColor: colors.stone,
    borderRadius:   radius.xl,
    borderWidth:    1,
    borderColor:    colors.mist,
  },

  hint: {
    textAlign: 'center',
    marginTop: spacing[1],
  },
});
