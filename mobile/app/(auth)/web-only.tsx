/**
 * web-only.tsx
 * Shown when a super_admin signs in on the mobile app.
 *
 * Super admins manage the entire platform — their controls live in the
 * web admin dashboard (saferide.co.in). This screen explains that and
 * provides a sign-out option so they are not stuck in a loop.
 */
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { SRText } from '@/components/ui/SRText';
import { AppLogo } from '@/components/ui/AppLogo';
import { colors, spacing, radius } from '@/theme';

const DASHBOARD_URL = 'https://saferide.co.in';

export default function WebOnlyScreen() {
  const router = useRouter();

  const handleOpenDashboard = () => {
    void Linking.openURL(DASHBOARD_URL);
  };

  const handleSignOut = async () => {
    await signOut(getAuth());
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <AppLogo size={40} color={colors.sage} />

        <SRText variant="heading" color={colors.forest} style={styles.heading}>
          Admin dashboard
        </SRText>

        <SRText variant="body" color={colors.slate} style={styles.body}>
          Super admin accounts are managed through the SafeRide web dashboard.
          Open the link below from any browser to access your controls.
        </SRText>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleOpenDashboard}
          activeOpacity={0.82}
        >
          <SRText variant="body" color={colors.white} style={styles.btnLabel}>
            Open web dashboard
          </SRText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => { void handleSignOut(); }}
          activeOpacity={0.82}
        >
          <SRText variant="body" color={colors.slate} style={styles.btnLabel}>
            Sign out
          </SRText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    padding:         spacing[6],
    gap:             spacing[4],
    maxWidth:        360,
    width:           '100%',
    borderWidth:     0.5,
    borderColor:     colors.stone,
    alignItems:      'center',
  },
  heading: {
    textAlign: 'center',
  },
  body: {
    textAlign:  'center',
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor:   colors.forest,
    borderRadius:      radius.sm,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[6],
    alignItems:        'center',
    width:             '100%',
    marginTop:         spacing[2],
  },
  secondaryBtn: {
    borderRadius:      radius.sm,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[6],
    alignItems:        'center',
    width:             '100%',
    borderWidth:       0.5,
    borderColor:       colors.stone,
  },
  btnLabel: {
    fontWeight: '500',
  },
});
