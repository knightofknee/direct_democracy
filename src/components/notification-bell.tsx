import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, limit, query, where } from 'firebase/firestore';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';

/**
 * The bell at the top of every tab, beside the help "?" (2026-10-07):
 * opens the notifications, with the unread count on it. Notifications were
 * a tab until the news tab needed the room. Capped at 10 reads; past 9 the
 * badge says "9+".
 */
export function NotificationBell() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const { data: unread } = useLiveQuery<{ id: string }>(
    () =>
      profile
        ? query(collection(db, 'users', profile.uid, 'notifications'), where('read', '==', false), limit(10))
        : null,
    [profile?.uid]
  );
  const count = unread.length;
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? t('Notifications, {n} unread').replace('{n}', count > 9 ? '9+' : String(count)) : t('Notifications')
      }>
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={23} color={theme.primary} />
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.background }]}>
          <ThemedText style={styles.badgeText} allowFontScaling={false}>
            {count > 9 ? '9+' : count}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
});
