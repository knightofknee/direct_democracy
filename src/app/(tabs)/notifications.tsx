import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { collection, orderBy, query } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FlagAccent } from '@/components/flag-accent';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import type { AppNotification } from '@/lib/types';
import { markAllNotificationsRead, markNotificationRead } from '@/services/notifications';

/**
 * The inbox: answers to your questions, replies to your comments, writing
 * credits - and for officials and candidates, the questions and comments
 * waiting on them. Things to respond to and people responding to you; vote
 * outcomes (community verdicts) deliberately don't notify. The 'verdict'
 * type still renders for notification docs from before that change.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const { data: notifications, loading } = useLiveQuery<AppNotification>(
    () =>
      profile
        ? query(
            collection(db, 'users', profile.uid, 'notifications'),
            orderBy('createdAt', 'desc')
          )
        : null,
    [profile?.uid]
  );
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            notifications
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Answers, replies, and credits, as they land.
        </ThemedText>
        <FlagAccent />
      </View>

      {authLoading ? (
        <SkeletonCards />
      ) : !profile ? (
        <>
          <EmptyState
            icon="notifications-outline"
            message="Sign in and this is where responses to your questions and comments arrive."
          />
          <Button title="Sign in" onPress={() => router.push('/sign-in')} />
        </>
      ) : loading ? (
        <SkeletonCards />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          message="Nothing yet. Ask a question or join an argument and the responses land here."
        />
      ) : (
        <>
          {unread > 0 && (
            <Button
              title={`Mark all ${unread} read`}
              variant="ghost"
              onPress={() =>
                markAllNotificationsRead(profile.uid, notifications).catch((e) =>
                  notifyError('Could not update', e)
                )
              }
            />
          )}
          {notifications.map((note, i) => (
            <Animated.View
              key={note.id}
              entering={FadeInDown.duration(240).delay(Math.min(i, 10) * 25)}>
              <NotificationRow
                note={note}
                onPress={() => {
                  // Optimistic: navigate immediately, settle the flag behind it.
                  if (!note.read) {
                    markNotificationRead(profile.uid, note.id).catch(() => {});
                  }
                  router.push(note.link as Href);
                }}
              />
            </Animated.View>
          ))}
        </>
      )}
    </Screen>
  );
}

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  deadline: 'calendar',
  question: 'help-circle',
  response: 'chatbox-ellipses',
  verdict: 'ribbon',
  comment: 'chatbubbles',
  credit: 'create',
};

function NotificationRow({ note, onPress }: { note: AppNotification; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} style={note.read ? { opacity: 0.75 } : undefined}>
      <View style={styles.row}>
        <Ionicons
          name={TYPE_ICONS[note.type] ?? 'notifications'}
          size={20}
          color={note.read ? theme.textSecondary : theme.primary}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type={note.read ? 'small' : 'smallBold'} style={{ fontSize: 14 }}>
            {note.title}
          </ThemedText>
          {note.body ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {note.body}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
            {timeAgo(note.createdAt)}
          </ThemedText>
        </View>
        {!note.read && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});
