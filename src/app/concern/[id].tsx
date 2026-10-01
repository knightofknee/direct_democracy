import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PriorityScale } from '@/components/priority-scale';
import { ShareButton } from '@/components/share-button';
import { HeaderActions } from '@/components/help-button';
import { useCelebration } from '@/components/celebration';
import { CommentsSection } from '@/components/comments';
import { ContentActions } from '@/components/content-actions';
import { EditHistory } from '@/components/edit-history';
import { ReferenceEditor, ReferenceList, ReferencedBody } from '@/components/references';
import { Screen } from '@/components/screen';
import { TallyResults } from '@/components/tally-results';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { confirmDestructive, errorMessage, notify, notifyError } from '@/lib/notify';
import { withBallotDelta, type BallotDelta } from '@/lib/tally';
import { pct, timeAgo } from '@/lib/format';
import { usePageSummary } from '@/lib/page-help';
import { openLink } from '@/lib/open-link';
import { editPost } from '@/services/posts';
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
  voteConcernPriority,
  retractConcernVote,
  voteOnComment,
} from '@/services/concerns';

const PRIORITY_OPTIONS = CONCERN_PRIORITIES.map((key) => ({ key, label: key }));

export default function ConcernScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { isShadowbanned } = useBlocks();
  const { anticipate } = useCelebration();
  const t = useT();
  const [optimistic, setOptimistic] = useState<{
    delta: BallotDelta;
    /** The server tally at cast time - any change to it means the trigger landed. */
    baseline: string;
  } | null>(null);

  const { data: concern, loading } = useLiveDoc<Concern>(
    () => (id ? doc(db, 'concerns', id) : null),
    [id]
  );
  const { data: myVote, loading: myVoteLoading } = useLiveDoc<VoteDoc & { id: string }>(
    () => (id && profile ? doc(db, 'concerns', id, 'votes', profile.uid) : null),
    [id, profile?.uid]
  );
  const { data: comments } = useLiveQuery<Comment>(
    () => (id ? query(collection(db, 'concerns', id, 'comments'), orderBy('createdAt', 'desc')) : null),
    [id]
  );
  const [editing, setEditing] = useState<{
    title: string;
    body: string;
    references: string[];
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // The moment the server tally moves (almost always our own trigger
  // landing), the optimistic overlay hands back to the real numbers.
  const talliesJson = concern ? JSON.stringify(concern.tallies) : null;
  useEffect(() => {
    if (optimistic && talliesJson && talliesJson !== optimistic.baseline) {
      setOptimistic(null);
    }
  }, [talliesJson, optimistic]);

  // The help sheet's summary of this concern as it stands.
  const urgentShare = (counts: Record<string, number>, total: number) =>
    pct((counts['4'] ?? 0) + (counts['5'] ?? 0), total);
  const tallied = concern?.tallies;
  const myRecorded = (myVote?.value as string | undefined) ?? null;
  usePageSummary(
    'concern/[id]',
    concern
      ? [
          t('{place}, posted by {name} {ago}.')
            .replace('{place}', wardLabel(concern.wardId))
            .replace('{name}', concern.authorName)
            .replace('{ago}', timeAgo(concern.createdAt)),
          tallied && tallied.totalAll > 0
            ? t('Votes: {all} from all users, {verified} verified.')
                .replace('{all}', String(tallied.totalAll))
                .replace('{verified}', String(tallied.totalVerified))
            : t('No one has voted on it yet.'),
          tallied && tallied.totalAll > 0 && tallied.totalVerified > 0
            ? t('Rated 4 or 5: {all}% of all votes, {verified}% of verified votes.')
                .replace('{all}', String(urgentShare(tallied.all, tallied.totalAll)))
                .replace('{verified}', String(urgentShare(tallied.verified, tallied.totalVerified)))
            : tallied && tallied.totalAll > 0
              ? t('Rated 4 or 5: {all}% of votes.').replace(
                  '{all}',
                  String(urgentShare(tallied.all, tallied.totalAll))
                )
              : null,
          profile && (myRecorded ? t('Your vote: {n}.').replace('{n}', myRecorded) : t('You haven’t voted on it.')),
          comments.length > 0
            ? t('Comments: {n}, newest {ago}.')
                .replace('{n}', String(comments.length))
                .replace('{ago}', timeAgo(comments[0].createdAt))
            : t('No comments yet.'),
          profile?.uid === concern.authorUid && t('You posted this.'),
        ]
      : []
  );

  // A shadowbanned author's concern reads as gone to everyone but them.
  if (!concern || isShadowbanned(concern.authorUid)) {
    return (
      <Screen>
        {loading ? null : <EmptyState icon="alert-circle-outline" message={t('Concern not found.')} />}
      </Screen>
    );
  }

  const recordedPriority = (myVote?.value as ConcernPriority | undefined) ?? null;
  // The overlayed choice wins while in flight so the tap highlights NOW.
  const myPriority = optimistic ? ((optimistic.delta.to as ConcernPriority | null) ?? null) : recordedPriority;
  const shownTallies = optimistic
    ? withBallotDelta(concern.tallies, optimistic.delta)
    : concern.tallies;
  const isAuthor = profile?.uid === concern.authorUid;
  // Authors edit any time; editPost keeps the history (and the earlier
  // text, once anyone has replied).
  const canEdit = isAuthor;

  const saveEdit = async () => {
    if (!profile || !editing) return;
    if (editing.title.trim().length < 4) {
      notify(t('Almost there'), t('Give your concern a title of at least 4 characters.'));
      return;
    }
    setSavingEdit(true);
    try {
      await editPost(`concerns/${concern.id}`, {
        title: editing.title,
        body: editing.body,
        references: editing.references,
      });
      setEditing(null);
    } catch (e) {
      notifyError(t('Could not save'), e);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeConcern = async () => {
    if (!profile) return;
    // Third gate on top of the inline two-step: a system alert, so a stray
    // double-tap can never withdraw a concern.
    const sure = await confirmDestructive(
      t('Withdraw this concern?'),
      t('This permanently removes the concern, everyone’s votes on it, and its comments. It cannot be undone.'),
      t('Withdraw forever')
    );
    if (!sure) return;
    try {
      await deleteConcern(profile, concern);
      notify(t('Concern withdrawn'), t('Your concern and its votes were removed.'));
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      notifyError(t('Could not delete'), e);
    }
  };

  // Optimistic feedback: a tap counts NOW - the tally overlay and milestone
  // fire before the server ack, because the round trip through the tally
  // trigger (worse on a cold start) is seconds, and feedback that slow reads
  // as a broken button. On failure we roll back and say so.
  const castVote = (priority: ConcernPriority) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    tapHaptic();
    // Tapping your own priority again takes the vote back.
    const to = myPriority === priority ? null : priority;
    // "First" only once the vote doc has actually loaded (see milestones.ts).
    // A server count of zero means certainly first, loaded or not.
    const firstCast = (!myVoteLoading && myVote == null) || (profile.stats?.votes ?? 0) === 0;
    if (to && firstCast) anticipate('votes');
    setOptimistic({
      delta: {
        // The ballot the SERVER tally holds. While an earlier tap is still in
        // flight that is the overlay's own starting ballot (the local cache
        // already shows the in-flight one, which the tally doesn't have yet).
        from: optimistic ? optimistic.delta.from : recordedPriority,
        to,
        // Mirror of the trigger's areaSlicesOf: the verified slice of a ward
        // concern counts only verified residents of that ward.
        verified:
          !!profile.verified && (concern.scope !== 'ward' || profile.wardId === concern.wardId),
      },
      baseline: JSON.stringify(concern.tallies),
    });
    (to ? voteConcernPriority(profile, concern.id, to) : retractConcernVote(profile, concern.id)).catch((e) => {
      setOptimistic(null);
      notify(t('Vote failed'), errorMessage(e));
    });
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderActions>
              <ShareButton path={`/concern/${concern.id}`} title={concern.title} />
            </HeaderActions>
          ),
        }}
      />
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
            <Field label={t('Title')} value={editing.title} onChangeText={(t) => setEditing({ ...editing, title: t })} />
            <Field
              label={t('What’s going on?')}
              value={editing.body}
              onChangeText={(t) => setEditing({ ...editing, body: t })}
              multiline
              style={{ minHeight: 120 }}
            />
            <ReferenceEditor
              references={editing.references}
              onChange={(references) => setEditing({ ...editing, references })}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button title={t('Cancel')} variant="ghost" onPress={() => setEditing(null)} style={{ flex: 1 }} />
              <Button title={t('Save')} onPress={saveEdit} loading={savingEdit} style={{ flex: 1 }} />
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
            <ReferencedBody body={concern.body} references={concern.references} />
            <ReferenceList references={concern.references} />
            <EditHistory edits={concern.edits} />
          </>
        )}
        {isAuthor && !editing && (
          <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
            {canEdit && (
              <Button
                title={t('Edit')}
                variant="secondary"
                onPress={() =>
                  setEditing({
                    title: concern.title,
                    body: concern.body,
                    references: concern.references ?? [],
                  })
                }
              />
            )}
            {confirmDelete ? (
              <>
                <Button title={t('Yes, withdraw it')} variant="danger" onPress={removeConcern} />
                <Button title={t('Keep it')} variant="secondary" onPress={() => setConfirmDelete(false)} />
              </>
            ) : (
              <Button title={t('Withdraw concern')} variant="secondary" onPress={() => setConfirmDelete(true)} />
            )}
          </View>
        )}
      </View>

      <SectionHeader title={t('How much does this matter?')} />
      <PriorityScale value={myPriority} onSelect={castVote} />

      <SectionHeader title={t('Results')} />
      <TallyResults
        tally={shownTallies}
        options={PRIORITY_OPTIONS}
        highlightKeys={myPriority ? [myPriority] : undefined}
      />

      <SectionHeader title={`${t('Comments')} (${concern.commentCount})`} />
      <CommentsSection
        comments={comments}
        contentPathFor={(comment) => `concerns/${concern.id}/comments/${comment.id}`}
        onSubmit={(body, reply, references) => addComment(profile!, concern.id, body, reply, references)}
        onDelete={(comment) => deleteComment(profile!, concern.id, comment)}
        onVote={(comment, value) => voteOnComment(profile!, concern.id, comment.id, value)}
      />

      {/* Ward issues are often city services too. One person raises it here;
          each neighbor who also files with 311 tells the city it's bigger
          than one report. 311 has its own app and portal, so just a quiet
          way out. */}
      {concern.scope === 'ward' && (
        <Pressable
          onPress={() => void openLink(CHI_311_URL)}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.link311}>
          <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Also a city service problem? Report it to 311')}
          </ThemedText>
          <Ionicons name="open-outline" size={12} color={theme.textSecondary} />
        </Pressable>
      )}
    </Screen>
  );
}

/** Chicago's 311 service request portal (it also has its own app). */
const CHI_311_URL = 'https://311.chicago.gov/';

const styles = StyleSheet.create({
  link311: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.three,
  },
});
