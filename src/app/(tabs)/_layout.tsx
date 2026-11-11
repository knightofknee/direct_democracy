import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const isPolitician = profile?.role === 'official' || profile?.role === 'candidate';
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        // Android resizes the window for the keyboard; without this the tab
        // bar rides up and sits on top of it. No effect on iOS.
        tabBarHideOnKeyboard: true,
        // Five labels (six for politicians) share the width. When
        // "notifications" was a tab, a 320pt phone or large system text cut
        // it to "notificati..." (it is the bell at the top since 2026-10-07).
        // Labels stay at their designed size (tab bars do
        // not follow the text-size setting on either platform) and step down
        // a point on narrow screens so every word fits whole.
        tabBarAllowFontScaling: false,
        tabBarItemStyle: { paddingHorizontal: 0 },
        // Six tabs (a politician's) get a further step so the longest label
        // still fits whole in a sixth of a small phone, and may run into
        // the tab button's built-in 5pt side padding.
        tabBarLabelStyle: isPolitician
          ? width < 360
            ? { fontSize: 8, letterSpacing: -0.3, marginHorizontal: -5, maxWidth: 80 }
            : width < 414
              ? { fontSize: 9, letterSpacing: -0.35, marginHorizontal: -5, maxWidth: 80 }
              : undefined
          : width < 360
            ? { fontSize: 9, letterSpacing: -0.2 }
            : undefined,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          // Home: everything citywide together (the big board first).
          title: t('home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ward"
        options={{
          title: t('wards'),
          tabBarIcon: ({ color, size }) => <Ionicons name="location" size={size} color={color} />,
        }}
      />
      {/* The mayor games take the middle of the bar, ahead of news
          (2026-10-13): the ballot matters more than the headlines. */}
      <Tabs.Screen
        // A group with its own stack ((election)/_layout.tsx): the games and
        // every race page keep the tab bar, and the URLs stay /election etc.
        name="(election)"
        options={{
          // Web only: the link otherwise points at whichever of the group's
          // pages sorts first. Never on phones: there an href turns the tap
          // into a jump to /election that slides forward onto a blank screen
          // before settling, instead of the tab's own pop back to the top
          // (the same motion as Back).
          href: Platform.OS === 'web' ? '/election' : undefined,
          // Still "elections" (2026-11-09, Brian): the mayor games lead the
          // tab, but it holds the whole February ballot.
          title: t('elections'),
          tabBarIcon: ({ color, size }) => <Ionicons name="ribbon" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: t('news'),
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />,
        }}
      />

      {/* Only officials and candidates have a command center; for everyone
          else the tab is not there at all. */}
      <Tabs.Screen
        name="command"
        options={{
          title: t('command'),
          href: isPolitician ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
