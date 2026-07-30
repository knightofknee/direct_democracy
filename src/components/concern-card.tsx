import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';
import type { Concern, TallyLens } from '@/lib/types';

export function ConcernCard({
  concern,
  rank,
  lens,
}: {
  concern: Concern;
  rank?: number;
  lens: TallyLens;
}) {
  const theme = useTheme();
  const router = useRouter();
  const score = lens === 'verified' ? concern.scoreVerified : concern.score;
  const voters =
    lens === 'verified' ? concern.tallies.totalVerified
    : lens === 'registered' ? concern.tallies.totalRegistered
    : concern.tallies.totalAll;

  return (
    <Card onPress={() => router.push(`/concern/${concern.id}`)}>
      <View style={styles.topRow}>
        {rank != null && (
          <ThemedText type="subtitle" style={{ fontSize: 22, lineHeight: 28, color: theme.primary, width: 34 }}>
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
            {score} priority pts · {voters} voters
          </ThemedText>
        </View>
        <View style={styles.stat}>
          <Ionicons name="chatbubble-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {concern.commentCount}
          </ThemedText>
        </View>
      </View>
    </Card>
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
});
