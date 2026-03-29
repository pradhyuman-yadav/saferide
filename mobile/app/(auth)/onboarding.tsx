import { useState } from 'react';
import { View, TextInput, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { redeemInviteCode } from '@/firebase/firestore';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { colors, spacing, radius, typography } from '@/theme';

export default function OnboardingScreen() {
  const router                = useRouter();
  const { user, setProfile }  = useAuthStore();
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRedeem() {
    if (!code.trim() || !user) return;

    setLoading(true);
    try {
      const profile = await redeemInviteCode(
        user.uid,
        user.email ?? '',
        user.displayName ?? user.email ?? 'User',
        code.trim(),
      );
      setProfile(profile);
      router.replace('/');
    } catch (err: unknown) {
      Alert.alert('Invalid code', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[2] }}>
          Almost there
        </SRText>
        <SRText variant="heading" style={{ marginBottom: spacing[1] }}>
          Enter your invite code
        </SRText>
        <SRText variant="caption" color={colors.slate} style={{ marginBottom: spacing[8] }}>
          Your school admin will have sent you a code to get started.
        </SRText>

        <SRText variant="label" color={colors.slate} style={{ marginBottom: spacing[1] }}>
          Invite code
        </SRText>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="e.g. SR-XYZABC"
          placeholderTextColor={colors.slate}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <SRButton
          label="Redeem code"
          onPress={handleRedeem}
          loading={loading}
          disabled={!code.trim()}
          style={{ marginTop: spacing[6] }}
          size="lg"
        />

        <SRText
          variant="caption"
          color={colors.slate}
          style={{ marginTop: spacing[6], textAlign: 'center' }}
        >
          Don't have a code? Contact your school's transport manager.
        </SRText>
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
    paddingTop:        spacing[10],
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
    letterSpacing:   2,
  },
});
