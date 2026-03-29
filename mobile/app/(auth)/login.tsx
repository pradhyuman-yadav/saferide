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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmail, createAccount, resetPassword } from '@/firebase/auth';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, typography } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [isNew, setIsNew]       = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isNew) {
        await createAccount(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      // Send back to index — it reads the updated auth store and routes to the correct section
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Hero header */}
      <View style={styles.hero}>
        <SRText variant="label" color={colors.mist} style={{ opacity: 0.7, marginBottom: spacing[2] }}>
          School bus safety platform
        </SRText>
        <SRText variant="display" color={colors.white}>SafeRide</SRText>
        <SRText variant="body" color={colors.mist} style={{ opacity: 0.85, marginTop: spacing[1] }}>
          Calm · Grounded · Always there
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
            {isNew ? 'Create account' : 'Welcome back'}
          </SRText>
          <SRText variant="caption" style={{ marginBottom: spacing[6] }}>
            {isNew
              ? 'Enter your email to get started.'
              : 'Sign in to see your child\'s bus.'}
          </SRText>

          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
            Email address
          </SRText>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.slate}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1], marginTop: spacing[4] }}>
            Password
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
            label={isNew ? 'Create account' : 'Continue'}
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: spacing[6] }}
            size="lg"
          />

          {!isNew && (
            <SRButton
              label="Forgot password?"
              variant="ghost"
              onPress={async () => {
                if (!email.trim()) {
                  Alert.alert('Enter your email', 'Type your email address above, then tap Forgot password.');
                  return;
                }
                try {
                  await resetPassword(email.trim());
                  Alert.alert('Email sent', 'Check your inbox for a password reset link.');
                } catch (err: unknown) {
                  Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
                }
              }}
              style={{ marginTop: spacing[2] }}
              size="lg"
            />
          )}

          <SRButton
            label={isNew ? 'Already have an account? Sign in' : 'New here? Create an account'}
            variant="secondary"
            onPress={() => setIsNew((v) => !v)}
            style={{ marginTop: spacing[3] }}
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
