import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { colors } from '@/theme';

/**
 * Entry point — reads auth state and role, navigates to the correct section.
 *
 * Why useEffect + router.replace instead of <Redirect>?
 * -------------------------------------------------------
 * Expo Router's useLinking hook resolves the initial URL asynchronously.
 * Rendering <Redirect> synchronously (in the same pass that mounts the Stack)
 * causes a race: the target screen starts mounting while useLinking's
 * url.then callback is still pending, producing React's
 * "Can't update state on a component that hasn't mounted yet" warning.
 *
 * Putting the navigation inside useEffect guarantees this component fully
 * commits before any router.replace fires, so useLinking always wins the
 * race and the navigation container is fully ready.
 */
export default function Index() {
  const { user, role, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // wait for auth to resolve

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    // Authenticated but no profile / role → onboarding
    if (!role) {
      router.replace('/(auth)/onboarding');
      return;
    }

    switch (role) {
      case 'parent':       router.replace('/(parent)/');  break;
      case 'driver':       router.replace('/(driver)/');  break;
      case 'manager':      router.replace('/(manager)/'); break;
      case 'school_admin': router.replace('/(admin)/');   break;
      // super_admin uses the web dashboard — redirect to login on mobile
      default:             router.replace('/(auth)/login'); break;
    }
  }, [isLoading, user, role]);

  // Render a spinner while resolving — the splash screen covers this on startup
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.sage} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
