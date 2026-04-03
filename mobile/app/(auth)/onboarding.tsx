import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { AppLogo } from '@/components/ui/AppLogo';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing } from '@/theme';

/**
 * Shown when a user has signed in but no profile has been set up yet.
 *
 * Flow: school admin creates a student record → route-service writes
 * pendingInvites/{email_key} → parent receives a setup email → parent
 * sets their password and signs in → auth.store claimPendingInviteByEmail
 * finds the invite and creates the profile automatically.
 *
 * This screen is reached only when no invite was found (admin hasn't created
 * the student record yet, or the wrong email was used).
 */
export default function OnboardingScreen() {
  const { t }       = useTranslation();
  const { signOut } = useAuthStore();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logo}>
          <AppLogo size={28} color={colors.forest} />
        </View>

        <SRText variant="label" color={colors.slate} style={styles.eyebrow}>
          {t('onboarding.eyebrow')}
        </SRText>
        <SRText variant="heading" style={styles.heading}>
          {t('onboarding.heading')}
        </SRText>
        <SRText variant="body" color={colors.slate} style={styles.body}>
          {t('onboarding.body')}
        </SRText>

        <View style={styles.actions}>
          <SRButton
            label={t('onboarding.signOut')}
            variant="ghost"
            onPress={() => { void signOut(); }}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  container: {
    flex:              1,
    paddingHorizontal: spacing[6],
    paddingTop:        spacing[12],
  },
  logo: {
    marginBottom: spacing[8],
  },
  eyebrow: {
    marginBottom: spacing[2],
  },
  heading: {
    marginBottom: spacing[3],
  },
  body: {
    lineHeight:   22,
    marginBottom: spacing[2],
  },
  actions: {
    marginTop: spacing[10],
    gap:       spacing[3],
  },
});
