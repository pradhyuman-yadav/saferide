import { View, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Bus, MapPin } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, iconSize } from '@/theme';

const MOCK_ROUTES = [
  { id: 'r1', name: 'Route A — Indiranagar', bus: '7',  driver: 'Raju Sharma',  stops: 6,  students: 34, active: true  },
  { id: 'r2', name: 'Route B — Koramangala', bus: '3',  driver: 'Suresh Kumar', stops: 8,  students: 28, active: true  },
  { id: 'r3', name: 'Route C — Whitefield',  bus: '12', driver: 'Mohan Das',    stops: 11, students: 41, active: true  },
  { id: 'r4', name: 'Route D — HSR Layout',  bus: '—',  driver: 'Unassigned',   stops: 7,  students: 22, active: false },
];

export default function AdminRoutesScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
            Fleet management
          </SRText>
          <SRText variant="heading">Routes</SRText>
        </View>
        <SRButton
          label="Add route"
          variant="secondary"
          size="sm"
          onPress={() => Alert.alert('Add route', 'Coming in next build.')}
        />
      </View>

      <FlatList
        data={MOCK_ROUTES}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => Alert.alert(item.name, 'Route details view coming soon.')}
          >
            <View style={styles.cardTop}>
              <SRText variant="body" style={{ fontWeight: '500', flex: 1 }}>
                {item.name}
              </SRText>
              <SRBadge
                label={item.active ? 'Active' : 'Inactive'}
                variant={item.active ? 'active' : 'muted'}
              />
            </View>

            <View style={styles.meta}>
              <MetaItem icon={<Bus size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
                        label={`Bus ${item.bus} · ${item.driver}`} />
              <MetaItem icon={<MapPin size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
                        label={`${item.stops} stops · ${item.students} students`} />
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function MetaItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      {icon}
      <SRText variant="caption">{label}</SRText>
    </View>
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
  list:   { padding: spacing[6], gap: spacing[3] },
  card:   {
    backgroundColor:  colors.surface,
    borderRadius:     radius.xl,
    padding:          spacing[4],
    borderWidth:      0.5,
    borderColor:      colors.stone,
    gap:              spacing[2],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  meta: { gap: spacing[1] },
});
