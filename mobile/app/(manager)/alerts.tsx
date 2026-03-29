import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gauge, Route, WifiOff, AlertTriangle } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';

interface Alert {
  id: string;
  type: 'speed' | 'deviation' | 'offline' | 'sos';
  busNumber: string;
  driver: string;
  message: string;
  time: string;
  resolved: boolean;
}

const MOCK_ALERTS: Alert[] = [
  { id: '1', type: 'speed',     busNumber: '7',  driver: 'Raju Sharma',   message: 'Speed 72 km/h — exceeded 60 km/h limit.',      time: '8:12 AM', resolved: false },
  { id: '2', type: 'deviation', busNumber: '12', driver: 'Mohan Das',     message: 'Bus 600m off planned route near Whitefield.',   time: '8:05 AM', resolved: false },
  { id: '3', type: 'offline',   busNumber: '5',  driver: 'Pradeep Rao',   message: 'No GPS ping for 8 minutes.',                    time: '7:58 AM', resolved: true  },
  { id: '4', type: 'sos',       busNumber: '9',  driver: 'Suresh Kumar',  message: 'SOS triggered. Location: Koramangala 4th Block.', time: 'Yesterday', resolved: true },
];

const ALERT_ICON: Record<Alert['type'], React.ReactNode> = {
  speed:     <Gauge size={iconSize.md} color={colors.gold} strokeWidth={2} />,
  deviation: <Route size={iconSize.md} color={colors.gold} strokeWidth={2} />,
  offline:   <WifiOff size={iconSize.md} color={colors.slate} strokeWidth={2} />,
  sos:       <AlertTriangle size={iconSize.md} color={colors.badgeAlertFg} strokeWidth={2} />,
};

export default function ManagerAlertsScreen() {
  const unresolved = MOCK_ALERTS.filter((a) => !a.resolved).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          Requires attention
        </SRText>
        <SRText variant="heading">Alerts</SRText>
        {unresolved > 0 && (
          <SRBadge label={`${unresolved} unresolved`} variant="alert" style={{ marginTop: spacing[2] }} />
        )}
      </View>

      <FlatList
        data={MOCK_ALERTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, item.resolved && styles.cardResolved]}>
            <View style={[styles.iconBg, item.type === 'sos' && styles.iconBgSOS]}>
              {ALERT_ICON[item.type]}
            </View>
            <View style={styles.info}>
              <View style={styles.topRow}>
                <SRText variant="body" style={{ fontWeight: '500', flex: 1 }}>
                  Bus {item.busNumber} — {item.driver}
                </SRText>
                <SRText variant="caption">{item.time}</SRText>
              </View>
              <SRText variant="caption">{item.message}</SRText>
              {item.resolved && (
                <SRBadge label="Resolved" variant="active" style={{ marginTop: spacing[1] }} />
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
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
  list:    { padding: spacing[6], gap: spacing[3] },
  card:    {
    flexDirection:    'row',
    alignItems:       'flex-start',
    backgroundColor:  colors.surface,
    borderRadius:     radius.xl,
    padding:          spacing[4],
    borderWidth:      0.5,
    borderColor:      colors.stone,
    gap:              spacing[3],
  },
  cardResolved: { opacity: 0.55 },
  iconBg: {
    width:           44,
    height:          44,
    borderRadius:    radius.md,
    backgroundColor: colors.goldAlpha20,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconBgSOS: { backgroundColor: colors.badgeAlertBg },
  info:    { flex: 1, gap: spacing[1] },
  topRow:  { flexDirection: 'row', alignItems: 'center' },
});
