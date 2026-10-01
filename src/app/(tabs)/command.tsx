import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  collectionGroup,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { CandidateCardEditor, OfficialCardEditor, SyncCard } from '@/components/card-editors';
import { ClaimGate } from '@/components/claim-gate';
import { IssueRow } from '@/components/concern-card';
import { ElectionAnswerComposer } from '@/components/election-answer-composer';
import { FlagAccent } from '@/components/flag-accent';
import { PollCard } from '@/components/poll-card';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, Chip, EmptyState, Field, SectionHeader } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { plural, timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import { notifyError } from '@/lib/notify';
import type {
  AmaQuestion,
  Candidate,
  Concern,
  ElectionQuestion,
  Official,
  Policy,
  Poll,
  UserProfile,
} from '@/lib/types';
import { respondToQuestion } from '@/services/ama';

/**
 * The command center: where an official or candidate does the work, so the
 * public pages can read the same for them as for everyone. Top to bottom:
 * questions waiting on them, putting a question to the public, their polls
 * (open, then closed), then the issues people are raising, in rank order.
 * Candidates also manage their platform here. The tab exists only for
 * those two roles (see (tabs)/_layout.tsx).
 */
export default function CommandCenterScreen() {
  const { profile, loading } = useAuth();
  const t = useT();
  const scrollRef = useRef<ScrollView>(null);

  if (loading) {
    return (
      <Screen tab>
        <SkeletonCards />
      </Screen>
    );
  }
  if (!profile || (profile.role !== 'official' && profile.role !== 'candidate')) {
    return (
      <Screen tab>
        <EmptyState
          icon="lock-closed-outline"
          message={t('The command center is for elected officials and candidates.')}
        />
      </Screen>
    );
  }
  return (
    <Screen tab ref={scrollRef}>
      {profile.role === 'official' ? (
        <OfficialCommand profile={profile} scrollRef={scrollRef} />
      ) : (
        <CandidateCommand profile={profile} />
      )}
    </Screen>
  );
}

function Header({ name, office }: { name: string; office: string }) {
  const t = useT();
  return (
    <View style={{ gap: Spacing.one, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <ChicagoStar size={18} />
        <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
          {t('command center')}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {`${name} · ${office}`}
      </ThemedText>
      <FlagAccent />
    </View>
  );
}

// ── Officials ──────────────────────────────────────────────────────────

function OfficialCommand({
  profile,
  scrollRef,
}: {
  profile: UserProfile;
  scrollRef: RefObject<ScrollView | null>;
}) {
  const t = useT();
  const router = useRouter();
  // `q` arrives from a notification about one question: open on it.
  const { q: focusId } = useLocalSearchParams<{ q?: string }>();
  const { data: official, loading: officialLoading } = useLiveDoc<Official>(
    () => doc(db, 'officials', profile.uid),
    [profile.uid]
  );
  const { data: waiting, loading } = useLiveQuery<AmaQuestion>(
    () =>
      query(
        collection(db, 'officials', profile.uid, 'questions'),
        where('status', '==', 'awaitingResponse')
      ),
    [profile.uid]
  );
  // The questions most people joined first, then the longest waiting: the
  // answer grade weighs a question by its verified joiners.
  const ordered = [...waiting].sort(
    (a, b) =>
      (b.upvotes ?? 0) - (a.upvotes ?? 0) ||
      (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
  );

  const focusUntil = useRef<number | null>(null);
  // Each notification tap scrolls to its own question, not just the first.
  useEffect(() => {
    focusUntil.current = null;
  }, [focusId]);
  const onFocusLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const now = Date.now();
      focusUntil.current ??= now + 1500;
      if (now > focusUntil.current) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - Spacing.two), animated: false });
    },
    [scrollRef]
  );

  // Read once per visit: the wait is a help-sheet figure, not a live clock.
  const [now] = useState(() => Date.now());
  const oldest = ordered.length ? Math.min(...ordered.map((q) => q.createdAt?.toMillis?.() ?? now)) : null;
  usePageSummary('(tabs)/command', [
    !loading &&
      (ordered.length === 0
        ? t('No questions are waiting for your response.')
        : t('Questions waiting for your response: {n}.').replace('{n}', String(ordered.length))),
    oldest != null &&
      t('The oldest has waited {days} days. A week without a response counts as ignored.').replace(
        '{days}',
        String(Math.floor((now - oldest) / 86_400_000))
      ),
    official && official.claimed === false && t('Your profile is not claimed yet.'),
  ]);

  if (!official) {
    return officialLoading ? (
      <SkeletonCards />
    ) : (
      <EmptyState icon="alert-circle-outline" message={t('Your official profile isn’t set up yet.')} />
    );
  }

  return (
    <>
      <Header name={official.name} office={official.title} />
      <ClaimGate claimed={official.claimed} name={official.name} />

      <SectionHeader
        title={`${t('Questions to answer')} (${ordered.length})`}
        subtitle={t('Most joined first. A question left a week without a response counts as ignored in your grade, and questions from verified residents count double.')}
      />
      {loading ? (
        <SkeletonCards count={1} />
      ) : ordered.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" message={t('No questions are waiting on you.')} />
      ) : (
        ordered.map((q) => (
          <View key={q.id === focusId ? `${q.id}-focus` : q.id} onLayout={q.id === focusId ? onFocusLayout : undefined}>
            <PendingQuestion profile={profile} question={q} focused={q.id === focusId} />
          </View>
        ))
      )}

      <PollsSection profile={profile} />

      <IssuesSection profile={profile} wardId={official.wardId} />

      <SectionHeader title={t('Your card')} />
      <OfficialCardEditor official={official} />
      <Button
        title={t('View your public page')}
        variant="ghost"
        onPress={() => router.push(`/official/${official.uid}`)}
      />
    </>
  );
}

/** One unanswered AMA question with the response box right under it. */
function PendingQuestion({
  profile,
  question,
  focused,
}: {
  profile: UserProfile;
  question: AmaQuestion;
  focused: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const respond = async () => {
    setBusy(true);
    try {
      await respondToQuestion(profile, question, text);
      setText('');
    } catch (e) {
      notifyError(t('Could not respond'), e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={focused ? { borderColor: theme.primary, borderWidth: 2 } : undefined}>
      <View style={styles.metaRow}>
        <View style={styles.joined}>
          <Ionicons name="arrow-up-circle" size={14} color={theme.primary} />
          <ThemedText type="smallBold" style={{ fontSize: 12, lineHeight: 16, color: theme.primary }}>
            {t('Joined by {n}').replace('{n}', String(question.upvotes ?? 0))}
          </ThemedText>
        </View>
        {/* Proven residents, apart from everyone else: the ones the grade
            counts most. */}
        <ThemedText type="small" style={{ fontSize: 12, lineHeight: 16, color: theme.verified }}>
          {t('{n} verified residents').replace('{n}', String(question.upvotesResident ?? 0))}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
          {`${question.authorName} · ${timeAgo(question.createdAt)}`}
        </ThemedText>
        {question.authorResident && <Chip label={t('Verified resident')} tone="success" icon="shield-checkmark" />}
      </View>
      <ThemedText type="small" style={{ fontSize: 15, lineHeight: 21 }}>
        {question.body}
      </ThemedText>
      <Field placeholder={t('Write your response…')} value={text} onChangeText={setText} multiline maxLength={5000} />
      <Button title={t('Post response')} onPress={respond} disabled={!text.trim()} loading={busy} />
    </Card>
  );
}

// ── Candidates ─────────────────────────────────────────────────────────

function CandidateCommand({ profile }: { profile: UserProfile }) {
  const t = useT();
  const router = useRouter();
  const theme = useTheme();
  const { data: candidate, loading: candidateLoading } = useLiveDoc<Candidate>(
    () => doc(db, 'candidates', profile.uid),
    [profile.uid]
  );
  const { data: questions, loading } = useLiveQuery<ElectionQuestion>(
    () => query(collection(db, 'electionQuestions'), orderBy('createdAt', 'desc')),
    []
  );
  const answered = useMyGroupParents('answers', 'candidateUid', profile.uid, 'electionQuestions');
  const { data: policies } = useLiveQuery<Policy>(
    () => query(collection(db, 'candidates', profile.uid, 'policies'), orderBy('order')),
    [profile.uid]
  );
  // Policies by their newest comment (lastCommentAt is trigger-written);
  // policies with no comments have no such field and drop out.
  const { data: commented } = useLiveQuery<Policy>(
    () =>
      query(collection(db, 'candidates', profile.uid, 'policies'), orderBy('lastCommentAt', 'desc'), limit(30)),
    [profile.uid]
  );

  usePageSummary('(tabs)/command', [
    !loading &&
      t('Questions to every candidate: {n}. You have not answered {open} of them.')
        .replace('{n}', String(questions.length))
        .replace('{open}', String(questions.filter((q) => !answered.ids.has(q.id)).length)),
    t('Policies on your platform: {n}.').replace('{n}', String(policies.length)),
    commented[0]?.lastCommentAt &&
      t('Newest comment on your platform: {ago}, on “{title}”.')
        .replace('{ago}', timeAgo(commented[0].lastCommentAt))
        .replace('{title}', commented[0].title),
  ]);

  if (!candidate) {
    return candidateLoading ? (
      <SkeletonCards />
    ) : (
      <EmptyState icon="alert-circle-outline" message={t('Your candidate profile isn’t set up yet.')} />
    );
  }

  // The to-do first: questions this candidate hasn't answered, most joined
  // first; the answered ones stay listed below, folded.
  const byJoined = [...questions].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
  const unanswered = byJoined.filter((q) => !answered.ids.has(q.id));
  const done = byJoined.filter((q) => answered.ids.has(q.id));
  const nextOrder = policies.reduce((max, p) => Math.max(max, p.order + 1), 0);

  return (
    <>
      <Header name={candidate.name} office={t(candidate.office)} />
      <ClaimGate claimed={candidate.claimed} name={candidate.name} />

      <SectionHeader
        title={`${t('Questions to answer')} (${answered.loading ? '…' : unanswered.length})`}
        subtitle={t('From “ask every candidate”, most joined first. Voters see every candidate’s answer side by side.')}
      />
      {loading || answered.loading ? (
        <SkeletonCards count={1} />
      ) : questions.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" message={t('No one has asked the candidates a question yet.')} />
      ) : unanswered.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" message={t('You’ve answered every election question.')} />
      ) : (
        unanswered.map((q) => (
          <Card key={q.id}>
            <View style={styles.metaRow}>
              <View style={styles.joined}>
                <Ionicons name="arrow-up-circle" size={14} color={theme.primary} />
                <ThemedText type="smallBold" style={{ fontSize: 12, lineHeight: 16, color: theme.primary }}>
                  {t('Joined by {n}').replace('{n}', String(q.upvotes ?? 0))}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                {`${plural(q.answerCount, 'answer')} · ${timeAgo(q.createdAt)}`}
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ fontSize: 15, lineHeight: 21 }}>
              {q.body}
            </ThemedText>
            <ElectionAnswerComposer profile={profile} questionId={q.id} bare />
          </Card>
        ))
      )}
      {done.map((q) => (
        <Card
          key={q.id}
          onPress={() => router.push(`/election-question/${q.id}`)}
          style={[styles.folded, { backgroundColor: theme.background }]}>
          <View style={styles.joined}>
            <Ionicons name="checkmark-circle" size={13} color={theme.verified} />
            <ThemedText type="small" style={{ fontSize: 12, lineHeight: 16, color: theme.verified }}>
              {t('You answered')}
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ fontSize: 14, lineHeight: 20 }}>
            {q.body}
          </ThemedText>
        </Card>
      ))}

      <SectionHeader title={t('Comments on your policies')} subtitle={t('Newest first.')} />
      {commented.length === 0 ? (
        <EmptyState icon="chatbox-ellipses-outline" message={t('No comments on your policies yet.')} />
      ) : (
        commented.map((p) => (
          <Card key={p.id} onPress={() => router.push(`/candidate/${profile.uid}/${p.id}`)}>
            <ThemedText type="smallBold" style={{ fontSize: 15, lineHeight: 21 }}>
              {p.title}
            </ThemedText>
            {p.lastComment ? (
              <ThemedText type="small" numberOfLines={3} style={{ fontSize: 14, lineHeight: 20 }}>
                <ThemedText type="small" style={{ fontSize: 14, lineHeight: 20, fontWeight: '700' }}>
                  {`${p.lastComment.authorName}: `}
                </ThemedText>
                {p.lastComment.excerpt}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
              {`${plural(p.commentCount, 'comment')} · ${timeAgo(p.lastCommentAt ?? null)}`}
            </ThemedText>
          </Card>
        ))
      )}

      <SectionHeader title={t('Your card')} />
      <CandidateCardEditor candidate={candidate} />
      <Button
        title={t('View your public page')}
        variant="ghost"
        onPress={() => router.push(`/candidate/${candidate.uid}`)}
      />

      <SectionHeader title={t('Your platform')} />
      <SyncCard candidate={candidate} />
      <Button
        title={t('Add a policy')}
        variant="secondary"
        onPress={() => router.push({ pathname: '/edit-policy', params: { nextOrder: String(nextOrder) } })}
      />
      {policies.map((p) => (
        <Card
          key={p.id}
          onPress={() =>
            router.push({ pathname: '/edit-policy', params: { candidateId: profile.uid, policyId: p.id } })
          }>
          <View style={styles.policyRow}>
            <ThemedText type="smallBold" style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>
              {p.title}
            </ThemedText>
            <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
          </View>
          <View style={styles.metaRow}>
            {p.archived && <Chip label={t('Hidden')} tone="warning" icon="eye-off" />}
            {p.source === 'site' && <Chip label={t('Imported')} icon="globe-outline" />}
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
              {plural(p.commentCount, 'comment')}
            </ThemedText>
          </View>
        </Card>
      ))}
    </>
  );
}

// ── Shared sections ────────────────────────────────────────────────────

/** Put a question to the public, then every poll: open ones, then closed. */
function PollsSection({ profile }: { profile: UserProfile }) {
  const t = useT();
  const router = useRouter();
  const { data: polls, loading } = useLiveQuery<Poll>(
    () =>
      query(collection(db, 'polls'), where('authorUid', '==', profile.uid), orderBy('createdAt', 'desc')),
    [profile.uid]
  );
  const open = polls.filter((p) => p.open);
  const closed = polls.filter((p) => !p.open);
  const hasWard = profile.role === 'official' && profile.wardId != null;

  return (
    <>
      <SectionHeader title={t('Polls')} subtitle={t('Put a question to the public. Everyone votes; verified residents are counted apart.')} />
      <View style={styles.pollButtons}>
        {hasWard && (
          <Button
            title={t('New ward poll')}
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/new-poll', params: { scope: 'ward' } })}
          />
        )}
        <Button
          title={t('New citywide poll')}
          variant={hasWard ? 'secondary' : 'primary'}
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/new-poll', params: { scope: 'city' } })}
        />
      </View>
      {loading ? (
        <SkeletonCards count={1} />
      ) : polls.length === 0 ? (
        <EmptyState icon="stats-chart-outline" message={t('Your polls will appear here.')} />
      ) : (
        <>
          {open.map((poll) => (
            <PollCard key={poll.id} poll={poll} manage />
          ))}
          {closed.length > 0 && (
            <>
              <SectionHeader title={`${t('Closed polls')} (${closed.length})`} />
              {closed.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

const ISSUE_LIMIT = 50;

/**
 * What people are raising, in rank order (verified residents' score), read
 * only. Concerns the politician has already commented on fold down.
 */
function IssuesSection({ profile, wardId }: { profile: UserProfile; wardId: number | null }) {
  const t = useT();
  const { data: concerns, loading } = useLiveQuery<Concern>(
    () =>
      wardId != null
        ? query(
            collection(db, 'concerns'),
            where('scope', '==', 'ward'),
            where('wardId', '==', wardId),
            orderBy('scoreVerified', 'desc'),
            orderBy('createdAt', 'desc'),
            limit(ISSUE_LIMIT)
          )
        : query(
            collection(db, 'concerns'),
            where('scope', '==', 'city'),
            orderBy('scoreVerified', 'desc'),
            orderBy('createdAt', 'desc'),
            limit(ISSUE_LIMIT)
          ),
    [wardId]
  );
  const commented = useMyGroupParents('comments', 'authorUid', profile.uid, 'concerns');

  return (
    <>
      <SectionHeader
        title={wardId != null ? t('{ward} issues').replace('{ward}', wardLabel(wardId)) : t('Citywide issues')}
        subtitle={t('Ranked by verified residents. The ones you’ve commented on fold down.')}
      />
      {loading ? (
        <SkeletonCards count={2} />
      ) : concerns.length === 0 ? (
        <EmptyState icon="megaphone-outline" message={t('No concerns raised here yet.')} />
      ) : (
        concerns.map((c, i) => (
          <IssueRow key={c.id} concern={c} rank={i + 1} commented={commented.ids.has(c.id)} />
        ))
      )}
      {concerns.length === ISSUE_LIMIT && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, textAlign: 'center' }}>
          {t('Showing the top {n}.').replace('{n}', String(ISSUE_LIMIT))}
        </ThemedText>
      )}
    </>
  );
}

/**
 * Ids of the parent documents under which this person wrote in a
 * subcollection: the concerns they commented on, the election questions
 * they answered. One collection-group query instead of one per row.
 */
function useMyGroupParents(
  group: 'comments' | 'answers',
  field: string,
  uid: string,
  parentCollection: string
): { ids: Set<string>; loading: boolean } {
  const [state, setState] = useState<{ key: string; ids: Set<string> } | null>(null);
  const key = `${group}:${field}:${uid}`;
  useEffect(() => {
    return onSnapshot(
      query(collectionGroup(db, group), where(field, '==', uid)),
      (snap) => {
        const ids = new Set<string>();
        for (const d of snap.docs) {
          const parent = d.ref.parent.parent;
          if (parent && parent.parent.id === parentCollection) ids.add(parent.id);
        }
        setState({ key, ids });
      },
      (err) => {
        console.warn('useMyGroupParents error:', err.message);
        setState({ key, ids: new Set() });
      }
    );
  }, [key, group, field, uid, parentCollection]);
  const fresh = state?.key === key;
  return { ids: fresh ? state.ids : new Set(), loading: !fresh };
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: Spacing.two,
    rowGap: 2,
  },
  joined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  folded: {
    gap: 4,
    paddingVertical: Spacing.two,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pollButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
