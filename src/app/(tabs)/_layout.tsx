import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { collection, limit, query, where } from 'firebase/firestore';
import React from 'react';
import { useWindowDimensions } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  // Unread count for the notifications tab badge. Capped at 10 reads; the
  // badge shows "9+" past that.
  const { data: unread } = useLiveQuery<{ id: string }>(
    () =>
      profile
        ? query(
            collection(db, 'users', profile.uid, 'notifications'),
            where('read', '==', false),
            limit(10)
          )
        : null,
    [profile?.uid]
  );
  const isPolitician = profile?.role === 'official' || profile?.role === 'candidate';
  const badge = unread.length === 0 ? undefined : unread.length > 9 ? '9+' : unread.length;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        // Android resizes the window for the keyboard; without this the tab
        // bar rides up and sits on top of it. No effect on iOS.
        tabBarHideOnKeyboard: true,
        // Five labels (six for politicians) share the width, and
        // "notifications" is the long one:
        // on a 320pt phone, or with large system text, it was cut to
        // "notificati...". Labels stay at their designed size (tab bars do
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
      <Tabs.Screen
        name="election"
        options={{
          title: t('election'),
          tabBarIcon: ({ color, size }) => <Ionicons name="ribbon" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('notifications'),
          tabBarBadge: badge,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
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
