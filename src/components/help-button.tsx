import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { helpKey, pageHelp } from '@/lib/page-help';

/**
 * The "?" on every screen (2026-09-30), always in the top-right corner:
 * opens the help sheet for the page it sits on, with what is on the page
 * right now and what can be done there. Renders nothing on a screen
 * without help (the operator's admin screen, the help sheet itself).
 */
export function HelpButton() {
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const page = helpKey(segments);
  if (!pageHelp(page, profile?.role)) return null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/help', params: { page } })}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('Help with this page')}>
      <Ionicons name="help-circle-outline" size={23} color={theme.primary} />
    </Pressable>
  );
}

/**
 * A header's right side: the help button, then the screen's own action
 * (share, or a modal's close button, which keeps the outer corner).
 */
export function HeaderActions({ children }: { children?: React.ReactNode }) {
  return (
    // Phones inset a header's right side themselves; the web header puts
    // it flush against the window edge.
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: Platform.OS === 'web' ? 16 : 0 }}>
      <HelpButton />
      {children}
    </View>
  );
}
