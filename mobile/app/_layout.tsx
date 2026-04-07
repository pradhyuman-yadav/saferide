import '../src/i18n';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { useAuthStore } from '@/store/auth.store';
import { StatusBar } from 'expo-status-bar';
import { AppLogo } from '@/components/ui/AppLogo';
import { colors } from '@/theme';

// Must be imported at module scope so the background task definition is registered
// before the app renders or any navigation occurs.
import '@/tasks/location.task';

import { setupNotificationHandler, registerForPushNotifications } from '@/notifications/push';

// Configure foreground notification display before any notification can arrive
setupNotificationHandler();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isLoading, initialize, user } = useAuthStore();
  const router   = useRouter();
  const segments = useSegments();

  const [fontsLoaded] = useFonts({
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, []);

  // Register for push notifications whenever a user signs in
  useEffect(() => {
    if (!user) return;
    registerForPushNotifications(user.uid).catch((err) => {
      if (__DEV__) console.warn('[push] Registration error:', err);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  // ── Global auth guard ──────────────────────────────────────────────────────
  // Runs whenever auth state changes, from any screen in the app.
  // index.tsx handles the initial role-based route; this handles sign-out.
  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // User signed out (or session expired) from inside the app — send to welcome
      router.replace('/(auth)/welcome');
    }
  }, [user, isLoading, fontsLoaded, segments]);

  if (!fontsLoaded || isLoading) {
    return (
      <View style={splash.container}>
        <StatusBar style="light" />
        <AppLogo size={52} color={colors.mist} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(parent)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(manager)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </>
  );
}

const splash = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.forest,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
