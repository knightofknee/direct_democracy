import { Stack } from 'expo-router';
import React from 'react';

import { HeaderActions } from '@/components/help-button';
import { useT } from '@/lib/i18n';

/**
 * The elections tab's own stack (2026-10-14, Brian: the tab bar has to stay
 * on screen through the races, and tapping the tab has to get out of a
 * long run of pages in one tap). A group, so every URL is what it was
 * (/election, /election-race/<race>, ...): shared links, the search pages,
 * and notification links are unchanged. Since 2026-11-04 the tab is the
 * mayor games, and the four games and the mayoral candidate pages live
 * here too (/game/<kind>, /mayor/<slug>).
 */
export const unstable_settings = {
  // A link straight to a race or a game still has the tab under it.
  initialRouteName: 'election',
};

export default function ElectionStack() {
  const t = useT();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        // The help "?" in every header's top-right corner, as in the root stack.
        headerRight: () => <HeaderActions />,
      }}>
      <Stack.Screen name="election" options={{ headerShown: false }} />
      <Stack.Screen name="game/[kind]" options={{ title: t('Mayor games') }} />
      <Stack.Screen name="mayor/[slug]" options={{ title: t('Candidate for mayor') }} />
      <Stack.Screen name="election-race/[race]" options={{ title: t('On your ballot') }} />
      <Stack.Screen name="election-candidate/[id]" options={{ title: t('Candidate') }} />
      <Stack.Screen name="ward-race/[ward]" options={{ title: t('Ward race') }} />
      <Stack.Screen name="election-question/[id]" options={{ title: t('Election AMA') }} />
    </Stack>
  );
}
