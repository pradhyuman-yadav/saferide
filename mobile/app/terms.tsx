/**
 * Terms of Service screen.
 * Accessible from the welcome screen and all profile screens.
 */

import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { colors, spacing, iconSize } from '@/theme';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Nav bar ── */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <ArrowLeft size={iconSize.sm} color={colors.forest} strokeWidth={2} />
        </TouchableOpacity>
        <SRText variant="subheading" style={styles.navTitle}>Terms of Service</SRText>
        <View style={{ width: iconSize.sm + spacing[2] }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SRText variant="caption" color={colors.slate} style={styles.meta}>
          Effective April 2026 · SafeRide Technologies
        </SRText>

        <Section title="1. Acceptance">
          By creating an account or using SafeRide, you agree to these Terms. If you are using
          SafeRide on behalf of a school, you confirm you have authority to bind the school to
          these Terms.
        </Section>

        <Section title="2. The service">
          SafeRide provides school bus tracking, parent notifications, and fleet management for
          schools. GPS tracking occurs only during active trips that drivers manually start.{'\n\n'}
          New schools receive a 30-day free trial. A paid subscription is required to continue
          after the trial.
        </Section>

        <Section title="3. Accounts">
          • School administrators manage all accounts for their school and are accountable for
          all activity under their account{'\n'}
          • Parents must not share login credentials{'\n'}
          • Drivers must never operate the app while the vehicle is moving{'\n'}
          • Provide accurate information and notify us of any unauthorised access at
          support@saferide.co.in
        </Section>

        <Section title="4. Acceptable use">
          You must not use SafeRide to track unconsenting persons, access other schools' data,
          reverse-engineer the software, transmit malware or spam, or harm any individual.
          Automated scraping without written permission is prohibited.
        </Section>

        <Section title="5. School responsibilities">
          Schools must obtain parent consent before enabling GPS tracking, keep student data
          accurate, remove access for departed staff promptly, and comply with applicable data
          protection laws including DPDP 2023.
        </Section>

        <Section title="6. Availability and accuracy">
          We aim for 99.9% uptime. GPS accuracy depends on the driver's device, network, and
          satellite coverage. ETA predictions are estimates — not guarantees.
        </Section>

        <Section title="7. Limitation of liability">
          To the maximum extent permitted by law, SafeRide is not liable for indirect,
          incidental, or consequential damages, GPS inaccuracy, network outages, or actions
          of schools, drivers, or third parties.{'\n\n'}
          SafeRide is a notification and visibility tool — it does not replace the duty of
          care of schools or drivers. Our total liability in any 12-month period is capped at
          subscription fees paid in that period.
        </Section>

        <Section title="8. Intellectual property">
          All SafeRide software, design, and trademarks belong to SafeRide Technologies.
          Your subscription grants a limited right to use the platform. Your school's data
          (students, routes, drivers) remains yours and can be exported at any time.
        </Section>

        <Section title="9. Termination">
          Either party may terminate with 30 days' notice. We may suspend your account
          immediately for Terms violations, non-payment, or risk to other users.
          Data will be exported within 30 days of termination then deleted.
        </Section>

        <Section title="10. Governing law">
          These Terms are governed by the laws of India. Disputes are subject to the
          exclusive jurisdiction of the courts in Bengaluru, Karnataka. Parties will attempt
          good-faith negotiation for 30 days before initiating legal proceedings.
        </Section>

        <Section title="11. Changes">
          We will notify you by email at least 14 days before material changes take effect.
          Continued use after the effective date constitutes acceptance.
        </Section>

        <View style={styles.contact}>
          <SRText variant="caption" color={colors.slate} style={styles.contactLabel}>
            CONTACT
          </SRText>
          <SRText variant="body" color={colors.ink}>
            SafeRide Technologies{'\n'}
            support@saferide.co.in{'\n'}
            saferide.co.in
          </SRText>
        </View>

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
    padding:    spacing[2],
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

  contact: {
    gap:             spacing[2],
    backgroundColor: colors.surface,
    borderRadius:    12,
    borderWidth:     0.5,
    borderColor:     colors.stone,
    padding:         spacing[5],
    marginTop:       spacing[2],
  },
  contactLabel: {
    letterSpacing: 0.06,
  },
});
