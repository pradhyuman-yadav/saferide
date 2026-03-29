import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wifi, WifiOff, Gauge } from 'lucide-react-native';
import { MOCK_FLEET } from '@/mocks/bus.mock';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import type { FleetBus } from '@/types/bus';

export default function ManagerFleetScreen() {
  const total   = MOCK_FLEET.length;
  const active  = MOCK_FLEET.filter((b) => b.status === 'on_route').length;
  const stopped = MOCK_FLEET.filter((b) => b.status === 'stopped').length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          Fleet overview
        </SRText>
        <SRText variant="heading">All buses</SRText>

        <View style={styles.stats}>
          <Pill label={`${active} active`}    color={colors.sage} />
          <Pill label={`${stopped} stopped`}  color={colors.gold} />
          <Pill label={`${total} total`}      color={colors.slate} />
        </View>
      </View>

      {/* Bus list */}
      <FlatList
        data={MOCK_FLEET}
        keyExtractor={(item) => item.busId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <BusRow bus={item} />}
      />
    </SafeAreaView>
  );
}

function BusRow({ bus }: { bus: FleetBus }) {
  const isOnline = bus.status !== 'offline';
  const age = Math.round((Date.now() - bus.lastUpdated) / 1000);

  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.busBadge, { backgroundColor: isOnline ? colors.forest : colors.stone }]}>
          <SRText variant="label" color={isOnline ? colors.mist : colors.slate}>
            {bus.busNumber}
          </SRText>
        </View>
      </View>

      <View style={styles.cardMid}>
        <SRText variant="body" style={{ fontWeight: '500' }}>
          {bus.driverName}
        </SRText>
        <SRText variant="caption">{bus.routeName}</SRText>
        <SRText variant="caption" color={colors.slate}>
          Updated {age < 10 ? 'just now' : `${age}s ago`}
        </SRText>
      </View>

      <View style={styles.cardRight}>
        <SRBadge
          label={bus.status.replace('_', ' ')}
          variant={bus.status === 'on_route' ? 'active' : bus.status === 'delayed' ? 'alert' : 'muted'}
        />
        <View style={styles.speed}>
          <Gauge size={iconSize.sm} color={colors.slate} strokeWidth={2} />
          <SRText variant="caption">{bus.speedKmh} km/h</SRText>
        </View>
        {isOnline
          ? <Wifi size={iconSize.sm} color={colors.sage} strokeWidth={2} />
          : <WifiOff size={iconSize.sm} color={colors.gold} strokeWidth={2} />
        }
      </View>
    </TouchableOpacity>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: color + '22' }]}>
      <SRText variant="label" color={color}>{label}</SRText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  header:  {
    padding:          spacing[6],
    paddingBottom:    spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  stats:   { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  list:    { padding: spacing[6], gap: spacing[3] },
  card:    {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  colors.surface,
    borderRadius:     radius.xl,
    padding:          spacing[4],
    borderWidth:      0.5,
    borderColor:      colors.stone,
    gap:              spacing[3],
  },
  cardLeft:  { alignItems: 'center' },
  cardMid:   { flex: 1, gap: 2 },
  cardRight: { alignItems: 'flex-end', gap: spacing[1] },
  busBadge:  {
    width:          40,
    height:         40,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  speed: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});

const pillStyles = StyleSheet.create({
  pill: {
    paddingVertical:  spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius:     radius.full,
  },
});
