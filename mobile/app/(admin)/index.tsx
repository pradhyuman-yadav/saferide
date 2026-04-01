import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bus, Users, Route, CheckCircle, LogOut } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient } from '@/api/route.client';

const ACTIONS = [
  { label: 'Add route',       description: 'Create a new bus route and assign stops.' },
  { label: 'Invite driver',   description: 'Send a login code to a new driver.' },
  { label: 'Import students', description: 'Upload CSV or sync from Fedena ERP.' },
  { label: 'Download report', description: 'Export AIS-140 trip logs as CSV or PDF.' },
];

interface Stats {
  buses:        number;
  drivers:      number;
  routes:       number;
  activeRoutes: number;
}

export default function AdminDashboardScreen() {
  const { profile, signOut } = useAuthStore();
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [buses, drivers, routes] = await Promise.all([
          routeClient.listBuses(),
          routeClient.listDrivers(),
          routeClient.listRoutes(),
        ]);
        if (!cancelled) {
          setStats({
            buses:        buses.length,
            drivers:      drivers.length,
            routes:       routes.length,
            activeRoutes: routes.filter((r) => r.isActive).length,
          });
        }
      } catch {
        // leave stats null — cards show —
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of SafeRide admin?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  const statCards = [
    { label: 'Buses',         value: stats?.buses,        icon: <Bus        size={iconSize.lg} color={colors.forest} strokeWidth={2} /> },
    { label: 'Drivers',       value: stats?.drivers,      icon: <Users      size={iconSize.lg} color={colors.forest} strokeWidth={2} /> },
    { label: 'Routes',        value: stats?.routes,       icon: <Route      size={iconSize.lg} color={colors.sage}   strokeWidth={2} /> },
    { label: 'Active routes', value: stats?.activeRoutes, icon: <CheckCircle size={iconSize.lg} color={colors.sage}  strokeWidth={2} /> },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <SRText variant="label" color={colors.mist} style={{ opacity: 0.75, marginBottom: spacing[1] }}>
              School admin
            </SRText>
            <SRText variant="heading" color={colors.white}>
              {profile?.name ?? 'Admin'}
            </SRText>
            <SRText variant="caption" color={colors.mist} style={{ marginTop: 2 }}>
              {profile?.schoolName ?? ''}
            </SRText>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <LogOut size={iconSize.md} color={colors.mist} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <SRText variant="label" color={colors.slate} style={styles.sectionLabel}>
          Fleet overview
        </SRText>
        <View style={styles.statsGrid}>
          {statCards.map((s) => (
            <View key={s.label} style={styles.statCard}>
              {s.icon}
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.sage} style={{ marginTop: spacing[2] }} />
              ) : (
                <SRText variant="statNum" style={{ marginTop: spacing[2] }}>
                  {s.value !== undefined ? String(s.value) : '—'}
                </SRText>
              )}
              <SRText variant="caption">{s.label}</SRText>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <SRText variant="label" color={colors.slate} style={styles.sectionLabel}>
          Quick actions
        </SRText>
        <View style={styles.actions}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              activeOpacity={0.8}
              onPress={() => Alert.alert(a.label, 'Manage from the web portal.')}
            >
              <SRText variant="body" style={{ fontWeight: '500', marginBottom: spacing[1] }}>
                {a.label}
              </SRText>
              <SRText variant="caption">{a.description}</SRText>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing[10] },
  header:  {
    backgroundColor: colors.forest,
    padding:         spacing[6],
    paddingTop:      spacing[8],
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
  },
  signOutBtn:   { padding: spacing[2] },
  sectionLabel: {
    paddingHorizontal: spacing[6],
    marginTop:         spacing[6],
    marginBottom:      spacing[3],
  },
  statsGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: spacing[6],
    gap:               spacing[3],
  },
  statCard: {
    width:           '47%',
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    padding:         spacing[4],
    borderWidth:     0.5,
    borderColor:     colors.stone,
    gap:             spacing[1],
  },
  actions: {
    paddingHorizontal: spacing[6],
    gap:               spacing[3],
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    padding:         spacing[4],
    borderWidth:     0.5,
    borderColor:     colors.stone,
    borderLeftWidth: 3,
    borderLeftColor: colors.sage,
  },
});
