import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, useColorScheme } from 'react-native';

import { CelebrationProvider } from '@/components/celebration';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

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

/**
 * Explicit close affordance for modal screens - dragging down works on iOS,
 * but not everyone thinks to drag (and web/Android need a button anyway).
 */
function ModalClose() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Close">
      <Ionicons name="close" size={24} color={theme.text} />
    </Pressable>
  );
}

/** Shared options for every modal screen. */
const MODAL = {
  presentation: 'modal' as const,
  headerRight: () => <ModalClose />,
};

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
            <Stack.Screen name="candidate/[id]/index" options={{ title: 'Candidate' }} />
            <Stack.Screen name="candidate/[id]/[policyId]" options={{ title: 'Policy' }} />
            <Stack.Screen name="sign-in" options={{ title: 'Sign in', ...MODAL }} />
            <Stack.Screen name="new-concern" options={{ title: 'Raise a concern', ...MODAL }} />
            <Stack.Screen name="new-poll" options={{ title: 'New poll', ...MODAL }} />
            <Stack.Screen name="edit-policy" options={{ title: 'Platform policy', ...MODAL }} />
            <Stack.Screen name="verify" options={{ title: 'Verify identity', ...MODAL }} />
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
