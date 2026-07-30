import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { LensToggle } from '@/components/lens-toggle';
import { Screen } from '@/components/screen';
import { TallyResults } from '@/components/tally-results';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import {
  CONCERN_PRIORITIES,
  type Comment,
  type Concern,
  type ConcernPriority,
  type TallyLens,
  type VoteDoc,
} from '@/lib/types';
import { addComment, voteConcernPriority } from '@/services/concerns';

const PRIORITY_LABELS: Record<ConcernPriority, string> = {
  critical: '🔥 Critical',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

const PRIORITY_OPTIONS = CONCERN_PRIORITIES.map((key) => ({ key, label: PRIORITY_LABELS[key] }));

export default function ConcernScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [lens, setLens] = useState<TallyLens>('all');
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [savingVote, setSavingVote] = useState(false);

  const { data: concern, loading } = useLiveDoc<Concern>(
    () => (id ? doc(db, 'concerns', id) : null),
    [id]
  );
  const { data: myVote } = useLiveDoc<VoteDoc & { id: string }>(
    () => (id && profile ? doc(db, 'concerns', id, 'votes', profile.uid) : null),
    [id, profile?.uid]
  );
  const { data: comments } = useLiveQuery<Comment>(
    () => (id ? query(collection(db, 'concerns', id, 'comments'), orderBy('createdAt', 'desc')) : null),
    [id]
  );

  if (!concern) {
    return (
      <Screen>
        {loading ? null : <EmptyState icon="alert-circle-outline" message="Concern not found." />}
      </Screen>
    );
  }

  const myPriority = (myVote?.value as ConcernPriority | undefined) ?? null;

  const castVote = async (priority: ConcernPriority) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    setSavingVote(true);
    try {
      await voteConcernPriority(profile, concern.id, priority);
    } catch (e) {
      Alert.alert('Vote failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSavingVote(false);
    }
  };

  const submitComment = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    const body = commentText.trim();
    if (!body) return;
    setSavingComment(true);
    try {
      await addComment(profile, concern.id, body);
      setCommentText('');
    } catch (e) {
      Alert.alert('Comment failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
          <Chip label={wardLabel(concern.wardId)} tone={concern.scope === 'city' ? 'primary' : 'neutral'} />
          {concern.authorVerified && <VerifiedBadge />}
        </View>
        <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
          {concern.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {concern.authorName} · {timeAgo(concern.createdAt)}
        </ThemedText>
        <ThemedText>{concern.body}</ThemedText>
      </View>

      <SectionHeader title="How much does this matter?" subtitle="Your vote sets this concern’s rank on the board" />
      <View style={styles.priorityRow}>
        {PRIORITY_OPTIONS.map((option) => {
          const selected = myPriority === option.key;
          return (
            <Pressable
              key={option.key}
              disabled={savingVote}
              onPress={() => castVote(option.key)}
              style={[
                styles.priorityButton,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                },
              ]}>
              <ThemedText
                type="small"
                style={selected ? { color: theme.primary, fontWeight: '700' } : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Results" />
      <LensToggle value={lens} onChange={setLens} />
      <TallyResults
        tally={concern.tallies}
        options={PRIORITY_OPTIONS}
        lens={lens}
        highlightKeys={myPriority ? [myPriority] : undefined}
      />

      <SectionHeader title={`Comments (${concern.commentCount})`} />
      {profile ? (
        <Card>
          <Field
            placeholder="Add to the discussion…"
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <Button
            title="Post comment"
            onPress={submitComment}
            disabled={!commentText.trim()}
            loading={savingComment}
          />
        </Card>
      ) : (
        <Button title="Sign in to comment" variant="secondary" onPress={() => router.push('/sign-in')} />
      )}

      {comments.length === 0 ? (
        <EmptyState icon="chatbubble-ellipses-outline" message="No comments yet." />
      ) : (
        comments.map((comment) => (
          <Card key={comment.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
              <ThemedText type="smallBold">{comment.authorName}</ThemedText>
              {comment.authorVerified && <VerifiedBadge compact />}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {timeAgo(comment.createdAt)}
              </ThemedText>
            </View>
            <ThemedText type="small">{comment.body}</ThemedText>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  priorityButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
});
