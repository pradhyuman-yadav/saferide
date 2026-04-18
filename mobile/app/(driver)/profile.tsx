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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bus,
  Route as RouteIcon,
  Mail,
  LogOut,
  User,
  AlertCircle,
  FileText,
  Shield,
  Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient } from '@/api/route.client';
import type { Bus as BusType, Route as RouteType } from '@/api/route.client';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DriverProfileScreen() {
  const router = useRouter();
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
          onPress: () => {
            void signOut().then(() => router.replace('/(auth)/welcome'));
          },
        },
      ],
    );
  }

  // ── Account deletion ────────────────────────────────────────────────────────
  function handleDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'We will email you a data export within 30 days, then permanently delete your account and all personal data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send request',
          style: 'destructive',
          onPress: () => {
            const email   = profile?.email ?? '';
            const subject = encodeURIComponent('Account Deletion Request');
            const body    = encodeURIComponent(
              `Hi SafeRide,\n\nPlease delete my account and all associated personal data.\n\nAccount email: ${email}\n\nI understand this cannot be undone.`,
            );
            void Linking.openURL(`mailto:support@saferide.co.in?subject=${subject}&body=${body}`);
          },
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

        {/* ── Legal ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            Legal
          </SRText>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => { void Linking.openURL('https://saferide.co.in/privacy'); }}
            activeOpacity={0.7}
          >
            <View style={styles.infoIcon}>
              <Shield size={iconSize.sm} color={colors.slate} strokeWidth={2} />
            </View>
            <SRText variant="body" style={{ flex: 1, fontWeight: '500' }}>Privacy Policy</SRText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => { void Linking.openURL('https://saferide.co.in/terms'); }}
            activeOpacity={0.7}
          >
            <View style={styles.infoIcon}>
              <FileText size={iconSize.sm} color={colors.slate} strokeWidth={2} />
            </View>
            <SRText variant="body" style={{ flex: 1, fontWeight: '500' }}>Terms of Service</SRText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.infoRow, { borderBottomWidth: 0 }]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <View style={styles.infoIcon}>
              <Trash2 size={iconSize.sm} color={colors.gold} strokeWidth={2} />
            </View>
            <SRText variant="body" color={colors.gold} style={{ flex: 1, fontWeight: '500' }}>
              Request account deletion
            </SRText>
          </TouchableOpacity>
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
