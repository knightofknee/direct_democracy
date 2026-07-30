import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ApprovalWidget } from '@/components/approval-widget';
import { OfficialAvatar } from '@/components/avatar';
import { GradeBadge, gradeColor } from '@/components/grade-badge';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { notify, notifyError } from '@/lib/notify';
import { ANSWER_JUDGMENT_QUORUM, type AmaQuestion, type Official } from '@/lib/types';
import { askQuestion, judgeResponse, respondToQuestion } from '@/services/ama';
import { computeGrade, letterFor, updateOfficialCard } from '@/services/officials';

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
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="alert-circle-outline" message="Official not found." />
        )}
      </Screen>
    );
  }

  const grade = computeGrade(official);
  const isThisOfficial = profile?.uid === official.uid;

  const ask = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    const body = questionText.trim();
    if (body.length < 10) {
      notify('Almost there', 'Ask a question of at least 10 characters.');
      return;
    }
    setAsking(true);
    try {
      await askQuestion(profile, official.uid, body);
      setQuestionText('');
    } catch (e) {
      notifyError('Could not ask', e);
    } finally {
      setAsking(false);
    }
  };

  return (
    <Screen>
      <GradeCard official={official} grade={grade} />

      {isThisOfficial ? (
        <EditCard official={official} />
      ) : (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            Do you approve of the job {official.name.split(' ')[0]} is doing?
          </ThemedText>
          <ApprovalWidget official={official} />
        </Card>
      )}

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

      <SectionHeader title={`Questions (${grade.answers.asked})`} />
      {questions.length === 0 ? (
        <EmptyState icon="help-circle-outline" message="No questions yet. Ask the first one." />
      ) : (
        questions.map((q, i) => (
          <Animated.View key={q.id} entering={FadeInDown.duration(260).delay(Math.min(i, 8) * 40)}>
            <QuestionCard question={q} isThisOfficial={isThisOfficial} />
          </Animated.View>
        ))
      )}
    </Screen>
  );
}

/** The report card: portrait, overall mark, and both axes explained. */
function GradeCard({
  official,
  grade,
}: {
  official: Official;
  grade: ReturnType<typeof computeGrade>;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.headerRow}>
        <OfficialAvatar name={official.name} photoUrl={official.photoUrl} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="smallBold" style={{ fontSize: 19, lineHeight: 25 }}>
            {official.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {official.title}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'center', gap: 3 }}>
          <GradeBadge letter={grade.letter} score={grade.overall} size={54} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10, lineHeight: 12 }}>
            OVERALL
          </ThemedText>
        </View>
      </View>

      {official.bio ? <ThemedText type="small">{official.bio}</ThemedText> : null}

      <View style={styles.axesRow}>
        <AxisSummary
          title="Approval"
          subtitle="how well liked"
          value={
            grade.approval.constituentPct == null
              ? '—'
              : `${grade.approval.constituentPct}%`
          }
          letter={letterFor(grade.approval.constituentPct)}
          score={grade.approval.constituentPct}
        />
        <View style={[styles.axisDivider, { backgroundColor: theme.border }]} />
        <AxisSummary
          title="Answers"
          subtitle="straight answers given"
          value={!grade.answersGraded || grade.answers.score == null ? '—' : `${grade.answers.score}`}
          letter={grade.answersGraded ? grade.answers.grade : '—'}
          score={grade.answersGraded ? grade.answers.score : null}
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {grade.answers.answered} answered · {grade.answers.dodged} dodged · {grade.answers.ignored}{' '}
        ignored, as judged by the community — never by the official. The overall grade averages
        constituent approval with the answer score.
      </ThemedText>
    </Card>
  );
}

function AxisSummary({
  title,
  subtitle,
  value,
  letter,
  score,
}: {
  title: string;
  subtitle: string;
  value: string;
  letter: string;
  score: number | null;
}) {
  const theme = useTheme();
  const color = gradeColor(score, theme);
  return (
    <View style={{ flex: 1, gap: 2, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 32, color }}>
          {value}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color, fontSize: 14 }}>
          {letter}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ fontSize: 12 }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

/** Officials manage their own card: bio + externally hosted portrait link. */
function EditCard({ official }: { official: Official }) {
  const { profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(official.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState(official.photoUrl ?? '');
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateOfficialCard(profile, { bio, photoUrl });
      setEditing(false);
    } catch (e) {
      notifyError('Could not save', e);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Button title="Edit my card" variant="secondary" onPress={() => setEditing(true)} />
    );
  }

  return (
    <Card>
      <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={1000} />
      <Field
        label="Portrait link (https)"
        placeholder="https://your-site.org/portrait.jpg"
        value={photoUrl}
        onChangeText={setPhotoUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        Link a photo hosted on your own site or campaign page — direct democracy displays it but
        never stores the image.
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
        <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
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
      notifyError('Could not respond', e);
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
      notifyError('Could not record judgment', e);
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  axesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  axisDivider: {
    width: StyleSheet.hairlineWidth,
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
