import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ApprovalWidget } from '@/components/approval-widget';
import { OfficialAvatar } from '@/components/avatar';
import { ClaimGate } from '@/components/claim-gate';
import { ContentActions } from '@/components/content-actions';
import { GradeBadge, gradeColor } from '@/components/grade-badge';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { host, timeAgo } from '@/lib/format';
import { notify, notifyError } from '@/lib/notify';
import { openLink } from '@/lib/open-link';
import type { AmaQuestion, Official } from '@/lib/types';
import { askQuestion, deleteQuestion, judgeResponse, respondToQuestion } from '@/services/ama';
import { APPROVAL_MIN_BALLOTS, computeGrade, updateOfficialCard } from '@/services/officials';

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
  const { isBlocked } = useBlocks();

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
        <>
          <ClaimGate claimed={official.claimed} name={official.name} />
          <EditCard official={official} />
          <Button
            title={official.wardId != null ? 'Put a question to your ward or the city' : 'Put a question to the city'}
            onPress={() => router.push('/new-poll')}
          />
        </>
      ) : (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            Do you approve of the job {official.name.split(' ')[0]} is doing?
          </ThemedText>
          <ApprovalWidget official={official} />
        </Card>
      )}

      <SectionHeader
        title="AMA"
        subtitle="Ask anything. The community judges whether the answer was real."
      />
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
        questions
          .filter((q) => !isBlocked(q.authorUid))
          .map((q, i) => (
            <Animated.View key={q.id} entering={FadeInDown.duration(260).delay(Math.min(i, 8) * 40)}>
              <QuestionCard question={q} isThisOfficial={isThisOfficial} officialName={official.name} />
            </Animated.View>
          ))
      )}
    </Screen>
  );
}

/** One public point of contact: website, ward-office email, or phone. */
function ContactRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={styles.contactRow}>
      <Ionicons name={icon} size={14} color={theme.primary} />
      <ThemedText type="small" style={{ color: theme.primary, fontSize: 13, flex: 1 }}>
        {label}
      </ThemedText>
    </Pressable>
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

      {official.claimed ? (
        <View style={styles.contactRow}>
          <Ionicons name="checkmark-circle" size={14} color={theme.verified} />
          <ThemedText type="small" style={{ color: theme.verified, fontSize: 12 }}>
            On the platform - this official answers here
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          Not on the platform yet. This profile is public record; {official.name.split(' ')[0]} can
          claim it any time, and unanswered questions stay pending until they do.
        </ThemedText>
      )}

      {(official.websiteUrl || official.contactEmail || official.phone) && (
        <View style={{ gap: Spacing.one }}>
          {official.websiteUrl ? (
            <ContactRow
              icon="globe-outline"
              label={host(official.websiteUrl)}
              onPress={() => void openLink(official.websiteUrl!)}
            />
          ) : null}
          {official.contactEmail ? (
            <ContactRow
              icon="mail-outline"
              label={official.contactEmail}
              onPress={() => void Linking.openURL(`mailto:${official.contactEmail}`)}
            />
          ) : null}
          {official.phone ? (
            <ContactRow
              icon="call-outline"
              label={official.phone}
              onPress={() => void Linking.openURL(`tel:${official.phone!.replace(/[^+\d]/g, '')}`)}
            />
          ) : null}
        </View>
      )}

      <View style={styles.axesRow}>
        <AxisSummary
          title="Approval"
          subtitle="how well liked"
          value={
            grade.approval.constituentPct == null
              ? '-'
              : `${grade.approval.constituentPct}%`
          }
          score={grade.approval.constituentPct}
        />
        <View style={[styles.axisDivider, { backgroundColor: theme.border }]} />
        <AxisSummary
          title="Answers"
          subtitle="straight answers given"
          value={!grade.answersGraded || grade.answers.score == null ? '-' : `${grade.answers.score}`}
          score={grade.answersGraded ? grade.answers.score : null}
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {grade.answers.answered} answered · {grade.answers.dodged} dodged ·{' '}
        {grade.answers.ignored} ignored · {grade.answers.pending} pending
      </ThemedText>
      {grade.approval.constituentBallots < APPROVAL_MIN_BALLOTS && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          At least {APPROVAL_MIN_BALLOTS} votes are needed to show an approval score -{' '}
          {grade.approval.constituentBallots} so far.
        </ThemedText>
      )}
    </Card>
  );
}

function AxisSummary({
  title,
  subtitle,
  value,
  score,
}: {
  title: string;
  subtitle: string;
  value: string;
  score: number | null;
}) {
  const theme = useTheme();
  const color = gradeColor(score, theme);
  return (
    <View style={{ flex: 1, gap: 2, alignItems: 'center' }}>
      <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 32, color }}>
        {value}
      </ThemedText>
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
        Link a photo hosted on your own site or campaign page - direct democracy displays it but
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
  officialName,
}: {
  question: AmaQuestion;
  isThisOfficial: boolean;
  officialName: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const isAsker = profile?.uid === question.authorUid;

  const withdraw = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await deleteQuestion(profile, question);
    } catch (e) {
      notifyError('Could not withdraw', e);
    } finally {
      setBusy(false);
    }
  };

  const { data: myJudgment } = useLiveDoc<{ answered: boolean }>(
    () =>
      profile
        ? doc(db, 'officials', question.officialUid, 'questions', question.id, 'judgments', profile.uid)
        : null,
    [profile?.uid, question.id]
  );

  const statusChip = {
    awaitingResponse: { label: 'Awaiting response', tone: 'warning' as const },
    // A response counts as answered unless the community judges it a dodge.
    underReview: { label: 'Answered', tone: 'success' as const },
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

  return (
    <Card>
      <View style={styles.metaRow}>
        <Chip label={statusChip.label} tone={statusChip.tone} />
        {question.authorVerified && <VerifiedBadge compact />}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {question.authorName} · {timeAgo(question.createdAt)}
        </ThemedText>
        <View style={{ flex: 1 }} />
        <ContentActions
          contentPath={`officials/${question.officialUid}/questions/${question.id}`}
          contentType="question"
          excerpt={question.body}
          authorUid={question.authorUid}
          authorName={question.authorName}
        />
      </View>
      <ThemedText type="small" style={{ fontSize: 15, lineHeight: 21 }}>
        {question.body}
      </ThemedText>
      {isAsker &&
        question.status === 'awaitingResponse' &&
        (confirmWithdraw ? (
          <View style={styles.judgeRow}>
            <Button title="Yes, withdraw" variant="danger" onPress={withdraw} disabled={busy} />
            <Button title="Keep it" variant="ghost" onPress={() => setConfirmWithdraw(false)} />
          </View>
        ) : (
          <Button
            title="Withdraw my question"
            variant="ghost"
            onPress={() => setConfirmWithdraw(true)}
          />
        ))}

      {question.response ? (
        <View style={[styles.response, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="mic" size={13} color={theme.primary} />
            <ThemedText type="smallBold" style={{ fontSize: 12, color: theme.primary }}>
              Official response · {timeAgo(question.respondedAt)}
            </ThemedText>
            <View style={{ flex: 1 }} />
            <ContentActions
              contentPath={`officials/${question.officialUid}/questions/${question.id}`}
              contentType="response"
              excerpt={question.response}
              authorUid={question.officialUid}
              authorName={officialName}
            />
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
              title={`Answered${myJudgment?.answered === true ? ' ✓' : ''}`}
              variant={myJudgment?.answered === true ? 'primary' : 'secondary'}
              onPress={() => judge(true)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              title={`Dodged${myJudgment?.answered === false ? ' ✓' : ''}`}
              variant={myJudgment?.answered === false ? 'danger' : 'secondary'}
              onPress={() => judge(false)}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {question.answeredYes} say answered ({question.answeredYesVerified ?? 0} verified) ·{' '}
            {question.answeredNo} say dodged ({question.answeredNoVerified ?? 0} verified)
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
