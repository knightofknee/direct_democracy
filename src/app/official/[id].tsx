import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { ANSWER_JUDGMENT_QUORUM, type AmaQuestion, type Official } from '@/lib/types';
import { askQuestion, computeScore, judgeResponse, respondToQuestion } from '@/services/ama';

export default function OfficialAmaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [questionText, setQuestionText] = useState('');
  const [asking, setAsking] = useState(false);

  const { data: official, loading } = useLiveDoc<Official>(
    () => (id ? doc(db, 'officials', id) : null),
    [id]
  );
  const { data: questions } = useLiveQuery<AmaQuestion>(
    () =>
      id ? query(collection(db, 'officials', id, 'questions'), orderBy('createdAt', 'desc')) : null,
    [id]
  );

  if (!official) {
    return (
      <Screen>
        {loading ? null : <EmptyState icon="alert-circle-outline" message="Official not found." />}
      </Screen>
    );
  }

  const score = computeScore(official);
  const isThisOfficial = profile?.uid === official.uid;

  const ask = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    const body = questionText.trim();
    if (body.length < 10) {
      Alert.alert('Almost there', 'Ask a question of at least 10 characters.');
      return;
    }
    setAsking(true);
    try {
      await askQuestion(profile, official.uid, body);
      setQuestionText('');
    } catch (e) {
      Alert.alert('Could not ask', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 24 }}>
          {official.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {official.title}
        </ThemedText>
        {official.bio ? <ThemedText type="small">{official.bio}</ThemedText> : null}
        <View style={styles.scoreRow}>
          <ScoreStat label="Answer score" value={score.score == null ? '—' : `${score.grade} · ${score.score}`} />
          <ScoreStat label="Answered" value={String(score.answered)} />
          <ScoreStat label="Dodged" value={String(score.dodged)} />
          <ScoreStat label="Ignored" value={String(score.ignored)} />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          The community — not the official — decides what counts as answered. Unanswered and dodged
          questions lower the score.
        </ThemedText>
      </Card>

      {!isThisOfficial && (
        <Card>
          <Field
            placeholder={`Ask ${official.name} anything…`}
            value={questionText}
            onChangeText={setQuestionText}
            multiline
          />
          <Button title="Ask" onPress={ask} disabled={!questionText.trim()} loading={asking} />
        </Card>
      )}

      <SectionHeader title={`Questions (${score.asked})`} />
      {questions.length === 0 ? (
        <EmptyState icon="help-circle-outline" message="No questions yet. Ask the first one." />
      ) : (
        questions.map((q) => <QuestionCard key={q.id} question={q} isThisOfficial={isThisOfficial} />)
      )}
    </Screen>
  );
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <ThemedText type="smallBold" style={{ fontSize: 16 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </ThemedText>
    </View>
  );
}

function QuestionCard({
  question,
  isThisOfficial,
}: {
  question: AmaQuestion;
  isThisOfficial: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: myJudgment } = useLiveDoc<{ answered: boolean }>(
    () =>
      profile
        ? doc(db, 'officials', question.officialUid, 'questions', question.id, 'judgments', profile.uid)
        : null,
    [profile?.uid, question.id]
  );

  const statusChip = {
    awaitingResponse: { label: 'Awaiting response', tone: 'warning' as const },
    underReview: { label: 'Community reviewing', tone: 'primary' as const },
    answered: { label: 'Answered', tone: 'success' as const },
    dodged: { label: 'Dodged', tone: 'danger' as const },
  }[question.status];

  const respond = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await respondToQuestion(profile, question, responseText);
      setResponseText('');
    } catch (e) {
      Alert.alert('Could not respond', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const judge = async (answered: boolean) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    setBusy(true);
    try {
      await judgeResponse(profile, question, answered);
    } catch (e) {
      Alert.alert('Could not record judgment', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const totalJudgments = question.answeredYes + question.answeredNo;

  return (
    <Card>
      <View style={styles.metaRow}>
        <Chip label={statusChip.label} tone={statusChip.tone} />
        {question.authorVerified && <VerifiedBadge compact />}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {question.authorName} · {timeAgo(question.createdAt)}
        </ThemedText>
      </View>
      <ThemedText type="small" style={{ fontSize: 15, lineHeight: 21 }}>
        {question.body}
      </ThemedText>

      {question.response ? (
        <View style={[styles.response, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="mic" size={13} color={theme.primary} />
            <ThemedText type="smallBold" style={{ fontSize: 12, color: theme.primary }}>
              Official response · {timeAgo(question.respondedAt)}
            </ThemedText>
          </View>
          <ThemedText type="small">{question.response}</ThemedText>
        </View>
      ) : null}

      {question.response && !isThisOfficial && (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            Did this answer the question?
          </ThemedText>
          <View style={styles.judgeRow}>
            <Button
              title={`Yes${myJudgment?.answered === true ? ' ✓' : ''}`}
              variant={myJudgment?.answered === true ? 'primary' : 'secondary'}
              onPress={() => judge(true)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              title={`No, it dodged${myJudgment?.answered === false ? ' ✓' : ''}`}
              variant={myJudgment?.answered === false ? 'danger' : 'secondary'}
              onPress={() => judge(false)}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {question.answeredYes} say answered · {question.answeredNo} say dodged
            {totalJudgments < ANSWER_JUDGMENT_QUORUM
              ? ` · ${ANSWER_JUDGMENT_QUORUM - totalJudgments} more needed to decide`
              : ''}
          </ThemedText>
        </View>
      )}

      {isThisOfficial && !question.response && (
        <View style={{ gap: Spacing.two }}>
          <Field
            placeholder="Write your response…"
            value={responseText}
            onChangeText={setResponseText}
            multiline
          />
          <Button
            title="Post response"
            onPress={respond}
            disabled={!responseText.trim()}
            loading={busy}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  response: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  judgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
