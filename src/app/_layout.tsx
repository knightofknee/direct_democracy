import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { CelebrationProvider } from '@/components/celebration';
import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/hooks/use-auth';

SplashScreen.preventAutoHideAsync();

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
          </Stack>
        </CelebrationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
