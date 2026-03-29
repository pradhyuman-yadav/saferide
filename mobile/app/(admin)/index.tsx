import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bus, Users, Activity, Shield, LogOut } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';

const STATS = [
  { label: 'Buses tracked', value: '200', icon: <Bus size={iconSize.lg} color={colors.forest} strokeWidth={2} /> },
  { label: 'Parents active', value: '4,800', icon: <Users size={iconSize.lg} color={colors.forest} strokeWidth={2} /> },
  { label: 'Platform uptime', value: '99.9%', icon: <Activity size={iconSize.lg} color={colors.sage} strokeWidth={2} /> },
  { label: 'Schools live', value: '20', icon: <Shield size={iconSize.lg} color={colors.sage} strokeWidth={2} /> },
];

const ACTIONS = [
  { label: 'Add route',       description: 'Create a new bus route and assign stops.' },
  { label: 'Invite driver',   description: 'Send a login code to a new driver.' },
  { label: 'Import students', description: 'Upload CSV or sync from Fedena ERP.' },
  { label: 'Download report', description: 'Export AIS-140 trip logs as CSV or PDF.' },
];

export default function AdminDashboardScreen() {
  const { profile, signOut } = useAuthStore();

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of SafeRide admin?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

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
              {profile?.schoolName ?? 'Delhi Public School'}
            </SRText>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <LogOut size={iconSize.md} color={colors.mist} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <SRText variant="label" color={colors.slate} style={styles.sectionLabel}>
          Platform stats
        </SRText>
        <View style={styles.statsGrid}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              {s.icon}
              <SRText variant="statNum" style={{ marginTop: spacing[2] }}>{s.value}</SRText>
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
              onPress={() => Alert.alert(a.label, 'This feature is coming in the next build.')}
            >
              <SRText variant="body" style={{ fontWeight: '500', marginBottom: spacing[1] }}>
                {a.label}
              </SRText>
              <SRText variant="caption">{a.description}</SRText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Plan badge */}
        <View style={styles.planRow}>
          <SRBadge label="Starter plan · 30-day trial" variant="alert" />
          <SRText variant="caption" style={{ marginTop: spacing[2] }}>
            9 days remaining. Upgrade to continue after trial.
          </SRText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.background },
  content:  { paddingBottom: spacing[10] },
  header:   {
    backgroundColor:  colors.forest,
    padding:          spacing[6],
    paddingTop:       spacing[8],
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'flex-start',
  },
  signOutBtn: { padding: spacing[2] },
  sectionLabel: {
    paddingHorizontal: spacing[6],
    marginTop:        spacing[6],
    marginBottom:     spacing[3],
  },
  statsGrid: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    paddingHorizontal: spacing[6],
    gap:              spacing[3],
  },
  statCard: {
    width:            '47%',
    backgroundColor:  colors.surface,
    borderRadius:     radius.xl,
    padding:          spacing[4],
    borderWidth:      0.5,
    borderColor:      colors.stone,
    gap:              spacing[1],
  },
  actions: {
    paddingHorizontal: spacing[6],
    gap:              spacing[3],
  },
  actionCard: {
    backgroundColor:  colors.surface,
    borderRadius:     radius.xl,
    padding:          spacing[4],
    borderWidth:      0.5,
    borderColor:      colors.stone,
    borderLeftWidth:  3,
    borderLeftColor:  colors.sage,
  },
  planRow: {
    paddingHorizontal: spacing[6],
    marginTop:        spacing[6],
  },
});
