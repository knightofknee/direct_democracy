import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CandidateRow } from '@/components/politician-row';
import { DistrictsSection } from '@/components/districts-section';
import { JudgesSection } from '@/components/judges-section';
import { NovemberSection } from '@/components/november-section';
import { SchoolBoardSection } from '@/components/school-board-section';
import { ElectionQuestionJoin } from '@/components/upvote-pill';
import { WardRaceSection } from '@/components/ward-race-section';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, EmptyState, Field, SectionHeader, VerifiedBadge } from '@/components/ui';
import { daysUntil, nextMilestone } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useScreenRoom } from '@/hooks/use-screen-room';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { notify } from '@/lib/notify';
import type { Candidate, ElectionQuestion } from '@/lib/types';
import { askElectionQuestion } from '@/services/election';
import { useLocale, usePlural, useT } from '@/lib/i18n';

/**
 * The election tab: the voter's guide to the next two ballots. The race for
 * mayor leads (every candidate's full platform), then the mayoral AMA, the
 * school board, the rest of the November 3 ballot with how to vote, and the
 * February 2027 ward races. A 2x2 jump grid under the header, framed by the
 * flag's stripes, reaches each section.
 */
export default function ElectionScreen() {
  const theme = useTheme();
  const t = useT();
  const scrollRef = useRef<ScrollView>(null);
  const amaY = useRef(0);
  const schoolBoardY = useRef(0);
  const novemberY = useRef(0);
  const judgesY = useRef(0);
  const districtsY = useRef(0);
  const wardRacesY = useRef(0);

  const { data: candidates, loading } = useLiveQuery<Candidate & { id: string }>(
    () => query(collection(db, 'candidates'), orderBy('name')),
    []
  );

  return (
    <Screen tab ref={scrollRef}>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            {t('election')}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {t('Your next two ballots: who is running, what they say, and when and where to vote.')}
        </ThemedText>
        {/* The flag's stripes frame the jump grid; rows read as a timeline,
            the November 3 ballot on top, the February 2027 races below. */}
        <View style={{ alignSelf: 'stretch', gap: 8, marginTop: Spacing.one }}>
          <View style={[styles.flagStripe, { backgroundColor: theme.primarySoft }]} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2 }}>
            <GridCell
              label={t('nov 3 ballot')}
              caption={t('state & county races')}
              hint="the November 3 ballot"
              target={novemberY}
              scrollRef={scrollRef}
            />
            <GridCell
              label={t('school board')}
              caption={t('21 seats on nov 3')}
              hint="the school board races"
              target={schoolBoardY}
              scrollRef={scrollRef}
            />
            <GridCell
              label={t('judges')}
              caption={t('retention & vacancies')}
              hint="the judicial ballot"
              target={judgesY}
              scrollRef={scrollRef}
            />
            <GridCell
              label={t('your districts')}
              caption={t('congress & state')}
              hint="the district races"
              target={districtsY}
              scrollRef={scrollRef}
            />
            <GridCell
              label={t('mayoral ama')}
              caption={t('ask every candidate')}
              hint="the mayoral candidate AMA"
              target={amaY}
              scrollRef={scrollRef}
            />
            <GridCell
              label={t('ward races')}
              caption={t('aldermen & police')}
              hint="the February 2027 ward races"
              target={wardRacesY}
              scrollRef={scrollRef}
            />
          </View>
          <View style={[styles.flagStripe, { backgroundColor: theme.primarySoft }]} />
        </View>
        <NextDeadline onPress={() => scrollRef.current?.scrollTo({ y: novemberY.current, animated: true })} />
      </View>

      <SectionHeader
        title={t('race for mayor')}
        subtitle={t("Every candidate's full platform, debated plank by plank.")}
      />

      {loading ? (
        <SkeletonCards />
      ) : candidates.length === 0 ? (
        <EmptyState icon="ribbon-outline" message={t('No candidates on the platform yet.')} />
      ) : (
        // Real candidates first (alphabetical), the declared-candidates
        // directory entry at the end.
        [...candidates.filter((c) => !c.directory), ...candidates.filter((c) => c.directory)].map(
          (candidate, i) => (
            <Animated.View
              key={candidate.uid}
              entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}>
              <CandidateRow candidate={candidate} />
            </Animated.View>
          )
        )
      )}

      <View
        onLayout={(e) => {
          // layout.y is relative to the Screen shell's inner view, which sits
          // at contentContainer paddingTop (insets.top + spacing). Landing at
          // layout.y + spacing puts the section header just under the status
          // bar instead of behind it.
          amaY.current = e.nativeEvent.layout.y + Spacing.three;
        }}>
        <ElectionAma />
      </View>

      <View
        onLayout={(e) => {
          schoolBoardY.current = e.nativeEvent.layout.y + Spacing.three;
        }}>
        <SchoolBoardSection />
      </View>

      <View
        onLayout={(e) => {
          novemberY.current = e.nativeEvent.layout.y + Spacing.three;
        }}>
        <NovemberSection />
      </View>

      <View
        onLayout={(e) => {
          judgesY.current = e.nativeEvent.layout.y + Spacing.three;
        }}>
        <JudgesSection />
      </View>

      <View
        onLayout={(e) => {
          districtsY.current = e.nativeEvent.layout.y + Spacing.three;
        }}>
        <DistrictsSection />
      </View>

      <View
        onLayout={(e) => {
          wardRacesY.current = e.nativeEvent.layout.y + Spacing.three;
        }}>
        <WardRaceSection />
      </View>
    </Screen>
  );
}

/**
 * The next voting deadline, counted down from today, so the dates buried in
 * the how-to-vote card have a presence at the top of the tab. Two centered
 * lines, each a complete sentence with units ("Early voting starts in 22
 * days" over "55 days until election day") - never a wrapping fragment.
 * Tapping lands on that card. Renders nothing once every milestone is past.
 */
function NextDeadline({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const t = useT();
  const { locale } = useLocale();
  const next = nextMilestone(new Date());
  if (!next) return null;
  const days = daysUntil(next.date, new Date());
  const when =
    days === 0 ? t('today') : days === 1 ? t('tomorrow') : locale === 'es' ? `en ${days} días` : `in ${days} days`;
  const headline = `${t(next.label)} ${when}`;
  // The second line only exists when the milestone isn't election day
  // itself, and names which election it counts to.
  const municipal = next.election === '2027-02-23';
  const electionLine =
    next.electionDays != null && next.electionDays !== days
      ? `${next.electionDays} ${t(
          next.electionDays === 1
            ? municipal
              ? 'day until the municipal election'
              : 'day until the general election'
            : municipal
              ? 'days until the municipal election'
              : 'days until the general election'
        )}`
      : null;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${electionLine ?? ''}`}
      style={{ alignSelf: 'stretch', alignItems: 'center', gap: 2, marginTop: Spacing.one }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name="time-outline" size={14} color={theme.primary} />
        <ThemedText
          type="smallBold"
          style={{ color: theme.primary, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
          {headline}
        </ThemedText>
      </View>
      {electionLine && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={{ fontSize: 12, lineHeight: 16, textAlign: 'center' }}>
          {electionLine}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** One cell of the 2x2 quick grid: where it goes, and one line of what's there. */
function GridCell({
  label,
  caption,
  hint,
  target,
  scrollRef,
}: {
  label: string;
  caption: string;
  hint: string;
  target: React.MutableRefObject<number>;
  scrollRef: React.RefObject<ScrollView | null>;
}) {
  const theme = useTheme();
  // Small phones and large system text (an older phone usually has both)
  // leave a cell about 60pt of text width. Nothing here is ever cut off:
  // both lines wrap. Before they have to, the decoration gives way: the
  // chevron costs 23pt, enough to push "your districts" onto two lines on a
  // 375pt iPhone, so only the widest phones keep it, and the narrowest give
  // up some padding as well.
  const { tight, roomy: chevron } = useScreenRoom();
  return (
    <Pressable
      onPress={() => scrollRef.current?.scrollTo({ y: target.current, animated: true })}
      accessibilityRole="button"
      accessibilityLabel={`Jump to ${hint}`}
      style={({ pressed }) => [
        styles.gridCell,
        tight && { paddingHorizontal: Spacing.two + 2, gap: 7 },
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Ionicons name="star" size={14} color={theme.accent} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText type="smallBold" style={{ fontSize: 14, lineHeight: 18 }}>
          {label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
          {caption}
        </ThemedText>
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flagStripe: {
    height: 3,
    borderRadius: 2,
  },
  gridCell: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: Spacing.three,
  },
});

/** One question, every candidate: propose questions, read answers side by side. */
function ElectionAma() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();
  const { profile, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

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
      router.push(`/election-question/${id}`);
    } catch (e) {
      notify('Could not post the question', e instanceof Error ? e.message : 'Something went wrong.');
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
          <Button
            title={t('Put it to the candidates')}
            onPress={ask}
            loading={saving}
            disabled={draft.trim().length < 10}
          />
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
          .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
          .map((q) => (
            <Card key={q.id} onPress={() => router.push(`/election-question/${q.id}`)}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
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
