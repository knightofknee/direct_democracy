import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ShareButton } from '@/components/share-button';
import { HeaderActions } from '@/components/help-button';
import { ApprovalWidget } from '@/components/approval-widget';
import { OfficialAvatar } from '@/components/avatar';
import { useCelebration } from '@/components/celebration';
import { CommentsSection } from '@/components/comments';
import { ContentActions } from '@/components/content-actions';
import { GradeBadge, GradeBasis, gradeColor } from '@/components/grade-badge';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { TallyResults } from '@/components/tally-results';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useScreenRoom } from '@/hooks/use-screen-room';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { host, timeAgo } from '@/lib/format';
import { usePageSummary } from '@/lib/page-help';
import { useRateWindow } from '@/lib/rate-limits';
import { useWardPostWindow } from '@/lib/ward-posting';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import { useOptimistic } from '@/lib/optimistic';
import { openLink } from '@/lib/open-link';
import type { AmaQuestion, Comment, DualTally, Official } from '@/lib/types';
import { UpvotePill, useOptimisticUpvotes } from '@/components/upvote-pill';
import { EditHistory } from '@/components/edit-history';
import { VotingRecord } from '@/components/voting-record';
import { DailyLimitNote, WardPostNote } from '@/components/ward-post-note';
import {
  askQuestion,
  deleteQuestion,
  addQuestionComment,
  deleteQuestionComment,
  judgeResponse,
  setQuestionUpvote,
  voteOnQuestionComment,
} from '@/services/ama';
import { computeGrade } from '@/services/officials';
import { editPost } from '@/services/posts';
import { enter } from '@/lib/motion';

const VERDICT_OPTIONS = [
  { key: 'answered', label: 'Answered' },
  { key: 'dodged', label: 'Dodged' },
];

export default function OfficialAmaScreen() {
  // `q` arrives from a notification: the one question (and its response) the
  // tap was about. The screen opens scrolled to it, not at the grade card.
  // `thread=1` (a reply in the conversation) also opens that conversation.
  const { id, q: focusId, thread } = useLocalSearchParams<{ id: string; q?: string; thread?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const t = useT();
  const scrollRef = useRef<ScrollView>(null);
  const focusUntil = useRef<number | null>(null);
  // The cards above settle over a few frames (grade, approval, the list
  // itself), so follow the target's position for a moment after it first
  // lays out, then let go so the reader's own scrolling is never fought.
  const onFocusLayout = useCallback((e: LayoutChangeEvent) => {
    const now = Date.now();
    focusUntil.current ??= now + 1500;
    if (now > focusUntil.current) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - Spacing.two), animated: false });
  }, []);
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
  // A question to an alderman is a post in their ward: 3 a day at home,
  // once a week anywhere else (enforced by onQuestionCreated).
  const askWindow = useWardPostWindow(official?.wardId ?? null);
  // Citywide officials (the mayor) take the citywide question limit instead.
  const cityAskOpensAt = useRateWindow(official && official.wardId == null ? 'cityQuestions' : null);

  // The help sheet's summary of this official's record as it stands.
  const summaryGrade = official ? computeGrade(official) : null;
  usePageSummary(
    'official/[id]',
    official && summaryGrade
      ? [
          `${official.name}, ${t(official.title)}.`,
          summaryGrade.overall != null
            ? t('Overall grade: {letter}.').replace('{letter}', summaryGrade.letter)
            : t('Not graded yet.'),
          summaryGrade.approval.constituentPct != null
            ? t('Approval from verified residents: {pct}%, from {n} ratings.')
                .replace('{pct}', String(summaryGrade.approval.constituentPct))
                .replace('{n}', String(summaryGrade.approval.constituentBallots))
            : t('Approval: not enough verified ratings yet (it takes 5).'),
          t('Questions: {answered} answered, {dodged} dodged, {ignored} ignored, {pending} waiting.')
            .replace('{answered}', String(summaryGrade.answers.answered))
            .replace('{dodged}', String(summaryGrade.answers.dodged))
            .replace('{ignored}', String(summaryGrade.answers.ignored))
            .replace('{pending}', String(summaryGrade.answers.pending)),
          official.claimed
            ? t('On the platform: they answer questions here.')
            : t('Not on the platform yet. Their unanswered questions stay waiting, never counted as ignored.'),
          profile &&
            questions.some((q) => q.authorUid === profile.uid) &&
            t('You have asked {n} of these questions.').replace(
              '{n}',
              String(questions.filter((q) => q.authorUid === profile.uid).length)
            ),
        ]
      : []
  );

  if (!official) {
    return (
      <Screen>
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="alert-circle-outline" message={t('Official not found.')} />
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
      notify(t('Almost there'), t('Ask a question of at least 10 characters.'));
      return;
    }
    setAsking(true);
    try {
      await askQuestion(profile, official.uid, body);
      setQuestionText('');
    } catch (e) {
      notifyError(t('Could not ask'), e);
    } finally {
      setAsking(false);
    }
  };

  return (
    <Screen ref={scrollRef}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderActions>
              <ShareButton path={`/official/${official.uid}`} title={official.name} />
            </HeaderActions>
          ),
        }}
      />
      <GradeCard official={official} grade={grade} />

      {/* The public card, the same for everyone, the official included:
          their tools live in the command center tab. */}
      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t('Do you approve of the job {name} is doing?').replace('{name}', official.name.split(' ')[0])}
        </ThemedText>
        <ApprovalWidget official={official} />
      </Card>

      <SectionHeader
        title="AMA"
        subtitle={t('Ask anything. The community judges whether the question was answered sufficiently.')}
      />
      {!isThisOfficial && (
        <Card>
          <Field
            placeholder={t('Ask {name} anything…').replace('{name}', official.name)}
            value={questionText}
            onChangeText={setQuestionText}
            multiline
            maxLength={2000}
          />
          {official.wardId != null && profile && <WardPostNote wardId={official.wardId} window={askWindow} />}
          {official.wardId == null && <DailyLimitNote bucket="cityQuestions" nextAt={cityAskOpensAt} />}
          <Button
            title={t('Ask')}
            onPress={ask}
            disabled={!questionText.trim() || askWindow.nextAt != null || cityAskOpensAt != null}
            loading={asking}
          />
        </Card>
      )}

      <SectionHeader title={`${t('Questions')} (${grade.answers.asked})`} />
      {questions.length === 0 ? (
        <EmptyState icon="help-circle-outline" message={t('No questions yet. Ask the first one.')} />
      ) : (
        // The questions people join lead the list (recency breaks ties via
        // the stable sort over the newest-first query) - upvoting an
        // existing question beats re-asking it, so the shared one must be
        // what a new reader sees first.
        [...questions]
          .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
          .filter((q) => !isBlocked(q.authorUid))
          .map((q, i) => (
            // Layout is read off a plain View: an entering animation's
            // wrapper does not report onLayout reliably on every platform.
            <View
              key={q.id}
              onLayout={q.id === focusId ? onFocusLayout : undefined}
              style={
                q.id === focusId
                  ? { borderRadius: 18, borderWidth: 2, borderColor: theme.primary }
                  : undefined
              }>
              <Animated.View entering={enter(FadeInDown.duration(260).delay(Math.min(i, 8) * 40))}>
                <QuestionCard
                  question={q}
                  isThisOfficial={isThisOfficial}
                  officialName={official.name}
                  openThread={q.id === focusId && thread === '1'}
                />
              </Animated.View>
            </View>
          ))
      )}

      <VotingRecord official={official} />
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
  const t = useT();
  // Portrait, name, and the overall mark side by side leave a long name
  // ("Byron Sigcho-Lopez") about 100pt on a small phone with large text,
  // which breaks it mid-word. There the mark moves to its own row.
  const { tight } = useScreenRoom();
  const overall = (
    <View style={{ alignItems: 'center', gap: 3, flexDirection: tight ? 'row' : 'column' }}>
      <GradeBadge letter={grade.letter} score={grade.overall} size={tight ? 44 : 54} />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10, lineHeight: 12 }}>
        {t('OVERALL')}
      </ThemedText>
    </View>
  );
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
          <GradeBasis grade={grade} style={{ fontSize: 12, lineHeight: 16 }} />
        </View>
        {tight ? null : overall}
      </View>
      {tight ? overall : null}

      {official.bio ? <ThemedText type="small">{official.bio}</ThemedText> : null}

      {official.claimed ? (
        <View style={styles.contactRow}>
          <Ionicons name="checkmark-circle" size={14} color={theme.verified} />
          <ThemedText type="small" style={{ color: theme.verified, fontSize: 12 }}>
            {t('On the platform - this official answers here')}
          </ThemedText>
        </View>
      ) : official.wardId != null ? (
        // Aldermen don't have to join to answer: the top questions go to
        // their ward office.
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Not on the platform yet. We take the top-rated questions here to {name}’s ward office, so {name} can answer without joining the app.').replaceAll('{name}', official.name.split(' ')[0])}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Not on the platform yet. This profile is public record; {name} can claim it any time, and unanswered questions stay pending until they do.').replace('{name}', official.name.split(' ')[0])}
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
          title={t('Approval')}
          subtitle={t('how well liked')}
          value={
            grade.approval.constituentPct == null
              ? '-'
              : `${grade.approval.constituentPct}%`
          }
          score={grade.approval.constituentPct}
        />
        <View style={[styles.axisDivider, { backgroundColor: theme.border }]} />
        <AxisSummary
          title={t('Answers')}
          subtitle={t('straight answers given')}
          value={!grade.answersGraded || grade.answers.score == null ? '-' : `${grade.answers.score}`}
          score={grade.answersGraded ? grade.answers.score : null}
          onInfo={() =>
            notify(
              t('How answers are graded'),
              t('Every response counts as answered until the community judges it a dodge. Each question is weighted by the verified people who joined it, so ignoring a question fifty people want answered costs far more than ignoring one nobody backed. Unanswered questions get a week of grace before they count as ignored.')
            )
          }
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {`${grade.answers.answered} ${t('answered')} · ${grade.answers.dodged} ${t('dodged')} · ${grade.answers.ignored} ${t('ignored')} · ${grade.answers.pending} ${t('pending')}`}
      </ThemedText>
    </Card>
  );
}

function AxisSummary({
  title,
  subtitle,
  value,
  score,
  onInfo,
}: {
  title: string;
  subtitle: string;
  value: string;
  score: number | null;
  /** Explainer behind an info icon, sitting on the number it explains. */
  onInfo?: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const color = gradeColor(score, theme);
  return (
    <View style={{ flex: 1, gap: 2, alignItems: 'center' }}>
      <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 32, color }}>
        {value}
      </ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <ThemedText type="smallBold" style={{ fontSize: 12 }}>
          {title}
        </ThemedText>
        {onInfo && (
          <Pressable
            onPress={onInfo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('How {axis} are graded').replace('{axis}', title.toLowerCase())}>
            <Ionicons name="information-circle-outline" size={14} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

function QuestionCard({
  question,
  isThisOfficial,
  officialName,
  openThread = false,
}: {
  question: AmaQuestion;
  isThisOfficial: boolean;
  officialName: string;
  /** Start with the conversation open (arrived from a reply notification). */
  openThread?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const isAsker = profile?.uid === question.authorUid;
  // The asker may edit until the official answers (editPost records it).
  const saveEdit = async () => {
    if (editing == null) return;
    setBusy(true);
    try {
      await editPost(`officials/${question.officialUid}/questions/${question.id}`, { body: editing });
      setEditing(null);
    } catch (e) {
      notifyError(t('Could not save'), e);
    } finally {
      setBusy(false);
    }
  };

  const { anticipate } = useCelebration();

  const withdraw = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await deleteQuestion(profile, question);
    } catch (e) {
      notifyError(t('Could not withdraw'), e);
    } finally {
      setBusy(false);
    }
  };

  const { data: myJudgment, loading: myJudgmentLoading } = useLiveDoc<{ answered: boolean }>(
    () =>
      profile
        ? doc(db, 'officials', question.officialUid, 'questions', question.id, 'judgments', profile.uid)
        : null,
    [profile?.uid, question.id]
  );

  const { data: myUpvote } = useLiveDoc<{ uid: string }>(
    () =>
      profile
        ? doc(db, 'officials', question.officialUid, 'questions', question.id, 'votes', profile.uid)
        : null,
    [profile?.uid, question.id]
  );
  const { count: upvoteCount, bump, settle } = useOptimisticUpvotes(question.upvotes ?? 0);

  // Assume success: the count moves the instant they tap, and only a failed
  // write (rare - it is the user's own vote doc) rolls back and alerts.
  const toggleUpvote = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    tapHaptic();
    const up = myUpvote == null;
    bump(up ? 1 : -1);
    try {
      await setQuestionUpvote(profile, question, up);
    } catch (e) {
      settle();
      notifyError(t('Your voice was not recorded'), e);
    }
  };

  // Assume success: the verdict bars move the instant they judge, handed
  // back to the server counts when onJudgmentWrite lands.
  const verdictCounts = useOptimistic({
    yes: question.answeredYes ?? 0,
    no: question.answeredNo ?? 0,
    yesVerified: question.answeredYesVerified ?? 0,
    noVerified: question.answeredNoVerified ?? 0,
  });

  // The community verdict is a two-option tally like any poll, so it renders
  // through the same results component. Counter fields may be absent on
  // questions judged before the verified split existed.
  const v = verdictCounts.value;
  const verdictTally: DualTally = {
    all: { answered: v.yes, dodged: v.no },
    verified: { answered: v.yesVerified, dodged: v.noVerified },
    totalAll: v.yes + v.no,
    totalVerified: v.yesVerified + v.noVerified,
  };

  const statusChip = {
    awaitingResponse: { label: 'Awaiting response', tone: 'warning' as const },
    // A response counts as answered unless the community judges it a dodge.
    underReview: { label: 'Answered', tone: 'success' as const },
    answered: { label: 'Answered', tone: 'success' as const },
    dodged: { label: 'Dodged', tone: 'danger' as const },
  }[question.status];

  const judge = (answered: boolean) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    if (myJudgment?.answered === answered) return;
    tapHaptic();
    // "First" only once the judgment doc has actually loaded (see milestones.ts).
    const firstJudgment = !myJudgmentLoading && myJudgment == null;
    if (firstJudgment) anticipate('judgments');
    const prev = myJudgment?.answered ?? null;
    const verified = !!profile.verified;
    verdictCounts.predict({
      yes: Math.max(0, v.yes - (prev === true ? 1 : 0)) + (answered ? 1 : 0),
      no: Math.max(0, v.no - (prev === false ? 1 : 0)) + (answered ? 0 : 1),
      yesVerified: verified
        ? Math.max(0, v.yesVerified - (prev === true ? 1 : 0)) + (answered ? 1 : 0)
        : v.yesVerified,
      noVerified: verified
        ? Math.max(0, v.noVerified - (prev === false ? 1 : 0)) + (answered ? 0 : 1)
        : v.noVerified,
    });
    judgeResponse(profile, question, answered).catch((e) => {
      verdictCounts.rollback();
      notifyError(t('Could not record judgment'), e);
    });
  };

  return (
    <Card>
      <View style={styles.metaRow}>
        <Chip label={t(statusChip.label)} tone={statusChip.tone} />
        {question.authorVerified && <VerifiedBadge compact />}
        {/* The row wraps on a narrow screen: the asker's name and the time
            are never cut off, the upvote pill just drops to the next line. */}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, flexShrink: 1 }}>
          {question.authorName} · {timeAgo(question.createdAt)}
        </ThemedText>
        <View style={{ flexGrow: 1 }} />
        {/* The official sees the count too (it is their priority signal),
            they just cannot join questions put to themselves; the asker's
            own question already carries their weight. */}
        <UpvotePill
          count={upvoteCount}
          active={myUpvote != null}
          onPress={toggleUpvote}
          disabled={isThisOfficial || question.authorUid === profile?.uid}
        />

        <ContentActions
          contentPath={`officials/${question.officialUid}/questions/${question.id}`}
          contentType="question"
          excerpt={question.body}
          authorUid={question.authorUid}
          authorName={question.authorName}
        />
      </View>
      {editing != null ? (
        <View style={{ gap: Spacing.two }}>
          <Field value={editing} onChangeText={setEditing} multiline maxLength={2000} autoFocus />
          <View style={styles.judgeRow}>
            <Button title={t('Cancel')} variant="ghost" onPress={() => setEditing(null)} style={{ flex: 1 }} />
            <Button
              title={t('Save')}
              onPress={saveEdit}
              loading={busy}
              disabled={editing.trim().length < 10 || editing.trim() === question.body}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <ThemedText type="small" style={{ fontSize: 15, lineHeight: 21 }}>
          {question.body}
        </ThemedText>
      )}
      <EditHistory edits={question.edits} />
      {isAsker &&
        question.status === 'awaitingResponse' &&
        editing == null &&
        (confirmWithdraw ? (
          <View style={styles.judgeRow}>
            <Button title={t('Yes, withdraw')} variant="danger" onPress={withdraw} disabled={busy} />
            <Button title={t('Keep it')} variant="ghost" onPress={() => setConfirmWithdraw(false)} />
          </View>
        ) : (
          <View style={styles.judgeRow}>
            <Button title={t('Edit')} variant="ghost" onPress={() => setEditing(question.body)} />
            <Button
              title={t('Withdraw my question')}
              variant="ghost"
              onPress={() => setConfirmWithdraw(true)}
            />
          </View>
        ))}

      {question.response ? (
        <View style={[styles.response, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Ionicons name="mic" size={13} color={theme.primary} />
            <ThemedText type="smallBold" style={{ fontSize: 12, color: theme.primary }}>
              {t('Official response')} · {timeAgo(question.respondedAt)}
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
            {t('Did this answer the question?')}
          </ThemedText>
          <View style={styles.judgeRow}>
            <Button
              title={`${t('Answered')}${myJudgment?.answered === true ? ' ✓' : ''}`}
              variant={myJudgment?.answered === true ? 'primary' : 'secondary'}
              onPress={() => judge(true)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              title={`${t('Dodged')}${myJudgment?.answered === false ? ' ✓' : ''}`}
              variant={myJudgment?.answered === false ? 'danger' : 'secondary'}
              onPress={() => judge(false)}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
          {verdictTally.totalAll > 0 && (
            <TallyResults
              tally={verdictTally}
              options={VERDICT_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
              highlightKeys={
                myJudgment ? [myJudgment.answered ? 'answered' : 'dodged'] : undefined
              }
              noun="verdict"
            />
          )}
        </View>
      )}

      {question.response ? <QuestionThread question={question} startOpen={openThread} /> : null}
    </Card>
  );
}

/**
 * The conversation under an answer: the asker, the official, and anyone
 * else can keep talking, with the same threaded comments as the boards and
 * the official's own replies marked. Folded until asked for, so the list
 * of questions stays scannable.
 */
function QuestionThread({ question, startOpen }: { question: AmaQuestion; startOpen: boolean }) {
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const [open, setOpen] = useState(startOpen);
  const { data: comments } = useLiveQuery<Comment>(
    () =>
      open
        ? query(
            collection(db, 'officials', question.officialUid, 'questions', question.id, 'comments'),
            orderBy('createdAt', 'desc')
          )
        : null,
    [open, question.id]
  );
  const count = question.commentCount ?? 0;
  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={styles.threadToggle}>
        <Ionicons name="chatbubbles-outline" size={15} color={theme.primary} />
        <ThemedText type="smallBold" style={{ fontSize: 13, color: theme.primary, flex: 1 }}>
          {count > 0
            ? t('Conversation ({n})').replace('{n}', String(count))
            : t('Continue the conversation')}
        </ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
      </Pressable>
      {open && (
        <CommentsSection
          comments={comments}
          opUid={question.officialUid}
          opChipLabel="official"
          contentPathFor={(comment) =>
            `officials/${question.officialUid}/questions/${question.id}/comments/${comment.id}`
          }
          onSubmit={(body, reply, references) => addQuestionComment(profile!, question, body, reply, references)}
          onDelete={(comment) => deleteQuestionComment(profile!, question, comment)}
          onVote={(comment, value) => voteOnQuestionComment(profile!, question, comment.id, value)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  threadToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
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
    flexWrap: 'wrap',
    gap: Spacing.two,
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
