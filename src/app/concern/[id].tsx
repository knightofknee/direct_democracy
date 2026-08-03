import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ContentActions } from '@/components/content-actions';
import { LensToggle } from '@/components/lens-toggle';
import { Screen } from '@/components/screen';
import { TallyResults } from '@/components/tally-results';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { notify, notifyError } from '@/lib/notify';
import { timeAgo } from '@/lib/format';
import {
  CONCERN_PRIORITIES,
  type Comment,
  type Concern,
  type ConcernPriority,
  type TallyLens,
  type VoteDoc,
} from '@/lib/types';
import {
  addComment,
  deleteComment,
  deleteConcern,
  updateConcern,
  voteConcernPriority,
} from '@/services/concerns';

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
  const { isBlocked } = useBlocks();
  const [editing, setEditing] = useState<{ title: string; body: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  if (!concern) {
    return (
      <Screen>
        {loading ? null : <EmptyState icon="alert-circle-outline" message="Concern not found." />}
      </Screen>
    );
  }

  const myPriority = (myVote?.value as ConcernPriority | undefined) ?? null;
  const isAuthor = profile?.uid === concern.authorUid;
  // Editing is only possible before anyone engages (rules enforce the same).
  const canEdit = isAuthor && concern.tallies.totalAll === 0 && concern.commentCount === 0;

  const saveEdit = async () => {
    if (!profile || !editing) return;
    if (editing.title.trim().length < 8) {
      notify('Almost there', 'Give your concern a title of at least 8 characters.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateConcern(profile, concern, editing);
      setEditing(null);
    } catch (e) {
      notifyError('Could not save', e);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeConcern = async () => {
    if (!profile) return;
    try {
      await deleteConcern(profile, concern);
      notify('Concern withdrawn', 'Your concern and its votes were removed.');
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      notifyError('Could not delete', e);
    }
  };

  const castVote = async (priority: ConcernPriority) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    setSavingVote(true);
    try {
      await voteConcernPriority(profile, concern.id, priority);
    } catch (e) {
      notify('Vote failed', e instanceof Error ? e.message : 'Something went wrong.');
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
      notify('Comment failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={wardLabel(concern.wardId)} tone={concern.scope === 'city' ? 'primary' : 'neutral'} />
          {concern.authorVerified && <VerifiedBadge />}
          <View style={{ flex: 1 }} />
          <ContentActions
            contentPath={`concerns/${concern.id}`}
            contentType="concern"
            excerpt={concern.title}
            authorUid={concern.authorUid}
            authorName={concern.authorName}
          />
        </View>
        {editing ? (
          <>
            <Field label="Title" value={editing.title} onChangeText={(t) => setEditing({ ...editing, title: t })} />
            <Field
              label="What’s going on?"
              value={editing.body}
              onChangeText={(t) => setEditing({ ...editing, body: t })}
              multiline
              style={{ minHeight: 120 }}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} style={{ flex: 1 }} />
              <Button title="Save" onPress={saveEdit} loading={savingEdit} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
              {concern.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {concern.authorName} · {timeAgo(concern.createdAt)}
            </ThemedText>
            <ThemedText>{concern.body}</ThemedText>
          </>
        )}
        {isAuthor && !editing && (
          <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
            {canEdit && (
              <Button
                title="Edit"
                variant="secondary"
                onPress={() => setEditing({ title: concern.title, body: concern.body })}
              />
            )}
            {confirmDelete ? (
              <>
                <Button title="Yes, withdraw it" variant="danger" onPress={removeConcern} />
                <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
              </>
            ) : (
              <Button title="Withdraw concern" variant="ghost" onPress={() => setConfirmDelete(true)} />
            )}
          </View>
        )}
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
      {concern.scope === 'ward' && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          Anyone can vote here, but the verified counts include only verified residents of the{' '}
          {wardLabel(concern.wardId)}.
        </ThemedText>
      )}

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
        comments
          .filter((comment) => !isBlocked(comment.authorUid))
          .map((comment) => <CommentRow key={comment.id} concernId={concern.id} comment={comment} />)
      )}
    </Screen>
  );
}

function CommentRow({ concernId, comment }: { concernId: string; comment: Comment }) {
  const { profile } = useAuth();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isMine = profile?.uid === comment.authorUid;

  const remove = async () => {
    if (!profile) return;
    try {
      await deleteComment(profile, concernId, comment);
    } catch (e) {
      notifyError('Could not delete comment', e);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
        <ThemedText type="smallBold">{comment.authorName}</ThemedText>
        {comment.authorVerified && <VerifiedBadge compact />}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {timeAgo(comment.createdAt)}
        </ThemedText>
        <View style={{ flex: 1 }} />
        <ContentActions
          contentPath={`concerns/${concernId}/comments/${comment.id}`}
          contentType="comment"
          excerpt={comment.body}
          authorUid={comment.authorUid}
          authorName={comment.authorName}
        />
      </View>
      <ThemedText type="small">{comment.body}</ThemedText>
      {isMine &&
        (confirmRemove ? (
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button title="Yes, remove" variant="danger" onPress={remove} />
            <Button title="Keep" variant="ghost" onPress={() => setConfirmRemove(false)} />
          </View>
        ) : (
          <Button title="Remove my comment" variant="ghost" onPress={() => setConfirmRemove(true)} />
        ))}
    </Card>
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
