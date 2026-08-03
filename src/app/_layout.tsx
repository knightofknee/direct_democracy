import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { CelebrationProvider } from '@/components/celebration';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';

SplashScreen.preventAutoHideAsync();

/**
 * Holds the native splash until the persisted auth state is known, so the
 * first frame is the right one (signed-in home vs. signed-out home) instead
 * of a flash of the wrong state. Without an explicit hideAsync() the splash
 * never dismisses at all.
 */
function SplashGate() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';
  const palette = dark ? Colors.dark : Colors.light;
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <SplashGate />
        <CelebrationProvider>
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="concern/[id]" options={{ title: 'Concern' }} />
            <Stack.Screen name="official/[id]" options={{ title: 'AMA' }} />
            <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
            <Stack.Screen name="new-concern" options={{ title: 'Raise a concern', presentation: 'modal' }} />
            <Stack.Screen name="new-poll" options={{ title: 'New poll', presentation: 'modal' }} />
            <Stack.Screen name="verify" options={{ title: 'Verify identity', presentation: 'modal' }} />
            <Stack.Screen name="my-activity" options={{ title: 'My activity' }} />
            <Stack.Screen name="privacy" options={{ title: 'Privacy & data' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="admin" options={{ title: 'Reports' }} />
          </Stack>
        </CelebrationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
