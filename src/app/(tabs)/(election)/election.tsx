import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ContentActions } from '@/components/content-actions';
import { ElectionBand } from '@/components/election-band';
import { OfficialAvatar } from '@/components/avatar';
import { ConsensusCard, MayorTrivia, OnlyList, SplitList, StatusChip } from '@/components/mayor-games';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { ElectionQuestionJoin } from '@/components/upvote-pill';
import { WardRaceSection } from '@/components/ward-race-section';
import { DailyLimitNote } from '@/components/ward-post-note';
import {
  daysUntil,
  HOW_TO_VOTE_2027,
  MUNICIPAL_ELECTION_DATE,
  nextMilestone,
  VOTER_LOOKUP_URL,
  VOTING_HELP,
} from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { useLocalized, usePlural, useT } from '@/lib/i18n';
import {
  inTheRace,
  MAYOR_GAMES,
  randomSeed,
  secondDates,
  shuffledBy,
  useBlindMemory,
  useMayorGames,
  type MayorGame,
} from '@/lib/mayor-games';
import { enter } from '@/lib/motion';
import { errorMessage, notify } from '@/lib/notify';
import { openLink } from '@/lib/open-link';
import { usePageSummary } from '@/lib/page-help';
import { offerPush } from '@/lib/push-offer';
import { useRateWindow } from '@/lib/rate-limits';
import type { ElectionQuestion } from '@/lib/types';
import { askElectionQuestion } from '@/services/election';

/**
 * The elections tab, led by the mayor games (2026-11-04, replacing the
 * two-ballot tab once the November 3 election was over; the app opens here
 * since 2026-11-09). Blind date is the hero, the other three games sit
 * under it, then the people this phone said it would see again, then the
 * rest of the February ballot: how to vote, the question every candidate
 * answers, the other races, and everyone running, in a random order.
 */
export default function ElectionScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const loc = useLocalized();
  const scrollRef = useRef<ScrollView>(null);
  // Jump targets are measured when tapped, relative to the wrapper that
  // holds the whole tab (the web's onLayout misses position-only changes).
  const contentRef = useRef<View>(null);
  const voteRef = useRef<View>(null);
  const jumpTo = (target: React.RefObject<View | null>) => {
    const content = contentRef.current;
    if (!content) return;
    target.current?.measureLayout(content, (_x, y) =>
      scrollRef.current?.scrollTo({ y: y + Spacing.three, animated: true })
    );
  };

  const { data: games, loading } = useMayorGames();
  // Random and fixed for as long as the tab is mounted (no one is always
  // listed first, and the list never reshuffles under the reader).
  const [shuffleSeed] = useState(randomSeed);
  const field = games ? shuffledBy(inTheRace(games.candidates), shuffleSeed) : [];
  const memory = useBlindMemory();
  const liked = secondDates(field, memory.verdicts);
  const hasTrivia = (games?.trivia?.length ?? 0) > 0;

  const next = nextMilestone(new Date());
  const nextIn = next ? daysUntil(next.date, new Date()) : null;
  usePageSummary('(tabs)/election', [
    next &&
      nextIn != null &&
      `${t(next.label)} ${
        nextIn === 0 ? t('today') : nextIn === 1 ? t('tomorrow') : t('in {n} days').replace('{n}', String(nextIn))
      }. ${t(next.detail)}`,
    !loading && t('Candidates in the race: {n}.').replace('{n}', String(field.length)),
    games && t('Data checked {date}.').replace('{date}', games.asOf),
  ]);

  return (
    <Screen tab ref={scrollRef}>
      <View ref={contentRef} style={{ gap: Spacing.three }}>
        <View style={{ gap: Spacing.one, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ChicagoStar size={18} />
            <ThemedText type="subtitle" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>
              {t('the mayor games')}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {loading
              ? t('Everyone running for mayor on February 23, 2027. Meet them one game at a time.')
              : t('{n} people want to be mayor on February 23, 2027. Meet them one game at a time.').replace(
                  '{n}',
                  String(field.length)
                )}
          </ThemedText>
        </View>

        <View style={{ gap: Spacing.two + 2 }}>
          {MAYOR_GAMES.map((g, i) => (
            <GameCell key={g.kind} kind={g.kind} index={i} onPress={() => router.push(`/game/${g.kind}`)} />
          ))}
        </View>

        {liked.length > 0 && (
          <View style={{ gap: Spacing.two }}>
            <ThemedText
              type="smallBold"
              themeColor="textSecondary"
              accessibilityRole="header"
              style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('your second dates')}
            </ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              {liked.map((c) => (
                <Pressable
                  key={c.slug}
                  onPress={() => router.push(`/mayor/${c.slug}`)}
                  accessibilityRole="link"
                  accessibilityLabel={c.name}
                  style={({ pressed }) => [
                    styles.secondDate,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <OfficialAvatar name={c.name} photoUrl={c.photoUrl} frame={c.photoFrame} size={28} />
                  <ThemedText type="smallBold" style={{ fontSize: 13 }}>
                    {c.shortName}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {t('Picked on a blind date, on their ideas alone. Kept on this phone only.')}
            </ThemedText>
          </View>
        )}

        {/* Small on purpose: a breather before the splits, never a rival to them. */}
        {hasTrivia && <MayorTrivia items={games!.trivia!} />}

        {/* Right under the trivia card the header gives up some of its top
            space (20 points instead of 32): the card is a quiet box and
            its last line is small print (Brian, 2026-11-10). */}
        {games && games.splits?.length > 0 && (
          <View style={{ gap: Spacing.two + 2, marginTop: hasTrivia ? -(Spacing.two + 4) : 0 }}>
            <SectionHeader
              title={t('where they split')}
              subtitle={t('The questions that divide the field, and who stands where. Tap a name for their page.')}
            />
            <SplitList doc={games} seed={shuffleSeed} />
            <SectionHeader
              title={t('only one of them would')}
              subtitle={t('Proposals no other candidate makes.')}
            />
            <OnlyList doc={games} seed={shuffleSeed} />
            <ConsensusCard doc={games} />
          </View>
        )}

        <NextDeadline onPress={() => jumpTo(voteRef)} />

        <ElectionBand>
          <View ref={voteRef}>
            <HowToVote />
          </View>
          <ElectionAma />
          <WardRaceSection />
          <SectionHeader
            title={t('everyone running for mayor')}
            subtitle={t('In a random order, so no one is always listed first. Tap a name for everything the games know.')}
          />
          {loading ? (
            <SkeletonCards count={2} />
          ) : field.length === 0 ? (
            <EmptyState icon="people-outline" message={t('No candidates in the race yet.')} />
          ) : (
            field.map((c, i) => (
              <Animated.View key={c.slug} entering={enter(FadeInDown.duration(280).delay(Math.min(i, 8) * 45))}>
                <Card onPress={() => router.push(`/mayor/${c.slug}`)}>
                  <View style={styles.row}>
                    <OfficialAvatar name={c.name} photoUrl={c.photoUrl} frame={c.photoFrame} size={44} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                        {c.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                        {loc(c.title, c.titleEs)}
                      </ThemedText>
                      <View style={{ flexDirection: 'row' }}>
                        <StatusChip candidate={c} />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </View>
                </Card>
              </Animated.View>
            ))
          )}
        </ElectionBand>
      </View>
    </Screen>
  );
}

/**
 * One game. Blind date, the first, is the hero: a full card with its own
 * "Play" button. The other three are rows under it, each a whole tap
 * target with its one line on what it does.
 */
function GameCell({ kind, index, onPress }: { kind: MayorGame; index: number; onPress: () => void }) {
  const theme = useTheme();
  const t = useT();
  const game = MAYOR_GAMES.find((g) => g.kind === kind)!;
  const hero = index === 0;
  return (
    <Animated.View entering={enter(FadeInDown.duration(280).delay(index * 60))}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${t(game.title)}. ${t(game.tagline)}`}
        style={({ pressed }) => [
          hero ? styles.hero : styles.gameRow,
          {
            backgroundColor: hero ? theme.accent : theme.februaryBand,
            borderColor: hero ? theme.accent : theme.border,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}>
        {hero ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <Ionicons name={game.icon} size={28} color="#FFFFFF" />
              <ThemedText type="smallBold" style={{ fontSize: 22, lineHeight: 28, color: '#FFFFFF' }}>
                {t(game.title)}
              </ThemedText>
            </View>
            <ThemedText style={{ color: '#FFFFFF' }}>{t(game.tagline)}</ThemedText>
            <View style={styles.play}>
              <Ionicons name="play" size={14} color={theme.accent} />
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                {t('Play')}
              </ThemedText>
            </View>
          </>
        ) : (
          <>
            <Ionicons name={game.icon} size={24} color={theme.accent} />
            <View style={{ flex: 1, gap: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 16, lineHeight: 20 }}>
                {t(game.title)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                {t(game.tagline)}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * The next voting date, counted down from today. Two centered lines, each
 * a complete sentence with units ("Mail ballot applications open in 21
 * days" over "111 days until the municipal election"), never a wrapping
 * fragment. Tapping lands on the how-to-vote card. Renders nothing once
 * every milestone is past.
 */
function NextDeadline({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const t = useT();
  const next = nextMilestone(new Date());
  if (!next) return null;
  const days = daysUntil(next.date, new Date());
  const when =
    days === 0 ? t('today') : days === 1 ? t('tomorrow') : t('in {n} days').replace('{n}', String(days));
  const headline = `${t(next.label)} ${when}`;
  const runoff = next.election === '2027-04-06';
  const electionLine =
    next.electionDays != null && next.electionDays !== days
      ? `${next.electionDays} ${t(
          next.electionDays === 1
            ? runoff
              ? 'day until the runoff'
              : 'day until the municipal election'
            : runoff
              ? 'days until the runoff'
              : 'days until the municipal election'
        )}`
      : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={t('Jumps to when and where to vote')}
      style={({ pressed }) => [styles.deadline, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name="calendar-outline" size={16} color={theme.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold" style={{ fontSize: 14, lineHeight: 18, textAlign: 'center' }}>
          {headline}
        </ThemedText>
        {electionLine && (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16, textAlign: 'center' }}>
            {electionLine}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

/**
 * When and where to vote in February: only what the Board of Elections has
 * posted so far (HOW_TO_VOTE_2027), with the links that will carry the
 * rest, and the accessibility, language, and poll-worker help folded under
 * "More help voting".
 */
function HowToVote() {
  const t = useT();
  const [more, setMore] = useState(false);
  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('when and where to vote')}
        subtitle={`${t('Election day is {date}.').replace('{date}', t(HOW_TO_VOTE_2027.electionDay))} ${t(HOW_TO_VOTE_2027.runoff)}`}
      />
      <Card>
        <VoteLine icon="time-outline" text={`${t('Polls are open')} ${t(HOW_TO_VOTE_2027.pollingHours)} ${t('on')} ${t(MUNICIPAL_ELECTION_DATE)}.`} />
        <VoteLine icon="mail-outline" text={t(HOW_TO_VOTE_2027.voteByMail.detail)} url={HOW_TO_VOTE_2027.voteByMail.url} />
        <VoteLine icon="walk-outline" text={t(HOW_TO_VOTE_2027.earlyVoting.detail)} url={HOW_TO_VOTE_2027.earlyVoting.url} />
        <VoteLine icon="create-outline" text={t(HOW_TO_VOTE_2027.register.detail)} url={HOW_TO_VOTE_2027.register.url} />
        <VoteLine icon="search-outline" text={t('Check your registration, see your sample ballot, and find your polling place.')} url={VOTER_LOOKUP_URL} />
        <Button
          title={t(more ? 'Less help voting' : 'More help voting')}
          variant="ghost"
          expanded={more}
          onPress={() => setMore((v) => !v)}
        />
        {more &&
          VOTING_HELP.map((h) => <VoteLine key={h.key} icon={h.icon} text={t(h.text)} url={h.url} />)}
      </Card>
    </View>
  );
}

/** One line of the how-to-vote card: an icon and its text, a link when it has a url. */
function VoteLine({ icon, text, url }: { icon: keyof typeof Ionicons.glyphMap; text: string; url?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={url ? () => void openLink(url) : undefined}
      accessibilityRole={url ? 'link' : undefined}
      style={styles.row}>
      <Ionicons name={icon} size={16} color={theme.primary} style={{ marginTop: 2 }} />
      <ThemedText type="small" style={[{ flex: 1, fontSize: 13, lineHeight: 19 }, url && { color: theme.primary }]}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

/** One question, every candidate: propose questions, read answers side by side. */
function ElectionAma() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();
  const { profile, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const askOpensAt = useRateWindow('electionQuestions');
  const { isBlocked } = useBlocks();

  const { data: questions, loading } = useLiveQuery<ElectionQuestion>(
    () => query(collection(db, 'electionQuestions'), orderBy('createdAt', 'desc')),
    []
  );

  const ask = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    setSaving(true);
    try {
      const id = await askElectionQuestion(profile, draft);
      setDraft('');
      void offerPush(profile, 'answers');
      router.push(`/election-question/${id}`);
    } catch (e) {
      notify(t('Could not post the question'), errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('mayoral candidate ama')}
        subtitle={t('One question, every candidate on the record. Answers land side by side, ranked by your votes.')}
      />

      <Card>
        <Field
          placeholder={t('Ask every candidate at once…')}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
        />
        {profile || authLoading ? (
          <>
            <DailyLimitNote bucket="electionQuestions" nextAt={askOpensAt} />
            <Button
              title={t('Put it to the candidates')}
              onPress={ask}
              loading={saving}
              disabled={draft.trim().length < 10 || askOpensAt != null}
            />
          </>
        ) : (
          <Button
            title={t('Sign in to ask')}
            variant="secondary"
            onPress={() => router.push('/sign-in')}
          />
        )}
      </Card>

      {loading ? (
        <SkeletonCards count={2} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          message={t('No questions yet. Ask the first one and put the whole field on the record.')}
        />
      ) : (
        // The questions people join lead the list (recency breaks ties via
        // the stable sort over the newest-first query): upvoting an existing
        // question beats re-asking it.
        [...questions]
          .filter((q) => !isBlocked(q.authorUid))
          .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
          .map((q) => (
            // The card holds the join and report buttons, so it is not one
            // screen reader element; the question is the link that opens it.
            <Card key={q.id} onPress={() => router.push(`/election-question/${q.id}`)} accessible={false}>
              <ThemedText
                type="smallBold"
                style={{ fontSize: 15 }}
                accessibilityRole="link"
                onPress={() => router.push(`/election-question/${q.id}`)}>
                {q.body}
              </ThemedText>
              {/* Wraps on a narrow screen rather than cutting the name or
                  time; the answer count gets its own line below. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two }}>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, flexShrink: 1 }}>
                  {q.authorName} · {timeAgo(q.createdAt)}
                </ThemedText>
                {q.authorVerified && <VerifiedBadge compact />}
                <View style={{ flexGrow: 1 }} />
                <ElectionQuestionJoin question={q} />
                <ContentActions
                  contentPath={`electionQuestions/${q.id}`}
                  contentType="electionQuestion"
                  excerpt={q.body}
                  authorUid={q.authorUid}
                  authorName={q.authorName}
                />
              </View>
              {q.answerCount > 0 && (
                <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 12 }}>
                  {pluralT(q.answerCount, 'candidate has answered', 'candidates have answered')}
                </ThemedText>
              )}
            </Card>
          ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  hero: {
    gap: Spacing.two,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
  },
  play: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three + 2,
    marginTop: Spacing.one,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  secondDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: Spacing.three,
  },
  deadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
});
