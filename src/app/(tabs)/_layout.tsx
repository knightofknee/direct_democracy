import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { collection, limit, query, where } from 'firebase/firestore';
import React from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';

export default function TabsLayout() {
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
  const badge = unread.length === 0 ? undefined : unread.length > 9 ? '9+' : unread.length;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        // Android resizes the window for the keyboard; without this the tab
        // bar rides up and sits on top of it. No effect on iOS.
        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('big board'),
          tabBarIcon: ({ color, size }) => <Ionicons name="podium" size={size} color={color} />,
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
