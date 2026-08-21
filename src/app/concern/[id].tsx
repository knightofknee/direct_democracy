import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CommentsSection } from '@/components/comments';
import { ContentActions } from '@/components/content-actions';
import { Screen } from '@/components/screen';
import { TallyResults } from '@/components/tally-results';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { confirmDestructive, notify, notifyError } from '@/lib/notify';
import { timeAgo } from '@/lib/format';
import {
  CONCERN_PRIORITIES,
  type Comment,
  type Concern,
  type ConcernPriority,
  type VoteDoc,
} from '@/lib/types';
import {
  addComment,
  deleteComment,
  deleteConcern,
  updateConcern,
  voteConcernPriority,
  voteOnComment,
} from '@/services/concerns';

const PRIORITY_OPTIONS = CONCERN_PRIORITIES.map((key) => ({ key, label: key }));

export default function ConcernScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
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
    if (editing.title.trim().length < 4) {
      notify('Almost there', 'Give your concern a title of at least 4 characters.');
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
    // Third gate on top of the inline two-step: a system alert, so a stray
    // double-tap can never withdraw a concern.
    const sure = await confirmDestructive(
      'Withdraw this concern?',
      'This permanently removes the concern, everyone’s votes on it, and its comments. It cannot be undone.',
      'Withdraw forever'
    );
    if (!sure) return;
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
                <Button title="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
              </>
            ) : (
              <Button title="Withdraw concern" variant="secondary" onPress={() => setConfirmDelete(true)} />
            )}
          </View>
        )}
      </View>

      <SectionHeader title="How much does this matter?" />
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
                type="smallBold"
                style={selected ? { color: theme.primary } : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Results" />
      <TallyResults
        tally={concern.tallies}
        options={PRIORITY_OPTIONS}
        highlightKeys={myPriority ? [myPriority] : undefined}
      />

      <SectionHeader title={`Comments (${concern.commentCount})`} />
      <CommentsSection
        comments={comments}
        contentPathFor={(comment) => `concerns/${concern.id}/comments/${comment.id}`}
        onSubmit={(body, reply) => addComment(profile!, concern.id, body, reply)}
        onDelete={(comment) => deleteComment(profile!, concern.id, comment)}
        onVote={(comment, value) => voteOnComment(profile!, concern.id, comment.id, value)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  priorityRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  priorityButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
});
