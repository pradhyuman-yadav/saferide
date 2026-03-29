import { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserCircle } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import type { UserRole } from '@/types/user';

interface UserRecord {
  id: string;
  name: string;
  role: UserRole;
  contact: string;
  active: boolean;
}

const MOCK_USERS: UserRecord[] = [
  { id: 'u1', name: 'Priya Sharma',     role: 'parent',  contact: '+91 98765 01001', active: true  },
  { id: 'u2', name: 'Raju Sharma',      role: 'driver',  contact: '+91 98765 43210', active: true  },
  { id: 'u3', name: 'Suresh Kumar',     role: 'driver',  contact: '+91 98765 11111', active: true  },
  { id: 'u4', name: 'Ramesh Nair',      role: 'manager', contact: 'ramesh@school.in',active: true  },
  { id: 'u5', name: 'Vivek Gupta',      role: 'school_admin', contact: 'vivek@school.in', active: true  },
  { id: 'u6', name: 'Ananya Krishnan',  role: 'parent',  contact: '+91 98765 02002', active: false },
];

const ROLE_TABS: { key: UserRole | 'all'; label: string }[] = [
  { key: 'all',     label: 'All'      },
  { key: 'parent',  label: 'Parents'  },
  { key: 'driver',  label: 'Drivers'  },
  { key: 'manager', label: 'Managers' },
  { key: 'school_admin', label: 'Admins' },
];

export default function AdminUsersScreen() {
  const [filter, setFilter] = useState<UserRole | 'all'>('all');

  const filtered = filter === 'all' ? MOCK_USERS : MOCK_USERS.filter((u) => u.role === filter);

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
          onPress={() => Alert.alert('Invite user', 'Coming in next build.')}
        />
      </View>

      {/* Role filter tabs */}
      <View style={styles.tabs}>
        {ROLE_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, filter === t.key && styles.tabActive]}
            onPress={() => setFilter(t.key)}
          >
            <SRText
              variant="label"
              color={filter === t.key ? colors.forest : colors.slate}
            >
              {t.label}
            </SRText>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.8}>
            <View style={styles.avatar}>
              <UserCircle size={iconSize.xl} color={colors.slate} strokeWidth={1.5} />
            </View>
            <View style={styles.info}>
              <SRText variant="body" style={{ fontWeight: '500' }}>{item.name}</SRText>
              <SRText variant="caption">{item.contact}</SRText>
            </View>
            <View style={styles.right}>
              <SRBadge
                label={item.role}
                variant={item.role === 'driver' ? 'active' : item.role === 'school_admin' ? 'alert' : 'muted'}
              />
              {!item.active && (
                <SRText variant="caption" color={colors.slate}>Inactive</SRText>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'flex-end',
    padding:          spacing[6],
    paddingBottom:    spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  tabs: {
    flexDirection:    'row',
    paddingHorizontal: spacing[6],
    paddingVertical:  spacing[3],
    gap:              spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  tab: {
    paddingVertical:  spacing[1],
    paddingHorizontal: spacing[2] + 2,
    borderRadius:     radius.full,
  },
  tabActive: {
    backgroundColor: colors.sageAlpha18,
  },
  list:   { padding: spacing[6], gap: spacing[3] },
  card:   {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: colors.surface,
    borderRadius:   radius.xl,
    padding:        spacing[3],
    borderWidth:    0.5,
    borderColor:    colors.stone,
    gap:            spacing[3],
  },
  avatar: { width: 40, alignItems: 'center' },
  info:   { flex: 1, gap: 2 },
  right:  { alignItems: 'flex-end', gap: spacing[1] },
});
