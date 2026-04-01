import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserCircle, Users } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { routeClient, type Driver } from '@/api/route.client';

type Tab = 'all' | 'drivers' | 'parents' | 'managers' | 'admins';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'drivers',  label: 'Drivers'  },
  { key: 'parents',  label: 'Parents'  },
  { key: 'managers', label: 'Managers' },
  { key: 'admins',   label: 'Admins'   },
];

// Roles that aren't available via mobile API yet
const WEB_ONLY_TABS: Tab[] = ['parents', 'managers', 'admins'];

export default function AdminUsersScreen() {
  const [tab,        setTab]        = useState<Tab>('all');
  const [drivers,    setDrivers]    = useState<Driver[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const data = await routeClient.listDrivers();
      setDrivers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load drivers.');
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

  const showWebOnly = WEB_ONLY_TABS.includes(tab);
  const showDrivers = tab === 'all' || tab === 'drivers';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
            User management
          </SRText>
          <SRText variant="heading">Users</SRText>
        </View>
        <SRButton
          label="Invite"
          variant="secondary"
          size="sm"
          onPress={() => Alert.alert('Invite user', 'Use the web portal to invite and manage users.')}
        />
      </View>

      {/* Role filter tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <SRText
              variant="label"
              color={tab === t.key ? colors.forest : colors.slate}
            >
              {t.label}
            </SRText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Web-only tabs: calm empty state */}
      {showWebOnly ? (
        <View style={styles.center}>
          <Users size={iconSize.xl} color={colors.stone} strokeWidth={1.5} />
          <SRText variant="body" color={colors.slate} style={{ marginTop: spacing[3], textAlign: 'center' }}>
            Manage {tab} from the web portal.
          </SRText>
          <SRText variant="caption" style={{ marginTop: spacing[1], textAlign: 'center' }}>
            Sign in at your school's SafeRide dashboard.
          </SRText>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.sage} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <SRText variant="caption" color={colors.slate}>{error}</SRText>
        </View>
      ) : showDrivers ? (
        <FlatList
          data={drivers}
          keyExtractor={(d) => d.id}
          contentContainerStyle={drivers.length === 0 ? styles.centerList : styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <UserCircle size={iconSize.xl} color={colors.stone} strokeWidth={1.5} />
              <SRText variant="body" color={colors.slate} style={{ marginTop: spacing[3], textAlign: 'center' }}>
                No drivers yet.
              </SRText>
              <SRText variant="caption" style={{ marginTop: spacing[1], textAlign: 'center' }}>
                Invite drivers from the web portal.
              </SRText>
            </View>
          }
          renderItem={({ item }) => <DriverCard driver={item} />}
        />
      ) : null}
    </SafeAreaView>
  );
}

function DriverCard({ driver }: { driver: Driver }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View style={styles.avatar}>
        <UserCircle size={iconSize.xl} color={colors.slate} strokeWidth={1.5} />
      </View>
      <View style={styles.info}>
        <SRText variant="body" style={{ fontWeight: '500' }}>{driver.name}</SRText>
        <SRText variant="caption">{driver.phone || driver.email}</SRText>
      </View>
      <View style={styles.right}>
        <SRBadge label="Driver" variant="active" />
        {!driver.isActive && (
          <SRText variant="caption" color={colors.slate}>Inactive</SRText>
        )}
      </View>
    </TouchableOpacity>
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
  tabs: {
    flexDirection:     'row',
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[3],
    gap:               spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  tab: {
    paddingVertical:   spacing[1],
    paddingHorizontal: spacing[2] + 2,
    borderRadius:      radius.full,
  },
  tabActive:  { backgroundColor: colors.sageAlpha18 },
  list:       { padding: spacing[6], gap: spacing[3] },
  centerList: { flex: 1 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[10] },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    padding:         spacing[3],
    borderWidth:     0.5,
    borderColor:     colors.stone,
    gap:             spacing[3],
  },
  avatar: { width: 40, alignItems: 'center' },
  info:   { flex: 1, gap: 2 },
  right:  { alignItems: 'flex-end', gap: spacing[1] },
});
