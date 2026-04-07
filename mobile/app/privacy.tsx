/**
 * Privacy Policy screen.
 * Accessible from the welcome screen and all profile screens.
 */

import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { SRText } from '@/components/ui/SRText';
import { colors, spacing, radius, iconSize } from '@/theme';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Nav bar ── */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <ArrowLeft size={iconSize.sm} color={colors.forest} strokeWidth={2} />
        </TouchableOpacity>
        <SRText variant="subheading" style={styles.navTitle}>Privacy Policy</SRText>
        <View style={{ width: iconSize.sm + spacing[2] }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SRText variant="caption" color={colors.slate} style={styles.meta}>
          Effective April 2026 · SafeRide Technologies
        </SRText>

        <Section title="1. Who we are">
          SafeRide Technologies operates the SafeRide school bus tracking platform. This policy
          explains what personal data we collect, why we collect it, and how we protect it.{'\n\n'}
          We comply fully with India's Digital Personal Data Protection Act 2023 (DPDP 2023).
          Children's location is treated as sensitive personal data.
        </Section>

        <Section title="2. Data we collect">
          <Bold>Parents:</Bold> name, email, phone, child's name, class, assigned bus and boarding
          stop, notification preferences, and preferred language.{'\n\n'}
          <Bold>Drivers:</Bold> name, email, phone, and real-time GPS coordinates — collected only
          during an active trip and only after the driver manually starts it.{'\n\n'}
          <Bold>Managers:</Bold> name, email, phone, and school administrative data entered into
          the platform.
        </Section>

        <Section title="3. How we use your data">
          • Show parents their child's bus location and ETA{'\n'}
          • Send push and SMS notifications about bus movements{'\n'}
          • Enable schools to manage routes, buses, and students{'\n'}
          • Generate trip history for safety audits{'\n'}
          • Send service emails (password reset, invitations){'\n\n'}
          We do not use personal data for advertising.
        </Section>

        <Section title="4. Who we share data with">
          • <Bold>Your school</Bold> — transport managers see their school's data only{'\n'}
          • <Bold>Firebase (Google)</Bold> — data stored in Mumbai (asia-south1), never outside India{'\n'}
          • <Bold>Expo</Bold> — push notification tokens only (no location data){'\n\n'}
          We never sell or rent personal data.
        </Section>

        <Section title="5. Children's privacy (DPDP 2023)">
          • Parent consent is required before any location data is shown{'\n'}
          • GPS is collected only during active school trips{'\n'}
          • A parent sees only their own child's bus{'\n'}
          • GPS coordinates are deleted after 30 days{'\n'}
          • Consent may be withdrawn at any time by emailing privacy@saferide.co.in
        </Section>

        <Section title="6. Data retention">
          • GPS coordinates — deleted after 30 days{'\n'}
          • Trip summaries — retained 7 years for school audit{'\n'}
          • Account data — deleted within 90 days of subscription end{'\n'}
          • Consent records — retained indefinitely (legal obligation)
        </Section>

        <Section title="7. Your rights">
          Under DPDP 2023 you have the right to access, correct, erase, and port your data.
          To exercise any right, email privacy@saferide.co.in. We respond within 30 days.
        </Section>

        <Section title="8. Security">
          All data in transit is protected by TLS 1.3. Data at rest is encrypted by Firebase.
          GPS coordinates use field-level encryption. Access tokens expire after 15 minutes.
        </Section>

        <Section title="9. Contact &amp; Grievance Officer">
          Grievance Officer, SafeRide Technologies{'\n'}
          privacy@saferide.co.in{'\n'}
          saferide.co.in/privacy{'\n\n'}
          Response time: within 30 days of receipt
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SRText variant="subheading" color={colors.forest} style={styles.sectionTitle}>
        {title}
      </SRText>
      <SRText variant="body" color={colors.ink} style={styles.sectionBody}>
        {children}
      </SRText>
    </View>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return (
    <SRText variant="body" style={{ fontWeight: '500', color: colors.ink }}>
      {children}
    </SRText>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  nav: {
    height:            52,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
    backgroundColor:   colors.surface,
  },
  backBtn: {
    padding: spacing[2],
    marginLeft: -spacing[2],
  },
  navTitle: {
    color: colors.forest,
  },

  content: {
    padding: spacing[6],
    gap:     spacing[6],
  },
  meta: {
    marginBottom: spacing[2],
  },

  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    marginBottom: spacing[1],
  },
  sectionBody: {
    lineHeight: 22,
    color:      colors.ink,
  },
});
