import { View, StyleSheet, StatusBar, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/ui/AppLogo';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t }  = useTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.forest} />

      {/* Brand section — fills upper portion */}
      <View style={styles.brand}>
        <AppLogo size={52} color={colors.mist} />
        <SRText variant="body" color={colors.mist} style={styles.tagline}>
          {t('auth.taglineCaption')}
        </SRText>
      </View>

      {/* Actions — pinned to bottom */}
      <View style={styles.actions}>
        <SRButton
          label={t('auth.signIn')}
          size="lg"
          onPress={() => router.push('/(auth)/login')}
        />
        <SRText variant="caption" color={colors.mist} style={styles.hint}>
          {t('auth.welcomeHint')}
        </SRText>

        {/* Legal links */}
        <View style={styles.legalRow}>
          <TouchableOpacity
            onPress={() => { void Linking.openURL('https://saferide.co.in/terms'); }}
            activeOpacity={0.7}
          >
            <SRText variant="caption" style={styles.legalLink}>Terms of Service</SRText>
          </TouchableOpacity>
          <SRText variant="caption" style={styles.legalDot}>{'·'}</SRText>
          <TouchableOpacity
            onPress={() => { void Linking.openURL('https://saferide.co.in/privacy'); }}
            activeOpacity={0.7}
          >
            <SRText variant="caption" style={styles.legalLink}>Privacy Policy</SRText>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.forest,
  },
  brand: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing[8],
    gap:               spacing[4],
  },
  tagline: {
    textAlign:  'center',
    opacity:    0.75,
    lineHeight: 22,
    marginTop:  spacing[2],
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingBottom:     spacing[8],
    gap:               spacing[3],
  },
  hint: {
    textAlign: 'center',
    opacity:   0.55,
  },

  legalRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[2],
    marginTop:      spacing[1],
  },
  legalLink: {
    color:        colors.mist,
    opacity:      0.5,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color:   colors.mist,
    opacity: 0.35,
  },
});
