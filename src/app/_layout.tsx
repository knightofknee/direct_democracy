import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { CelebrationProvider } from '@/components/celebration';
import { LanguagePrompt } from '@/components/language-prompt';
import { UpdateModal } from '@/components/update-modal';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { LocaleProvider, useT } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

// Reanimated's dev-only strict mode warns on shared-value reads during React
// renders. Our own usage is audited clean (no .value reads in render paths or
// useMemo; first-render reads are exempt by design), and the remaining hits
// trace to library internals on re-renders - a known false-positive class
// (software-mansion/react-native-reanimated#6998). Dropping strict keeps
// every real Reanimated warning and error; this call must run before any
// component that animates, hence module scope in the root layout.
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

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
    // Gesture handling (the ward map's pinch/pan) needs this above every
    // screen; expo-router does not provide one itself.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <LocaleProvider>
        <AuthProvider>
          <SplashGate />
          <CelebrationProvider>
            <RootStack />
            <LanguagePrompt />
            <UpdateModal />
          </CelebrationProvider>
        </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}


/** The stack lives below LocaleProvider so its titles can translate. */
function RootStack() {
  const t = useT();
  return (
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="concern/[id]" options={{ title: t('Concern') }} />
        <Stack.Screen name="official/[id]" options={{ title: t('Official') }} />
        <Stack.Screen name="officials" options={{ title: t('Officials') }} />
        <Stack.Screen name="candidate/[id]/index" options={{ title: t('Candidate') }} />
        <Stack.Screen name="candidate/[id]/[policyId]" options={{ title: t('Policy') }} />
        <Stack.Screen name="election-question/[id]" options={{ title: t('Election AMA') }} />
        <Stack.Screen name="school-board/[race]" options={{ title: t('School board') }} />
        <Stack.Screen name="school-board-candidate/[id]" options={{ title: t('Candidate') }} />
        <Stack.Screen name="election-race/[race]" options={{ title: t('On your ballot') }} />
        <Stack.Screen name="election-candidate/[id]" options={{ title: t('Candidate') }} />
        <Stack.Screen name="ward-race/[ward]" options={{ title: t('Ward race') }} />
        <Stack.Screen name="sign-in" options={{ title: t('Sign in'), ...MODAL }} />
        <Stack.Screen name="new-concern" options={{ title: t('Raise a concern'), ...MODAL }} />
        <Stack.Screen name="new-poll" options={{ title: t('New poll'), ...MODAL }} />
        <Stack.Screen name="edit-policy" options={{ title: t('Platform policy'), ...MODAL }} />
        <Stack.Screen name="verify" options={{ title: t('Verify identity'), ...MODAL }} />
        <Stack.Screen name="my-activity" options={{ title: t('My activity') }} />
        <Stack.Screen name="privacy" options={{ title: t('Privacy & data') }} />
        <Stack.Screen name="settings" options={{ title: t('Settings') }} />
        <Stack.Screen name="admin" options={{ title: 'Reports' }} />
      </Stack>
  );
}
