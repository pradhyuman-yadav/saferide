/**
 * Manager profile screen.
 *
 * Shows identity, school context, a live fleet-at-a-glance stat row,
 * account details, and sign-out. Read-only — changes to assignments
 * go through the web admin portal.
 */

import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, User, Mail, Phone, School, Bus, Route as RouteIcon, Users, FileText, Shield, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient } from '@/api/route.client';

// ── Fleet snapshot ────────────────────────────────────────────────────────────

interface FleetSnapshot {
  buses:   number;
  routes:  number;
  drivers: number;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ManagerProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

  const [snapshot,        setSnapshot]        = useState<FleetSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  // Fetch fleet counts — lightweight parallel read
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      routeClient.listBuses(),
      routeClient.listRoutes(),
      routeClient.listDrivers(),
    ])
      .then(([buses, routes, drivers]) => {
        if (cancelled) return;
        setSnapshot({
          buses:   buses.length,
          routes:  routes.filter((r) => r.isActive).length,
          drivers: drivers.filter((d) => d.isActive).length,
        });
      })
      .catch(() => { /* non-critical — stats stay hidden */ })
      .finally(() => { if (!cancelled) setSnapshotLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Derived
  const initials = (profile?.name ?? 'M')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'You will be signed out of SafeRide.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => {
            void signOut().then(() => router.replace('/(auth)/welcome'));
          } },
      ],
    );
  }

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <SRText variant="heading" color={colors.white}>{initials}</SRText>
          </View>
          <SRText variant="heading" style={{ marginTop: spacing[4] }}>
            {profile?.name ?? '—'}
          </SRText>
          <View style={{ marginTop: spacing[2] }}>
            <SRBadge label="Manager" variant="active" />
          </View>
        </View>

        {/* ── Fleet at a glance ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            Fleet at a glance
          </SRText>
          {snapshotLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.sage} />
            </View>
          ) : snapshot !== null ? (
            <View style={styles.statRow}>
              <StatCell icon={<Bus size={iconSize.sm} color={colors.sage} strokeWidth={2} />}
                value={snapshot.buses}   label="Buses" />
              <View style={styles.statDivider} />
              <StatCell icon={<RouteIcon size={iconSize.sm} color={colors.sage} strokeWidth={2} />}
                value={snapshot.routes}  label="Routes" />
              <View style={styles.statDivider} />
              <StatCell icon={<Users size={iconSize.sm} color={colors.sage} strokeWidth={2} />}
                value={snapshot.drivers} label="Drivers" />
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <SRText variant="caption" color={colors.slate}>Unable to load stats</SRText>
            </View>
          )}
        </View>

        {/* ── School ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            School
          </SRText>
          <InfoRow
            icon={<School size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="School name"
            value={profile?.schoolName ?? '—'}
          />
          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Role"
            value="Transport Manager"
            last
          />
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
          {profile?.email !== undefined && (
            <InfoRow
              icon={<Mail size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
              label="Email"
              value={profile.email}
            />
          )}
          {profile?.phone !== undefined && (
            <InfoRow
              icon={<Phone size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
              label="Phone"
              value={profile.phone}
              last
            />
          )}
          {profile?.email === undefined && profile?.phone === undefined && (
            <InfoRow
              icon={<Mail size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
              label="Email"
              value="—"
              last
            />
          )}
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
            style={[styles.infoRow, styles.infoRowLast]}
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

// ── StatCell ──────────────────────────────────────────────────────────────────

function StatCell({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <View style={styles.statCell}>
      {icon}
      <SRText variant="heading" color={colors.forest} style={{ marginTop: spacing[1] }}>
        {value}
      </SRText>
      <SRText variant="caption" color={colors.slate}>{label}</SRText>
    </View>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon:  React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}

function InfoRow({ icon, label, value, last = false }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <SRText variant="caption" color={colors.slate} style={{ marginBottom: 1 }}>
          {label}
        </SRText>
        <SRText variant="body" style={{ fontWeight: '500' }}>{value}</SRText>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[6], gap: spacing[6] },

  header: {
    alignItems:      'center',
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

  // Stat row
  statRow: {
    flexDirection: 'row',
    alignItems:    'stretch',
  },
  statCell: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing[5],
    gap:             2,
  },
  statDivider: {
    width:           0.5,
    backgroundColor: colors.stone,
    marginVertical:  spacing[4],
  },

  loadingRow: {
    padding:    spacing[6],
    alignItems: 'center',
  },

  // Info rows
  infoRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoIcon: {
    marginTop: 2,
    width:     iconSize.sm,
  },

  // Sign out
  signOutBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    padding:         spacing[4],
    backgroundColor: colors.goldAlpha20,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.gold,
  },
});
