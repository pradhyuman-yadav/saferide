/**
 * Driver profile screen.
 *
 * Shows the driver's identity, current bus and route assignment,
 * and a sign-out action. Read-only — assignment changes go through
 * the manager's fleet dashboard.
 */

import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bus,
  Route as RouteIcon,
  Mail,
  LogOut,
  User,
  AlertCircle,
} from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient } from '@/api/route.client';
import type { Bus as BusType, Route as RouteType } from '@/api/route.client';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DriverProfileScreen() {
  const { profile, signOut } = useAuthStore();

  const [bus,      setBus]      = useState<BusType | null>(null);
  const [route,    setRoute]    = useState<RouteType | null>(null);
  const [loading,  setLoading]  = useState(true);

  // ── Fetch bus + route assignment ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const busId   = profile?.assignedBusId;
    const routeId = profile?.assignedRouteId;

    if (!busId && !routeId) {
      setLoading(false);
      return;
    }

    Promise.allSettled([
      busId   ? routeClient.getBus(busId)     : Promise.resolve(null),
      routeId ? routeClient.getRoute(routeId) : Promise.resolve(null),
    ]).then(([busRes, routeRes]) => {
      if (cancelled) return;
      if (busRes.status   === 'fulfilled') setBus(busRes.value);
      if (routeRes.status === 'fulfilled') setRoute(routeRes.value);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [profile]);

  // ── Sign out ────────────────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'You will be signed out of SafeRide.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ],
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const initials = (profile?.name ?? 'D')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hasAssignment = !!(bus || route);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <SRText variant="heading" color={colors.white}>
              {initials}
            </SRText>
          </View>
          <SRText variant="heading" style={{ marginTop: spacing[4] }}>
            {profile?.name ?? '—'}
          </SRText>
          <View style={{ marginTop: spacing[2] }}>
            <SRBadge label="Driver" variant="active" />
          </View>
        </View>

        {/* ── Assignment ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            Assignment
          </SRText>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.sage} />
            </View>
          ) : hasAssignment ? (
            <>
              {bus && (
                <InfoRow
                  icon={<Bus size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
                  label="Bus"
                  value={bus.registrationNumber}
                  sub={`${bus.make} ${bus.model} · ${bus.capacity} seats`}
                />
              )}
              {route && (
                <InfoRow
                  icon={<RouteIcon size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
                  label="Route"
                  value={route.name}
                  sub={route.description ?? undefined}
                />
              )}
            </>
          ) : (
            <View style={styles.noAssignment}>
              <AlertCircle size={iconSize.sm} color={colors.slate} strokeWidth={2} />
              <SRText variant="body" color={colors.slate}>
                No bus or route assigned yet. Contact your transport manager.
              </SRText>
            </View>
          )}
        </View>

        {/* ── Account ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            Account
          </SRText>

          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Name"
            value={profile?.name ?? '—'}
          />
          <InfoRow
            icon={<Mail size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Email"
            value={profile?.email ?? '—'}
          />
        </View>

        {/* ── Sign out ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <LogOut size={iconSize.sm} color={colors.gold} strokeWidth={2} />
          <SRText variant="body" color={colors.gold} style={{ fontWeight: '500' }}>
            Sign out
          </SRText>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon:  React.ReactNode;
  label: string;
  value: string;
  sub?:  string;
}

function InfoRow({ icon, label, value, sub }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <SRText variant="caption" color={colors.slate} style={{ marginBottom: 1 }}>
          {label}
        </SRText>
        <SRText variant="body" style={{ fontWeight: '500' }}>
          {value}
        </SRText>
        {sub && (
          <SRText variant="caption" color={colors.slate} style={{ marginTop: 1 }}>
            {sub}
          </SRText>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[6], gap: spacing[6] },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    alignItems:     'center',
    paddingVertical: spacing[6],
    gap:             spacing[1],
  },
  avatar: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: colors.forest,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Section ─────────────────────────────────────────────────────────────────
  section: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     0.5,
    borderColor:     colors.stone,
    overflow:        'hidden',
  },
  sectionTitle: {
    paddingHorizontal: spacing[4],
    paddingTop:        spacing[4],
    paddingBottom:     spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },

  // ── Info row ────────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  infoIcon: {
    marginTop: 2,
    width:     iconSize.sm,
  },

  // ── Loading / empty ──────────────────────────────────────────────────────────
  loadingRow: {
    padding:        spacing[6],
    alignItems:     'center',
  },
  noAssignment: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            spacing[3],
    padding:        spacing[4],
  },

  // ── Sign out ─────────────────────────────────────────────────────────────────
  signOutBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[2],
    padding:        spacing[4],
    backgroundColor: colors.goldAlpha20,
    borderRadius:   radius.xl,
    borderWidth:    1,
    borderColor:    colors.gold,
  },
});
