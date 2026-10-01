import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ShareButton } from '@/components/share-button';
import { HeaderActions } from '@/components/help-button';
import { useCelebration } from '@/components/celebration';
import { ElectionAnswerComposer } from '@/components/election-answer-composer';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { plural, timeAgo } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import { notify, notifyError } from '@/lib/notify';
import type { CommentVoteValue, ElectionAnswer, ElectionQuestion } from '@/lib/types';
import { ContentActions } from '@/components/content-actions';
import { EditHistory } from '@/components/edit-history';
import { ElectionQuestionJoin } from '@/components/upvote-pill';
import { editPost } from '@/services/posts';
import {
  deleteElectionQuestion,
  voteElectionAnswer,
} from '@/services/election';

/** Bodies longer than this start collapsed behind a "read the rest" toggle. */
const COLLAPSE_OVER = 280;

/**
 * One election-AMA question and every candidate's answer to it, side by
 * side. Answers are ordered by their hidden up/down score (placement only,
 * never displayed); each shows its first lines so several can be compared
 * at a glance, expanding in place for the full text.
 */
export default function ElectionQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { isShadowbanned } = useBlocks();
  const t = useT();

  const { data: question, loading } = useLiveDoc<ElectionQuestion>(
    () => (id ? doc(db, 'electionQuestions', id) : null),
    [id]
  );
  const { data: answers } = useLiveQuery<ElectionAnswer>(
    () =>
      id ? query(collection(db, 'electionQuestions', id, 'answers'), orderBy('createdAt')) : null,
    [id]
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  usePageSummary('election-question/[id]', [
    question &&
      t('Asked by {name} {ago}.').replace('{name}', question.authorName).replace('{ago}', timeAgo(question.createdAt)),
    question &&
      (answers.length > 0
        ? t('Candidates who have answered: {n} ({names}).')
            .replace('{n}', String(answers.length))
            .replace('{names}', answers.map((a) => a.candidateName).join(', '))
        : t('No candidate has answered yet.')),
    question &&
      t('People who joined it: {n}, verified: {verified}.')
        .replace('{n}', String(question.upvotes ?? 0))
        .replace('{verified}', String(question.upvotesVerified ?? 0)),
    question && profile?.uid === question.authorUid && t('You asked this.'),
  ]);

  if (!question || isShadowbanned(question.authorUid)) {
    return (
      <Screen>
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="alert-circle-outline" message={t('Question not found.')} />
        )}
      </Screen>
    );
  }

  // Hidden scores drive placement only. Verified voters decide (same
  // principle as community verdicts); all-voters score breaks their ties so
  // the list still ranks before anyone verified has voted, then
  // first-answered. Keeps sybil accounts from reordering candidates.
  const ranked = [...answers].sort(
    (a, b) =>
      (b.scoreVerified ?? 0) - (a.scoreVerified ?? 0) ||
      (b.score ?? 0) - (a.score ?? 0) ||
      (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
  );

  const isAsker = profile?.uid === question.authorUid;
  // The asker may edit until a candidate answers (editPost records it).
  const saveEdit = async () => {
    if (editing == null) return;
    setSavingEdit(true);
    try {
      await editPost(`electionQuestions/${question.id}`, { body: editing });
      setEditing(null);
    } catch (e) {
      notifyError(t('Could not save'), e);
    } finally {
      setSavingEdit(false);
    }
  };

  const withdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      await deleteElectionQuestion(profile!, question);
      notify(t('Question withdrawn'), t('Your question was removed.'));
      if (router.canGoBack()) router.back();
      else router.replace('/election');
    } catch (e) {
      setWithdrawing(false);
      notifyError(t('Could not withdraw'), e);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderActions>
              <ShareButton path={`/election-question/${question.id}`} title={question.body} />
            </HeaderActions>
          ),
        }}
      />
      <View style={{ gap: Spacing.two }}>
        {editing != null ? (
          <View style={{ gap: Spacing.two }}>
            <Field value={editing} onChangeText={setEditing} multiline maxLength={1000} autoFocus />
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button title={t('Cancel')} variant="ghost" onPress={() => setEditing(null)} style={{ flex: 1 }} />
              <Button
                title={t('Save')}
                onPress={saveEdit}
                loading={savingEdit}
                disabled={editing.trim().length < 10 || editing.trim() === question.body}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <ThemedText type="subtitle" style={{ fontSize: 22, lineHeight: 28 }}>
            {question.body}
          </ThemedText>
        )}
        <EditHistory edits={question.edits} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Asked by {name}').replace('{name}', question.authorName)} · {timeAgo(question.createdAt)}
          </ThemedText>
          {question.authorVerified && <VerifiedBadge compact />}
          <View style={{ flex: 1 }} />
          <ElectionQuestionJoin question={question} />
          <ContentActions
            contentPath={`electionQuestions/${question.id}`}
            contentType="electionQuestion"
            excerpt={question.body}
            authorUid={question.authorUid}
            authorName={question.authorName}
          />
        </View>
        {isAsker && question.answerCount === 0 && editing == null && (
          // Two steps, like withdrawing a question to an official.
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            {confirmWithdraw ? (
              <>
                <Button title={t('Yes, withdraw')} variant="danger" onPress={withdraw} loading={withdrawing} />
                <Button title={t('Keep it')} variant="ghost" onPress={() => setConfirmWithdraw(false)} />
              </>
            ) : (
              <>
                <Button title={t('Edit')} variant="ghost" onPress={() => setEditing(question.body)} />
                <Button title={t('Withdraw question')} variant="ghost" onPress={() => setConfirmWithdraw(true)} />
              </>
            )}
          </View>
        )}
      </View>

      {profile?.role === 'candidate' && (
        <ElectionAnswerComposer profile={profile} questionId={question.id} />
      )}

      <SectionHeader
        title={plural(question.answerCount, 'answer')}
        subtitle={t("Every candidate's answer, side by side. Your votes set the order; no numbers are shown.")}
      />
      {ranked.length === 0 ? (
        <EmptyState
          icon="hourglass-outline"
          message={t('No candidate has answered yet. Answers appear here the moment they do.')}
        />
      ) : (
        ranked.map((answer) => (
          <AnswerCard key={answer.id} questionId={question.id} answer={answer} />
        ))
      )}
    </Screen>
  );
}

/** One candidate's answer: first lines at a glance, full text on expand. */
function AnswerCard({ questionId, answer }: { questionId: string; answer: ElectionAnswer }) {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const { anticipate } = useCelebration();
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const { data: myVote, loading: myVoteLoading } = useLiveDoc<{ value: CommentVoteValue }>(
    () =>
      profile
        ? doc(db, 'electionQuestions', questionId, 'answers', answer.id, 'votes', profile.uid)
        : null,
    [questionId, answer.id, profile?.uid]
  );

  const rate = async (value: CommentVoteValue) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    // "First" only once the vote doc has actually loaded - a null from a
    // still-loading doc would mark future milestones seen and skip them.
    const firstCast = (!myVoteLoading && myVote == null) || (profile.stats?.votes ?? 0) === 0;
    const next = myVote?.value === value ? null : value;
    tapHaptic();
    // Celebrate at the tap (assume success), not after the write returns.
    if (firstCast && next) anticipate('votes');
    try {
      await voteElectionAnswer(profile, questionId, answer.candidateUid, next);
    } catch (e) {
      notifyError(t('Could not record your vote'), e);
    }
  };

  const collapsible = answer.body.length > COLLAPSE_OVER;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Pressable
          onPress={() => router.push(`/candidate/${answer.candidateUid}`)}
          hitSlop={6}
          style={{ flex: 1 }}>
          <ThemedText type="smallBold" style={{ fontSize: 15, color: theme.primary }}>
            {answer.candidateName}
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {timeAgo(answer.createdAt)}
        </ThemedText>
      </View>

      <ThemedText numberOfLines={expanded || !collapsible ? undefined : 4}>
        {answer.body}
      </ThemedText>

      <View style={styles.footerRow}>
        {collapsible ? (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
              {expanded ? t('Show less') : t('Read the rest')}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.voteRow}>
          <RateButton
            icon="arrow-up"
            active={myVote?.value === 'up'}
            label={t('This answers it')}
            onPress={() => rate('up')}
          />
          <RateButton
            icon="arrow-down"
            active={myVote?.value === 'down'}
            label={t('This dodges it')}
            onPress={() => rate('down')}
          />
        </View>
      </View>
    </Card>
  );
}

function RateButton({
  icon,
  active,
  label,
  onPress,
}: {
  icon: 'arrow-up' | 'arrow-down';
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.rateButton,
        {
          backgroundColor: active ? theme.primarySoft : theme.backgroundElement,
          borderColor: active ? theme.primary : theme.border,
        },
      ]}>
      <Ionicons name={icon} size={16} color={active ? theme.primary : theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voteRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rateButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
