import { Ionicons } from '@expo/vector-icons';
import { doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useCelebration } from '@/components/celebration';
import { ThemedText } from '@/components/themed-text';
import { Card, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { plural, timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { notifyError } from '@/lib/notify';
import { useOptimistic } from '@/lib/optimistic';
import { PRIORITY_WEIGHTS } from '@/lib/tally';
import { type Concern, type ConcernPriority, type TallyLens, type VoteDoc } from '@/lib/types';
import { tapHaptic } from '@/lib/haptics';
import { PriorityScale } from '@/components/priority-scale';
import { voteConcernPriority, retractConcernVote } from '@/services/concerns';
import { enter } from '@/lib/motion';


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
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();
  const { anticipate } = useCelebration();

  const { data: myVote, loading: myVoteLoading } = useLiveDoc<VoteDoc & { id: string }>(
    () => (profile ? doc(db, 'concerns', concern.id, 'votes', profile.uid) : null),
    [concern.id, profile?.uid]
  );
  const myPriority = (myVote?.value as ConcernPriority | undefined) ?? null;

  // Assume success: the score and vote count bump the instant they tap,
  // handed back to the server numbers when the tally trigger lands.
  const stats = useOptimistic({
    score: concern.score,
    scoreVerified: concern.scoreVerified,
    totalAll: concern.tallies.totalAll,
    totalVerified: concern.tallies.totalVerified,
  });
  const score = lens === 'verified' ? stats.value.scoreVerified : stats.value.score;
  const voters = lens === 'verified' ? stats.value.totalVerified : stats.value.totalAll;

  const quickVote = (priority: ConcernPriority) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    // Tapping your own priority again takes the vote back.
    const retract = myPriority === priority;
    tapHaptic();
    // Celebrate a first vote at the tap, not after the stats trigger lands.
    // An account whose server count is still zero has certainly never voted,
    // so it doesn't wait on this card's vote doc either (takeAnticipated-
    // Milestone never fires the same milestone twice).
    if (!retract && ((!myVoteLoading && myVote == null) || (profile.stats?.votes ?? 0) === 0)) anticipate('votes');
    // Mirror of the trigger's areaSlicesOf: the verified slice of a ward
    // concern counts only verified residents of that ward.
    const countsVerified =
      !!profile.verified && (concern.scope !== 'ward' || profile.wardId === concern.wardId);
    const weightDelta =
      (retract ? 0 : (PRIORITY_WEIGHTS[priority] ?? 0)) - (myPriority ? (PRIORITY_WEIGHTS[myPriority] ?? 0) : 0);
    const voterDelta = retract ? -1 : myPriority == null ? 1 : 0;
    // From the numbers on screen: my vote doc updates locally at once, so a
    // second quick tap is measured against the first one's prediction.
    const shown = stats.value;
    stats.predict({
      score: shown.score + weightDelta,
      scoreVerified: shown.scoreVerified + (countsVerified ? weightDelta : 0),
      totalAll: Math.max(0, shown.totalAll + voterDelta),
      totalVerified: Math.max(0, shown.totalVerified + (countsVerified ? voterDelta : 0)),
    });
    (retract ? retractConcernVote(profile, concern.id) : voteConcernPriority(profile, concern.id, priority)).catch((e) => {
      stats.rollback();
      notifyError(t('Vote failed'), e);
    });
  };

  return (
    <Animated.View entering={enter(FadeInDown.duration(280).delay(Math.min(index, 8) * 45))}>
      <Card onPress={() => router.push(`/concern/${concern.id}`)} style={styles.card}>
        {/* One left edge for every line: the rank rides in the byline as a
            small tag instead of a wide number column the rest of the card
            has to line up around. */}
        <ConcernByline concern={concern} rank={rank} />
        <ThemedText type="smallBold" style={styles.title}>
          {concern.title}
        </ThemedText>
        <ConcernStats score={score} voters={voters} comments={concern.commentCount} createdAt={concern.createdAt} />

        {/* One-tap priority voting right from the board. */}
        <PriorityScale compact value={myPriority} onSelect={quickVote} />
      </Card>
    </Animated.View>
  );
}

/**
 * Rank tag and who raised it, as one line of small print. No ward label:
 * every list of these cards is one ward's or all citywide, so it would say
 * the same thing on every card (the concern's own page names it). The time
 * sits at the end of the stats row so this line stays short.
 */
function ConcernByline({ concern, rank }: { concern: Concern; rank?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.byline}>
      {rank != null && (
        <View style={[styles.rank, { backgroundColor: theme.primarySoft }]}>
          <ThemedText type="smallBold" style={{ fontSize: 12, lineHeight: 16, color: theme.primary }}>
            {`#${rank}`}
          </ThemedText>
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.bylineText}>
        {concern.authorName}
      </ThemedText>
      {concern.authorVerified && <VerifiedBadge compact />}
    </View>
  );
}

function ConcernStats({
  score,
  voters,
  comments,
  createdAt,
}: {
  score: number;
  voters: number;
  comments: number;
  createdAt: Concern['createdAt'];
}) {
  const theme = useTheme();
  return (
    <View style={styles.statsRow}>
      <View style={styles.stat}>
        <Ionicons name="flame" size={14} color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.bylineText}>
          {score} · {plural(voters, 'vote')}
        </ThemedText>
      </View>
      <View style={styles.stat}>
        <Ionicons name="chatbubble-outline" size={13} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.bylineText}>
          {comments}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={[styles.bylineText, { marginLeft: 'auto' }]}>
        {timeAgo(createdAt)}
      </ThemedText>
    </View>
  );
}

/**
 * A concern in the command center's issue list: read-only, in rank order,
 * no voting. The ones the official has already commented on fold down to
 * the byline and title (still a tap away); the rest show their opening
 * lines so the official can triage without opening each.
 */
export function IssueRow({
  concern,
  rank,
  commented,
}: {
  concern: Concern;
  rank: number;
  commented: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  if (commented) {
    return (
      <Card
        onPress={() => router.push(`/concern/${concern.id}`)}
        style={[styles.folded, { backgroundColor: theme.background }]}>
        <View style={styles.byline}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bylineText}>
            {`#${rank}`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bylineText}>
            {'· '}
            {concern.authorName}
          </ThemedText>
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle" size={13} color={theme.verified} />
            <ThemedText type="small" style={[styles.bylineText, { color: theme.verified }]}>
              {t('You commented')}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" style={{ fontSize: 14, lineHeight: 20 }}>
          {concern.title}
        </ThemedText>
      </Card>
    );
  }
  return (
    <Card onPress={() => router.push(`/concern/${concern.id}`)} style={styles.card}>
      <ConcernByline concern={concern} rank={rank} />
      <ThemedText type="smallBold" style={styles.title}>
        {concern.title}
      </ThemedText>
      {concern.body ? (
        // A teaser: the whole concern is one tap away.
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={3} style={{ fontSize: 14, lineHeight: 20 }}>
          {concern.body}
        </ThemedText>
      ) : null}
      <ConcernStats
        score={concern.scoreVerified}
        voters={concern.tallies.totalVerified}
        comments={concern.commentCount}
        createdAt={concern.createdAt}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  folded: {
    gap: 4,
    paddingVertical: Spacing.two,
  },
  title: {
    fontSize: 17,
    lineHeight: 23,
  },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 2,
  },
  bylineText: {
    fontSize: 12,
    lineHeight: 16,
  },
  rank: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
