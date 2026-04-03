import { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { AppLogo } from '@/components/ui/AppLogo';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { signInWithEmail, resetPassword } from '@/firebase/auth';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, typography } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { t }  = useTranslation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('auth.missingFieldsTitle'), t('auth.missingFieldsMessage'));
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // Send back to index — it reads the updated auth store and routes to the correct section
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.errorMessage');
      Alert.alert(t('auth.errorTitle'), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Hero header */}
      <View style={styles.hero}>
        <SRText variant="label" color={colors.mist} style={{ opacity: 0.7, marginBottom: spacing[4] }}>
          {t('auth.tagline')}
        </SRText>
        <AppLogo size={36} color={colors.mist} />
        <SRText variant="body" color={colors.mist} style={{ opacity: 0.85, marginTop: spacing[4] }}>
          {t('auth.taglineCaption')}
        </SRText>
      </View>

      {/* Login card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.card}
          keyboardShouldPersistTaps="handled"
        >
          <SRText variant="heading" style={{ marginBottom: spacing[1] }}>
            {t('auth.welcomeBack')}
          </SRText>
          <SRText variant="caption" style={{ marginBottom: spacing[6] }}>
            {t('auth.signInCaption')}
          </SRText>

          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
            {t('auth.emailLabel')}
          </SRText>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.slate}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1], marginTop: spacing[4] }}>
            {t('auth.passwordLabel')}
          </SRText>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.slate}
            secureTextEntry
          />

          <SRButton
            label={t('auth.continue')}
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: spacing[6] }}
            size="lg"
          />

          <SRButton
            label={t('auth.forgotPassword')}
            variant="ghost"
            onPress={async () => {
              if (!email.trim()) {
                Alert.alert(t('auth.enterEmailTitle'), t('auth.enterEmailMessage'));
                return;
              }
              try {
                await resetPassword(email.trim());
                Alert.alert(t('auth.emailSentTitle'), t('auth.emailSentMessage'));
              } catch (err: unknown) {
                Alert.alert(t('auth.errorTitle'), err instanceof Error ? err.message : t('auth.errorMessage'));
              }
            }}
            style={{ marginTop: spacing[2] }}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.forest,
  },
  flex: { flex: 1 },
  hero: {
    paddingHorizontal: spacing[6],
    paddingTop:        spacing[10],
    paddingBottom:     spacing[8],
  },
  card: {
    backgroundColor:  colors.background,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:          spacing[6],
    paddingTop:       spacing[8],
    flexGrow:         1,
  },
  input: {
    borderWidth:     0.5,
    borderColor:     colors.stone,
    borderRadius:    radius.sm,
    padding:         spacing[3],
    fontFamily:      typography.body.fontFamily,
    fontSize:        14,
    color:           colors.ink,
    backgroundColor: colors.surface,
  },
});
