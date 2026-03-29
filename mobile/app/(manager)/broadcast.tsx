import { useState } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle } from 'lucide-react-native';
import { MOCK_FLEET } from '@/mocks/bus.mock';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, typography, iconSize } from '@/theme';

const TEMPLATES = [
  { id: 't1', label: 'Delay',         text: 'Bus is running approximately 15 minutes late due to traffic. Updated ETA will be sent shortly.' },
  { id: 't2', label: 'Route change',  text: 'Bus will take an alternate route today due to road works. No change to pickup times.' },
  { id: 't3', label: 'Early arrival', text: 'Bus is running 5 minutes ahead of schedule today.' },
  { id: 't4', label: 'School notice', text: 'School closes early today. Buses will depart at 1:00 PM.' },
];

export default function BroadcastScreen() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [message, setMessage]             = useState('');
  const [sending, setSending]             = useState(false);
  const [sent, setSent]                   = useState(false);

  const routes = [{ id: 'all', name: 'All routes' }, ...MOCK_FLEET.map((b) => ({ id: b.busId, name: b.routeName }))];

  async function handleSend() {
    if (!selectedRoute || !message.trim()) {
      Alert.alert('Incomplete', 'Please select a route and type a message.');
      return;
    }
    setSending(true);
    // Simulate 30s delivery SLA
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
    setTimeout(() => { setSent(false); setMessage(''); setSelectedRoute(null); }, 3000);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
            Parent notifications
          </SRText>
          <SRText variant="heading">Broadcast</SRText>
          <SRText variant="caption" style={{ marginTop: spacing[1] }}>
            Message delivered to all parents on the selected route within 30 seconds.
          </SRText>
        </View>

        {/* Route selection */}
        <SRText variant="label" color={colors.slate} style={styles.sectionLabel}>
          Send to
        </SRText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroll}>
          {routes.map((r) => {
            const active = selectedRoute === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.routeChip, active && styles.routeChipActive]}
                onPress={() => setSelectedRoute(r.id)}
                activeOpacity={0.8}
              >
                <SRText
                  variant="caption"
                  color={active ? colors.forest : colors.slate}
                  style={{ fontWeight: active ? '500' : '400' }}
                >
                  {r.name}
                </SRText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Templates */}
        <SRText variant="label" color={colors.slate} style={[styles.sectionLabel, { marginTop: spacing[5] }]}>
          Quick templates
        </SRText>
        <View style={styles.templates}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.template}
              onPress={() => setMessage(t.text)}
              activeOpacity={0.8}
            >
              <SRText variant="label" color={colors.forest}>{t.label}</SRText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message input */}
        <SRText variant="label" color={colors.slate} style={[styles.sectionLabel, { marginTop: spacing[5] }]}>
          Message
        </SRText>
        <TextInput
          style={styles.textarea}
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message to parents…"
          placeholderTextColor={colors.slate}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <SRText variant="caption" style={{ marginTop: spacing[1] }}>
          {message.length} / 280 characters
        </SRText>

        {/* Send */}
        {sent ? (
          <View style={styles.sentRow}>
            <CheckCircle size={iconSize.md} color={colors.sage} strokeWidth={2} />
            <SRText variant="body" color={colors.sage} style={{ fontWeight: '500' }}>
              Message sent to all parents
            </SRText>
          </View>
        ) : (
          <SRButton
            label="Send to parents"
            onPress={handleSend}
            loading={sending}
            size="lg"
            style={{ marginTop: spacing[5] }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  content:   { paddingBottom: spacing[10] },
  header:    {
    padding:          spacing[6],
    paddingBottom:    spacing[5],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
    marginBottom:     spacing[2],
  },
  sectionLabel: { paddingHorizontal: spacing[6] },
  routeScroll:  { marginTop: spacing[2], paddingLeft: spacing[6] },
  routeChip:    {
    paddingVertical:  spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderRadius:     radius.full,
    borderWidth:      0.5,
    borderColor:      colors.stone,
    marginRight:      spacing[2],
    backgroundColor:  colors.surface,
  },
  routeChipActive: {
    borderColor:     colors.sage,
    borderWidth:     1,
    backgroundColor: colors.sageAlpha18,
  },
  templates: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            spacing[2],
    paddingHorizontal: spacing[6],
    marginTop:      spacing[2],
  },
  template: {
    paddingVertical:  spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderRadius:     radius.full,
    backgroundColor:  colors.sageAlpha18,
    borderWidth:      0.5,
    borderColor:      colors.sage,
  },
  textarea: {
    marginHorizontal: spacing[6],
    marginTop:        spacing[2],
    borderWidth:      0.5,
    borderColor:      colors.stone,
    borderRadius:     radius.lg,
    padding:          spacing[3],
    fontFamily:       typography.body.fontFamily,
    fontSize:         14,
    color:            colors.ink,
    backgroundColor:  colors.surface,
    height:           120,
  },
  sentRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[2],
    marginTop:      spacing[5],
  },
});
