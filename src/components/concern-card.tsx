import { Ionicons } from '@expo/vector-icons';
import { doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { plural, timeAgo } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import type { Concern, ConcernPriority, TallyLens, VoteDoc } from '@/lib/types';
import { voteConcernPriority } from '@/services/concerns';

const QUICK_PRIORITIES: { key: ConcernPriority; label: string }[] = [
  { key: 'critical', label: '🔥 Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Med' },
  { key: 'low', label: 'Low' },
];

export function ConcernCard({
  concern,
  rank,
  lens,
  index = 0,
}: {
  concern: Concern;
  rank?: number;
  lens: TallyLens;
  /** Position in the list - staggers the entrance animation. */
  index?: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [voting, setVoting] = useState(false);

  const { data: myVote } = useLiveDoc<VoteDoc & { id: string }>(
    () => (profile ? doc(db, 'concerns', concern.id, 'votes', profile.uid) : null),
    [concern.id, profile?.uid]
  );
  const myPriority = (myVote?.value as ConcernPriority | undefined) ?? null;

  const score = lens === 'verified' ? concern.scoreVerified : concern.score;
  const voters = lens === 'verified' ? concern.tallies.totalVerified : concern.tallies.totalAll;

  const quickVote = async (priority: ConcernPriority) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    if (myPriority === priority) return;
    setVoting(true);
    try {
      await voteConcernPriority(profile, concern.id, priority);
    } catch (e) {
      notifyError('Vote failed', e);
    } finally {
      setVoting(false);
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index, 8) * 45)}>
      <Card onPress={() => router.push(`/concern/${concern.id}`)}>
        <View style={styles.topRow}>
          {rank != null && (
            <ThemedText
              type="subtitle"
              style={{ fontSize: 22, lineHeight: 28, color: theme.primary, width: 34 }}>
              {rank}
            </ThemedText>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText type="smallBold" style={{ fontSize: 16, lineHeight: 22 }}>
              {concern.title}
            </ThemedText>
            <View style={styles.metaRow}>
              <Chip label={wardLabel(concern.wardId)} tone={concern.scope === 'city' ? 'primary' : 'neutral'} />
              {concern.authorVerified && <VerifiedBadge compact />}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {concern.authorName} · {timeAgo(concern.createdAt)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="flame" size={14} color={theme.accent} />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {score} · {plural(voters, 'vote')}
            </ThemedText>
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {concern.commentCount}
            </ThemedText>
          </View>
        </View>

        {/* One-tap priority voting right from the board. */}
        <View style={styles.quickRow}>
          {QUICK_PRIORITIES.map((p) => {
            const selected = myPriority === p.key;
            return (
              <Pressable
                key={p.key}
                disabled={voting}
                onPress={() => quickVote(p.key)}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.quickPill,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.backgroundSelected : theme.background,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{
                    fontSize: 12,
                    lineHeight: 16,
                    color: selected ? theme.primary : theme.textSecondary,
                    fontWeight: selected ? '700' : '500',
                  }}>
                  {p.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  quickPill: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
});
