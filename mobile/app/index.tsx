import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/auth.store';
import { permissionsShownKey } from './(auth)/permissions';
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
      router.replace('/(auth)/welcome');
      return;
    }

    // Authenticated but no profile / role → onboarding
    if (!role) {
      router.replace('/(auth)/onboarding');
      return;
    }

    // Check if we've already shown the permissions screen for this user.
    // Using an async IIFE so we can await SecureStore without making the
    // effect itself async (which would break the cleanup return pattern).
    void (async () => {
      const shown = await SecureStore.getItemAsync(permissionsShownKey(user.uid)).catch(() => '1');

      if (!shown) {
        // First login for this user on this device — show permissions screen
        router.replace('/(auth)/permissions');
        return;
      }

      // Permissions already handled — route straight to role screen
      switch (role) {
        case 'parent':       router.replace('/(parent)/');         break;
        case 'driver':       router.replace('/(driver)/');         break;
        case 'manager':      router.replace('/(manager)/');        break;
        case 'school_admin': router.replace('/(admin)/');          break;
        // super_admin uses the web dashboard — show a dedicated "use the web" screen
        // instead of bouncing back to login (which would cause an infinite loop).
        default:             router.replace('/(auth)/web-only');   break;
      }
    })();
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
