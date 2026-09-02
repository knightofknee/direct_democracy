import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCelebration } from '@/components/celebration';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { plural, timeAgo } from '@/lib/format';
import { notify, notifyError } from '@/lib/notify';
import type { CommentVoteValue, ElectionAnswer, ElectionQuestion, UserProfile } from '@/lib/types';
import {
  answerElectionQuestion,
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

  const { data: question, loading } = useLiveDoc<ElectionQuestion>(
    () => (id ? doc(db, 'electionQuestions', id) : null),
    [id]
  );
  const { data: answers } = useLiveQuery<ElectionAnswer>(
    () =>
      id ? query(collection(db, 'electionQuestions', id, 'answers'), orderBy('createdAt')) : null,
    [id]
  );

  if (!question) {
    return (
      <Screen>
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="alert-circle-outline" message="Question not found." />
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

  const withdraw = async () => {
    try {
      await deleteElectionQuestion(profile!, question);
      notify('Question withdrawn', 'Your question was removed.');
      if (router.canGoBack()) router.back();
      else router.replace('/election');
    } catch (e) {
      notifyError('Could not withdraw', e);
    }
  };

  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <ThemedText type="subtitle" style={{ fontSize: 22, lineHeight: 28 }}>
          {question.body}
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            Asked by {question.authorName} · {timeAgo(question.createdAt)}
          </ThemedText>
          {question.authorVerified && <VerifiedBadge compact />}
        </View>
        {isAsker && question.answerCount === 0 && (
          <View style={{ flexDirection: 'row' }}>
            <Button title="Withdraw question" variant="ghost" onPress={withdraw} />
          </View>
        )}
      </View>

      {profile?.role === 'candidate' && (
        <AnswerComposer profile={profile} questionId={question.id} />
      )}

      <SectionHeader
        title={plural(question.answerCount, 'answer')}
        subtitle="Every candidate's answer, side by side. Your votes set the order; no numbers are shown."
      />
      {ranked.length === 0 ? (
        <EmptyState
          icon="hourglass-outline"
          message="No candidate has answered yet. Answers appear here the moment they do."
        />
      ) : (
        ranked.map((answer) => (
          <AnswerCard key={answer.id} questionId={question.id} answer={answer} />
        ))
      )}
    </Screen>
  );
}

/** The candidate's one answer: post it once, revise it any time. */
function AnswerComposer({ profile, questionId }: { profile: UserProfile; questionId: string }) {
  const { data: mine } = useLiveDoc<ElectionAnswer>(
    () => doc(db, 'electionQuestions', questionId, 'answers', profile.uid),
    [questionId, profile.uid]
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const text = draft ?? mine?.body ?? '';

  const save = async () => {
    setSaving(true);
    try {
      await answerElectionQuestion(profile, questionId, text, mine != null);
      setDraft(null);
      notify(mine ? 'Answer updated' : 'Answer posted', 'Voters see every answer side by side.');
    } catch (e) {
      notifyError('Could not save your answer', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        {mine ? 'Your answer (one per candidate - edits replace it)' : 'Your answer'}
      </ThemedText>
      <Field
        placeholder="Answer the city yourself, on the record…"
        value={text}
        onChangeText={setDraft}
        multiline
        maxLength={4000}
      />
      <Button
        title={mine ? 'Update answer' : 'Post answer'}
        onPress={save}
        loading={saving}
        disabled={!text.trim() || (mine != null && text.trim() === mine.body)}
      />
      {mine && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          Answers are part of the public record; revise the text, but it cannot be taken down.
        </ThemedText>
      )}
    </Card>
  );
}

/** One candidate's answer: first lines at a glance, full text on expand. */
function AnswerCard({ questionId, answer }: { questionId: string; answer: ElectionAnswer }) {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const { anticipate } = useCelebration();
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
    const firstCast = !myVoteLoading && myVote == null;
    const next = myVote?.value === value ? null : value;
    try {
      await voteElectionAnswer(profile, questionId, answer.candidateUid, next);
      if (firstCast && next) anticipate('votes');
    } catch (e) {
      notifyError('Could not record your vote', e);
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
              {expanded ? 'Show less' : 'Read the rest'}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.voteRow}>
          <RateButton
            icon="arrow-up"
            active={myVote?.value === 'up'}
            label="This answers it"
            onPress={() => rate('up')}
          />
          <RateButton
            icon="arrow-down"
            active={myVote?.value === 'down'}
            label="This dodges it"
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
