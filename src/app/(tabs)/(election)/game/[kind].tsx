import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { FlipAvatar, GameStage, RoundAction, RoundMarks } from '@/components/game-stage';
import { HostLine, QuoteBlock, SplitList } from '@/components/mayor-games';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { SummaryChunks } from '@/components/summary-chunks';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useLocalized, useT } from '@/lib/i18n';
import { host } from '@/lib/format';
import {
  cheapDateOrder,
  cheapMeasure,
  costPerPoint,
  dealLines,
  endBlindDate,
  fieldSpending,
  inTheRace,
  loadBestStreak,
  MAYOR_GAMES,
  money,
  pickBlindDate,
  pizzaGroups,
  randomSeed,
  saveBestStreak,
  secondDates,
  setBlindVerdict,
  shuffledBy,
  startBlindRound,
  supportPerMillion,
  useBlindMemory,
  useMayorGames,
  type BlindVerdict,
  type CheapSort,
  type LineQuestion,
  type MayorCandidate,
  type MayorGamesDoc,
} from '@/lib/mayor-games';
import { enter } from '@/lib/motion';
import { openLink } from '@/lib/open-link';
import { usePageSummary } from '@/lib/page-help';

/**
 * One of the mayor games (2026-11-04; the two dates rebuilt as phone games
 * and Pick-up lines added 2026-11-09). The same field of candidates
 * (mayorGames/2027) in five shapes. Blind date, pick-up lines, and speed
 * date play on a fixed stage (GameStage:
 * who you are with on top, the card in the middle, the buttons under the
 * thumb), so nothing a date needs is ever a scroll away. Cheap date and
 * pizza date are rankings, which are lists, so they scroll like one.
 */
export default function MayorGameScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const t = useT();
  const game = MAYOR_GAMES.find((g) => g.kind === kind);
  const { data, loading } = useMayorGames();
  const field = data ? inTheRace(data.candidates) : [];

  usePageSummary('game/[kind]', [
    game && `${t(game.title)}: ${t(game.tagline)}`,
    data && t('Candidates in the race: {n}.').replace('{n}', String(field.length)),
    data && t('Data checked {date}.').replace('{date}', data.asOf),
  ]);

  if (!game) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" message={t('Game not found.')} />
      </Screen>
    );
  }
  const title = <Stack.Screen options={{ title: t(game.title) }} />;
  if (loading || !data || field.length === 0) {
    return (
      <Screen>
        {title}
        {loading || !data ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="people-outline" message={t('No candidates in the race yet.')} />
        )}
      </Screen>
    );
  }
  if (game.kind === 'blind') {
    return (
      <>
        {title}
        <BlindDate field={field} />
      </>
    );
  }
  if (game.kind === 'lines') {
    return (
      <>
        {title}
        <PickupLines field={field} />
      </>
    );
  }
  if (game.kind === 'speed') {
    return (
      <>
        {title}
        <SpeedDate field={field} doc={data} />
      </>
    );
  }
  return (
    <Screen>
      {title}
      {game.kind === 'cheap' ? <CheapDate doc={data} /> : <PizzaDate doc={data} />}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Blind date

/**
 * The ideas first, the name after. A mystery candidate's key points sit on
 * the card; you say whether you would see them again (or pass, or just
 * look), and that one tap turns the portrait over to show who it was. The
 * verdict is the game: it is given blind, on the ideas alone. This phone
 * keeps the round (everyone is met once before anyone comes back) and the
 * second dates, and sends neither anywhere.
 */
function BlindDate({ field }: { field: MayorCandidate[] }) {
  const t = useT();
  const loc = useLocalized();
  const router = useRouter();
  const theme = useTheme();
  const memory = useBlindMemory();
  // On a short phone the buttons give height back to the card.
  const big = useWindowDimensions().height < 640 ? 52 : 60;
  const [current, setCurrent] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [over, setOver] = useState(false);
  const [dates, setDates] = useState(0);

  // The first date of this visit, once the phone's memory is read. Set
  // while drawing (React's pattern for state that follows other state),
  // keyed by the field's size: a candidate dropping in or out starts a
  // fresh pick, an edited quote does not.
  const [pickedFor, setPickedFor] = useState<number | null>(null);
  if (memory.ready && pickedFor !== field.length) {
    setPickedFor(field.length);
    if (!current && !over) {
      const pick = pickBlindDate(field, memory.seen, null);
      if (pick) setCurrent(pick);
      else setOver(true);
    }
  }

  const candidate = field.find((c) => c.slug === current) ?? null;
  const met = memory.seen.filter((s) => field.some((c) => c.slug === s));
  const marks: ('yes' | 'no' | 'met' | 'now')[] = met.map((s) => memory.verdicts[s] ?? 'met');
  if (candidate && !met.includes(candidate.slug)) marks.push('now');

  const reveal = (verdict: BlindVerdict | null) => {
    if (!candidate || revealed) return;
    if (verdict === 'yes') successHaptic();
    else tapHaptic();
    endBlindDate(candidate.slug, verdict);
    setRevealed(true);
  };
  const next = () => {
    const pick = pickBlindDate(field, memory.seen, current);
    setRevealed(false);
    setDates((n) => n + 1);
    if (pick) setCurrent(pick);
    else {
      setCurrent(null);
      setOver(true);
    }
  };
  const again = () => {
    startBlindRound();
    setOver(false);
    setRevealed(false);
    setCurrent(pickBlindDate(field, [], null));
  };

  if (over) {
    const liked = secondDates(field, memory.verdicts);
    return (
      <GameStage
        cardKey="over"
        top={
          <>
            <RoundMarks total={field.length} states={marks} />
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.headline}>
              {t('You met the whole field.')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {liked.length > 0
                ? t('On their ideas alone, you would see these again:')
                : t('No second dates this round. Tough crowd.')}
            </ThemedText>
          </>
        }
        bottom={
          <>
            <Button
              title={t('Go again')}
              icon={<Ionicons name="refresh" size={16} color="#FFFFFF" />}
              onPress={again}
            />
            <Button
              title={t('Compare them on a speed date')}
              variant="secondary"
              onPress={() => router.replace('/game/speed')}
            />
          </>
        }>
        {liked.map((c) => (
          <Card key={c.slug} onPress={() => router.push(`/mayor/${c.slug}`)}>
            <View style={styles.identity}>
              <OfficialAvatar name={c.name} photoUrl={c.photoUrl} frame={c.photoFrame} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                  {c.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {loc(c.title, c.titleEs)}
                </ThemedText>
              </View>
              <Ionicons name="heart" size={18} color={theme.accent} />
            </View>
          </Card>
        ))}
      </GameStage>
    );
  }

  if (!candidate) {
    return (
      <Screen>
        <SkeletonCards count={1} />
      </Screen>
    );
  }

  const verdict = memory.verdicts[candidate.slug] ?? null;
  return (
    <GameStage
      cardKey={candidate.slug}
      // Before the reveal a swipe is a verdict; after it, a swipe moves on.
      onSwipeLeft={revealed ? next : () => reveal('no')}
      onSwipeRight={revealed ? undefined : () => reveal('yes')}
      leftStamp={revealed ? t('Next date') : t('Pass')}
      rightStamp={revealed ? undefined : t('Second date')}
      flyOut={revealed}
      top={
        <>
          <RoundMarks total={field.length} states={marks} />
          <View style={styles.identity}>
            <FlipAvatar candidate={candidate} revealed={revealed} />
            <View style={{ flex: 1, gap: 2 }}>
              {revealed ? (
                <Unveiled key={candidate.slug}>
                  <ThemedText type="smallBold" style={styles.name}>
                    {candidate.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {loc(candidate.title, candidate.titleEs)}
                  </ThemedText>
                  <StatLine candidate={candidate} />
                  {verdict && (
                    <View style={styles.verdict}>
                      <Ionicons
                        name={verdict === 'yes' ? 'heart' : 'close'}
                        size={13}
                        color={verdict === 'yes' ? theme.accent : theme.textSecondary}
                      />
                      <ThemedText
                        type="smallBold"
                        style={{ fontSize: 12, color: verdict === 'yes' ? theme.accent : theme.textSecondary }}>
                        {t(verdict === 'yes' ? 'Second date' : 'You passed')}
                      </ThemedText>
                    </View>
                  )}
                </Unveiled>
              ) : (
                <>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
                    {t('Date {n} of {total}')
                      .replace('{n}', String(marks.length))
                      .replace('{total}', String(field.length))}
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.name}>
                    {t('Mystery candidate')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Would you see them again?')}
                  </ThemedText>
                </>
              )}
            </View>
          </View>
        </>
      }
      bottom={
        revealed ? (
          <>
            <View style={styles.controls}>
              <View style={styles.side}>
                <RoundAction
                  icon={verdict === 'yes' ? 'heart' : 'heart-outline'}
                  label={t('Second date')}
                  tone="accent"
                  size={48}
                  filled={verdict === 'yes'}
                  onPress={() => {
                    tapHaptic();
                    setBlindVerdict(candidate.slug, verdict === 'yes' ? 'no' : 'yes');
                  }}
                />
              </View>
              <Button
                title={t('Next date')}
                icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
                onPress={next}
                style={{ flex: 1 }}
              />
            </View>
            <TextLink
              label={t('Everything about {name}').replace('{name}', candidate.shortName)}
              onPress={() => router.push(`/mayor/${candidate.slug}`)}
            />
          </>
        ) : (
          <View style={styles.controls}>
            <RoundAction icon="close" label={t('Pass')} size={big} onPress={() => reveal('no')} />
            <RoundAction icon="eye-outline" label={t('Just reveal')} tone="primary" size={big - 12} onPress={() => reveal(null)} />
            <RoundAction icon="heart" label={t('Second date')} tone="accent" size={big} filled onPress={() => reveal('yes')} />
          </View>
        )
      }>
      <HostLine index={dates} />
      <Points candidate={candidate} sealed={!revealed} />
    </GameStage>
  );
}

/** The name arriving where "Mystery candidate" was: a short rise and fade, timed with the portrait's turn. */
function Unveiled({ children, delay = 200 }: { children: React.ReactNode; delay?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration: delay ? 320 : 180, easing: Easing.out(Easing.cubic) }));
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 8 }] }));
  return <Animated.View style={[{ gap: 2 }, style]}>{children}</Animated.View>;
}

/** The candidate's key points, each its own block, landing a beat apart. */
function Points({ candidate, sealed }: { candidate: MayorCandidate; sealed?: boolean }) {
  const theme = useTheme();
  const loc = useLocalized();
  return (
    <>
      {candidate.points.map((p, i) => (
        <Animated.View
          key={`${candidate.slug}-${i}`}
          entering={enter(FadeInDown.duration(260).delay(i * 70))}
          style={[styles.point, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText style={{ fontWeight: '600' }}>{loc(p.text, p.textEs)}</ThemedText>
          {p.quote ? <QuoteBlock quote={p.quote} sealed={sealed} /> : null}
        </Animated.View>
      ))}
    </>
  );
}

/**
 * Where a candidate stands, in one line under the name: poll support and
 * money spent, the two numbers people ask for first. Nothing when neither
 * is on record.
 */
function StatLine({ candidate: c }: { candidate: MayorCandidate }) {
  const t = useT();
  const spent = c.finance?.spent;
  const pct = c.support?.pct;
  if (spent == null && pct == null) return null;
  const text =
    spent == null
      ? t('{pct}% in the poll').replace('{pct}', String(pct))
      : pct != null
        ? t('{pct}% support · {spent} spent').replace('{pct}', String(pct)).replace('{spent}', money(spent))
        : t('Not listed in the poll · {spent} spent').replace('{spent}', money(spent));
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
      {text}
    </ThemedText>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 2 }}>
      <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Speed date

const SPEED_SECONDS = 60;

/**
 * The whole field, a minute each, in a random order fixed for this visit.
 * The clock runs down and rings; it never throws anyone out. The card has
 * two sides, what sets this one apart and where they stand on the
 * questions that split the field, and a swipe moves along the table.
 */
function SpeedDate({ field, doc }: { field: MayorCandidate[]; doc: MayorGamesDoc }) {
  const t = useT();
  const loc = useLocalized();
  const router = useRouter();
  const theme = useTheme();
  const [seed] = useState(randomSeed);
  const order = shuffledBy(field, seed);
  const [i, setI] = useState(0);
  const [side, setSide] = useState<'main' | 'compare'>('main');
  const [over, setOver] = useState(false);
  const [left, setLeft] = useState(SPEED_SECONDS);
  const bar = useSharedValue(1);

  // The clock and the card's side start over in the handlers that change
  // the date (`go`); this effect only runs the bar and the ticking.
  useEffect(() => {
    if (over) return;
    bar.value = 1;
    bar.value = withTiming(0, { duration: SPEED_SECONDS * 1000, easing: Easing.linear });
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearInterval(id);
      cancelAnimation(bar);
    };
  }, [i, over, bar]);
  // The bell.
  useEffect(() => {
    if (left === 0) successHaptic();
  }, [left]);
  const fill = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  const candidate = order[Math.min(i, order.length - 1)];
  // Every move to a date starts its minute fresh, on the front of the card.
  const go = (to: number) => {
    setI(to);
    setLeft(SPEED_SECONDS);
    setSide('main');
  };
  const next = () => {
    if (i + 1 >= order.length) setOver(true);
    else go(i + 1);
  };
  const back = () => go(Math.max(0, i - 1));

  if (over) {
    return (
      <GameStage
        cardKey="over"
        top={
          <>
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.headline}>
              {t('That was everyone.')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('{n} dates. Now find out whose ideas you like when you cannot see the name.').replace(
                '{n}',
                String(order.length)
              )}
            </ThemedText>
          </>
        }
        bottom={
          <>
            <Button
              title={t('Go on a blind date')}
              icon={<Ionicons name="heart" size={16} color="#FFFFFF" />}
              onPress={() => router.replace('/game/blind')}
            />
            <Button
              title={t('Start over')}
              variant="secondary"
              onPress={() => {
                go(0);
                setOver(false);
              }}
            />
          </>
        }>
        <HostLine index={order.length} />
      </GameStage>
    );
  }

  const timeUp = left === 0;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <GameStage
      cardKey={`${candidate.slug}-${side}`}
      onSwipeLeft={next}
      onSwipeRight={i > 0 ? back : undefined}
      leftStamp={t('Next date')}
      rightStamp={i > 0 ? t('Back') : undefined}
      flyOut
      top={
        <>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <Animated.View
              style={[styles.trackFill, { backgroundColor: left <= 10 ? theme.accent : theme.primary }, fill]}
            />
          </View>
          <View style={styles.between}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
              {t('Date {n} of {total}').replace('{n}', String(i + 1)).replace('{total}', String(order.length))}
            </ThemedText>
            <ThemedText
              type="smallBold"
              style={{ fontSize: 13, color: timeUp ? theme.accent : theme.textSecondary, fontVariant: ['tabular-nums'] }}>
              {timeUp ? t('Time. The next one is waiting.') : clock}
            </ThemedText>
          </View>
          <View style={styles.identity}>
            <OfficialAvatar name={candidate.name} photoUrl={candidate.photoUrl} frame={candidate.photoFrame} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold" style={styles.name}>
                {candidate.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {loc(candidate.title, candidate.titleEs)}
              </ThemedText>
              <StatLine candidate={candidate} />
            </View>
          </View>
          <View style={[styles.sides, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {(['main', 'compare'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSide(s)}
                accessibilityRole="tab"
                accessibilityState={{ selected: side === s }}
                style={[styles.sideTab, side === s && { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText
                  type="smallBold"
                  style={{ fontSize: 13, textAlign: 'center', color: side === s ? theme.text : theme.textSecondary }}>
                  {t(s === 'main' ? 'What sets them apart' : 'Where they split')}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </>
      }
      bottom={
        <>
          <View style={styles.controls}>
            <View style={styles.side}>
              <RoundAction icon="arrow-back" label={t('Back')} size={48} disabled={i === 0} onPress={back} />
            </View>
            <Button
              title={i + 1 >= order.length ? t('Finish') : t('Next date')}
              icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
              onPress={next}
              style={{ flex: 1 }}
            />
          </View>
          <TextLink
            label={t('Everything about {name}').replace('{name}', candidate.shortName)}
            onPress={() => router.push(`/mayor/${candidate.slug}`)}
          />
        </>
      }>
      <Animated.View key={`${candidate.slug}-${side}`} entering={enter(FadeIn.duration(200))} style={{ gap: Spacing.two + 2 }}>
        {side === 'main' ? (
          <>
            <HostLine index={i} />
            <SummaryChunks text={loc(candidate.summary, candidate.summaryEs) ?? ''} />
          </>
        ) : (
          <SplitList doc={doc} slug={candidate.slug} seed={seed} />
        )}
      </Animated.View>
    </GameStage>
  );
}

// ---------------------------------------------------------------------------
// Pick-up lines

const LINES_PER_ROUND = 10;

/**
 * Who said it (2026-11-09): one real quote fills the card, three faces sit
 * under it, and a tap answers. Right or wrong lands at once with who said
 * it, where, and what it was about, then on to the next line. Ten lines a
 * round, each candidate the answer once before anyone is the answer twice
 * (dealLines), so it teaches the whole field and not the loudest of it.
 * The only thing kept is the best streak, a number on this phone.
 */
function PickupLines({ field }: { field: MayorCandidate[] }) {
  const t = useT();
  const loc = useLocalized();
  const router = useRouter();
  const theme = useTheme();
  const [round, setRound] = useState<LineQuestion[]>(() => dealLines(field, LINES_PER_ROUND));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  useEffect(() => {
    void loadBestStreak().then(setBest);
  }, []);

  const question = round[Math.min(i, round.length - 1)];
  const bySlug = (slug: string) => field.find((c) => c.slug === slug)!;
  const marks: ('right' | 'wrong' | 'now')[] = results.map((r) => (r ? 'right' : 'wrong'));
  if (!over && picked == null) marks.push('now');

  const answer = (slug: string) => {
    if (picked) return;
    const right = slug === question.line.slug;
    if (right) successHaptic();
    else tapHaptic();
    setPicked(slug);
    setResults((r) => [...r, right]);
    const run = right ? streak + 1 : 0;
    setStreak(run);
    if (run > best) {
      setBest(run);
      saveBestStreak(run);
    }
  };
  const next = () => {
    setPicked(null);
    if (i + 1 >= round.length) setOver(true);
    else setI(i + 1);
  };
  const again = () => {
    setRound(dealLines(field, LINES_PER_ROUND));
    setI(0);
    setPicked(null);
    setResults([]);
    setOver(false);
  };

  if (round.length === 0) {
    return (
      <Screen>
        <EmptyState icon="chatbubble-ellipses-outline" message={t('No quotes on file yet.')} />
      </Screen>
    );
  }

  if (over) {
    const score = results.filter(Boolean).length;
    // The speakers of the lines that were missed, once each, in the order they came up.
    const missed = [...new Set(round.filter((_, n) => results[n] === false).map((q) => q.line.slug))].map(bySlug);
    return (
      <GameStage
        cardKey="over"
        top={
          <>
            <RoundMarks total={round.length} states={marks} />
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.headline}>
              {t('You got {n} of {total}.').replace('{n}', String(score)).replace('{total}', String(round.length))}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {missed.length > 0
                ? t('These ones got past you. Tap one to get to know them.')
                : t('A perfect round. You know the field.')}
              {best > 0 ? ` ${t('Best streak on this phone: {n}.').replace('{n}', String(best))}` : ''}
            </ThemedText>
          </>
        }
        bottom={
          <>
            <Button
              title={t('Play again')}
              icon={<Ionicons name="refresh" size={16} color="#FFFFFF" />}
              onPress={again}
            />
            <Button
              title={t('Go on a blind date')}
              variant="secondary"
              onPress={() => router.replace('/game/blind')}
            />
          </>
        }>
        {missed.map((c) => (
          <Card key={c.slug} onPress={() => router.push(`/mayor/${c.slug}`)}>
            <View style={styles.identity}>
              <OfficialAvatar name={c.name} photoUrl={c.photoUrl} frame={c.photoFrame} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                  {c.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {loc(c.title, c.titleEs)}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </View>
          </Card>
        ))}
      </GameStage>
    );
  }

  const speaker = bySlug(question.line.slug);
  const right = picked === question.line.slug;
  return (
    <GameStage
      cardKey={`line-${i}`}
      // Once answered, a swipe is "next"; before that the card stays put.
      onSwipeLeft={picked ? next : undefined}
      leftStamp={picked ? t('Next line') : undefined}
      flyOut
      top={
        <>
          <RoundMarks total={round.length} states={marks} />
          <View style={styles.between}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
              {t('Line {n} of {total}').replace('{n}', String(i + 1)).replace('{total}', String(round.length))}
            </ThemedText>
            <View style={styles.verdict}>
              <Ionicons name="flame" size={14} color={streak > 0 ? theme.highlight : theme.textSecondary} />
              <ThemedText
                type="smallBold"
                style={{ fontSize: 13, color: streak > 0 ? theme.highlight : theme.textSecondary }}>
                {t('Streak: {n}').replace('{n}', String(streak))}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="smallBold" style={styles.name}>
            {t('Who used this line?')}
          </ThemedText>
        </>
      }
      bottom={
        picked ? (
          <>
            <Unveiled key={`result-${i}`} delay={0}>
              <View
                style={[
                  styles.result,
                  {
                    borderColor: right ? theme.verified : theme.danger,
                    backgroundColor: right ? theme.verifiedSoft : theme.dangerSoft,
                  },
                ]}>
                <OfficialAvatar name={speaker.name} photoUrl={speaker.photoUrl} frame={speaker.photoFrame} size={40} />
                <View style={{ flex: 1, gap: 1 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 15, color: right ? theme.verified : theme.danger }}>
                    {t(right ? 'Right. {name} said it.' : 'No. {name} said it.').replace('{name}', speaker.name)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    {loc(speaker.title, speaker.titleEs)}
                  </ThemedText>
                </View>
                <Ionicons name={right ? 'checkmark-circle' : 'close-circle'} size={22} color={right ? theme.verified : theme.danger} />
              </View>
            </Unveiled>
            <Button
              title={i + 1 >= round.length ? t('See my score') : t('Next line')}
              icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
              onPress={next}
            />
            <TextLink
              label={t('Everything about {name}').replace('{name}', speaker.shortName)}
              onPress={() => router.push(`/mayor/${speaker.slug}`)}
            />
          </>
        ) : (
          question.options.map((slug) => {
            const c = bySlug(slug);
            return (
              <Pressable
                key={slug}
                onPress={() => answer(slug)}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                style={({ pressed }) => [
                  styles.choice,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundElement,
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}>
                <OfficialAvatar name={c.name} photoUrl={c.photoUrl} frame={c.photoFrame} size={36} />
                <ThemedText type="smallBold" style={{ flex: 1, fontSize: 16 }}>
                  {c.name}
                </ThemedText>
              </Pressable>
            );
          })
        )
      }>
      <Animated.View
        key={`quote-${i}`}
        entering={enter(FadeInDown.duration(240))}
        style={[styles.line, { backgroundColor: theme.februaryBand, borderColor: theme.border }]}>
        <Ionicons name="chatbubble-ellipses" size={22} color={theme.accent} />
        <ThemedText style={styles.lineText}>“{question.line.quote.text}”</ThemedText>
      </Animated.View>
      {picked && (
        <Animated.View entering={enter(FadeIn.duration(200))} style={{ gap: Spacing.two }}>
          <Pressable onPress={() => void openLink(question.line.quote.url)} accessibilityRole="link" hitSlop={6}>
            <ThemedText type="small" style={{ color: theme.primary, fontSize: 13 }}>
              {t('Source')}: {question.line.quote.source}
            </ThemedText>
          </Pressable>
          {question.line.about ? (
            <ThemedText type="small" themeColor="textSecondary">
              {loc(question.line.about, question.line.aboutEs)}
            </ThemedText>
          ) : null}
        </Animated.View>
      )}
    </GameStage>
  );
}

// ---------------------------------------------------------------------------
// Cheap date

const CHEAP_SORTS: { key: CheapSort; label: string; note: string }[] = [
  {
    key: 'bargain',
    label: 'Best bargain',
    note: 'Ordered by poll support per dollar spent. Spend the most to get where you are, stand last in line.',
  },
  { key: 'spent', label: 'Most spent', note: 'Ordered by money spent so far, most first.' },
  { key: 'support', label: 'Most support', note: 'Ordered by support in the poll, most first.' },
];

/**
 * The line outside the restaurant. The money leads (2026-11-09, Brian: the
 * first version buried each campaign's spending in small print and never
 * said what the field spent in all): the field's total up top, then for
 * every campaign what it spent, the support that bought, and the price per
 * point, with a bar for whichever of the three the list is ordered by.
 * Tap a row for the rest of the books and what the candidate says about
 * money.
 */
function CheapDate({ doc }: { doc: MayorGamesDoc }) {
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const [seed] = useState(randomSeed);
  const [by, setBy] = useState<CheapSort>('bargain');
  const { ranked, unknown } = cheapDateOrder(doc.candidates, seed, by);
  const [open, setOpen] = useState<string | null>(null);
  const best = Math.max(...ranked.map((c) => cheapMeasure(c, by)), 0.000001);
  const { total, campaigns } = fieldSpending(doc.candidates);
  const sort = CHEAP_SORTS.find((x) => x.key === by)!;
  const toggle = (slug: string) => setOpen((x) => (x === slug ? null : slug));
  return (
    <View style={{ gap: Spacing.two + 2 }}>
      <View style={[styles.total, { backgroundColor: theme.februaryBand, borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
          {t('spent by the field so far')}
        </ThemedText>
        <ThemedText type="subtitle" style={{ fontSize: 34, lineHeight: 40, color: theme.accent }}>
          {money(total)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {t('{n} campaigns have filed a spending report.').replace('{n}', String(campaigns))}
        </ThemedText>
      </View>

      <View style={[styles.sides, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {CHEAP_SORTS.map((x) => (
          <Pressable
            key={x.key}
            onPress={() => setBy(x.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: by === x.key }}
            style={[styles.sideTab, by === x.key && { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText
              type="smallBold"
              style={{ fontSize: 13, textAlign: 'center', color: by === x.key ? theme.text : theme.textSecondary }}>
              {t(x.label)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {t(sort.note)}
      </ThemedText>

      {ranked.map((c, i) => (
        <CheapRow
          // Keyed by the sort too, so every bar grows again from the left.
          key={`${by}-${c.slug}`}
          candidate={c}
          rank={i + 1}
          by={by}
          share={cheapMeasure(c, by) / best}
          open={open === c.slug}
          onToggle={() => toggle(c.slug)}
          delay={Math.min(i, 10) * 50}
        />
      ))}
      {unknown.length > 0 && (
        <>
          <SectionHeader
            title={t('spending not on record')}
            subtitle={t('No spending report found for these campaigns yet. They wait here, which is the cheapest place to stand.')}
          />
          {unknown.map((c) => (
            <CheapRow
              key={c.slug}
              candidate={c}
              rank={null}
              by={by}
              share={0}
              open={open === c.slug}
              onToggle={() => toggle(c.slug)}
              delay={0}
            />
          ))}
        </>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {loc(doc.financeNote, doc.financeNoteEs)} {loc(doc.pollNote, doc.pollNoteEs)}{' '}
        {t('Checked {date}.').replace('{date}', doc.asOf)}
      </ThemedText>
    </View>
  );
}

function CheapRow({
  candidate: c,
  rank,
  by,
  share,
  open,
  onToggle,
  delay,
}: {
  candidate: MayorCandidate;
  rank: number | null;
  by: CheapSort;
  /** This candidate's number against the biggest in the field for the current sort, 0 to 1. */
  share: number;
  open: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const router = useRouter();
  const fin = c.finance;
  const per = costPerPoint(c);
  const perMillion = supportPerMillion(c);
  // The bar grows out from the left when the row arrives.
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(delay, withTiming(Math.max(share, 0.02), { duration: 480, easing: Easing.out(Easing.cubic) }));
  }, [delay, grow, share]);
  const bar = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));
  return (
    <Card>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ gap: Spacing.two }}>
        <View style={styles.identity}>
          {rank != null && (
            <View style={[styles.rank, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 14, lineHeight: 18 }}>
                {rank}
              </ThemedText>
            </View>
          )}
          <OfficialAvatar name={c.name} photoUrl={c.photoUrl} frame={c.photoFrame} size={40} />
          <View style={{ flex: 1, gap: 1 }}>
            <ThemedText type="smallBold" style={{ fontSize: 15 }}>
              {c.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {loc(c.title, c.titleEs)}
            </ThemedText>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
        </View>
        {fin?.spent != null ? (
          <>
            <View style={styles.stats}>
              <Stat label={t('Spent')} value={money(fin.spent)} strong={by !== 'support'} />
              <Stat
                label={t('Poll support')}
                value={c.support?.pct != null ? `${c.support.pct}%` : t('not polled')}
                strong={by === 'support'}
              />
              <Stat label={t('Per point')} value={per != null ? money(per) : t('no points')} />
            </View>
            <View style={[styles.track, { backgroundColor: theme.border, height: 8 }]}>
              <Animated.View style={[styles.trackFill, { backgroundColor: theme.accent }, bar]} />
            </View>
            {by === 'bargain' && perMillion != null && (
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t('{n} points of support per $1 million spent').replace(
                  '{n}',
                  perMillion.toFixed(perMillion >= 10 ? 0 : 1)
                )}
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('No spending report found for this campaign yet.')}
          </ThemedText>
        )}
      </Pressable>
      {open && (
        <Animated.View entering={enter(FadeIn.duration(180))} style={{ gap: Spacing.two }}>
          {fin && (
            <View style={[styles.books, { borderColor: theme.border }]}>
              {fin.committee ? (
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  {fin.committee}
                </ThemedText>
              ) : null}
              <BookRow label={t('Raised')} value={fin.raised} />
              <BookRow label={t('Spent')} value={fin.spent} />
              <BookRow label={t('Cash on hand')} value={fin.cashOnHand} />
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {loc(fin.period, fin.periodEs)}.{fin.note ? ` ${loc(fin.note, fin.noteEs)}` : ''}
              </ThemedText>
              <Pressable onPress={() => void openLink(fin.url)} accessibilityRole="link" hitSlop={6}>
                <ThemedText type="small" style={{ color: theme.primary, fontSize: 12 }}>
                  {t('Source')}: {host(fin.url)}
                </ThemedText>
              </Pressable>
            </View>
          )}
          <ThemedText>{loc(c.money.summary, c.money.summaryEs)}</ThemedText>
          {c.money.quotes.map((q, i) => (
            <QuoteBlock key={i} quote={q} />
          ))}
          <Button
            title={t('Everything about {name}').replace('{name}', c.shortName)}
            variant="secondary"
            onPress={() => router.push(`/mayor/${c.slug}`)}
          />
        </Animated.View>
      )}
    </Card>
  );
}

/** One of a row's three numbers: the figure large, its name small under it. */
function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 23, color: strong ? theme.accent : theme.text }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 15 }}>
        {label}
      </ThemedText>
    </View>
  );
}

function BookRow({ label, value }: { label: string; value: number | null }) {
  const t = useT();
  return (
    <View style={styles.between}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value != null ? money(value) : t('not found')}</ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pizza date

/**
 * Everyone's pizza position on the record, ordered by who is right. Thin
 * crust is right. The ones with no position wait in a list at the end.
 */
function PizzaDate({ doc }: { doc: MayorGamesDoc }) {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const [seed] = useState(randomSeed);
  const groups = pizzaGroups(doc.candidates, seed);
  const sections: { key: 'thin' | 'both' | 'deep'; title: string; tone: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'thin', title: 'Correct', tone: theme.verified, icon: 'checkmark-circle' },
    { key: 'both', title: 'Hedging', tone: theme.warning, icon: 'help-circle' },
    { key: 'deep', title: 'Incorrect', tone: theme.danger, icon: 'close-circle' },
  ];
  return (
    <View style={{ gap: Spacing.three }}>
      <View style={{ alignItems: 'center', gap: Spacing.one }}>
        <Ionicons name="pizza" size={40} color={theme.highlight} />
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {t('Ranked by who is right about pizza. Tavern-style thin crust is right. We do not explain ourselves.')}
        </ThemedText>
      </View>
      {sections.map((s) =>
        groups[s.key].length === 0 ? null : (
          <View key={s.key} style={{ gap: Spacing.two + 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={s.icon} size={18} color={s.tone} />
              <ThemedText
                type="smallBold"
                accessibilityRole="header"
                style={{ color: s.tone, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t(s.title)}
              </ThemedText>
            </View>
            {groups[s.key].map((c, i) => (
              <Animated.View key={c.slug} entering={enter(FadeInDown.duration(280).delay(Math.min(i, 8) * 45))}>
                <Card onPress={() => router.push(`/mayor/${c.slug}`)} accessible={false}>
                  <View style={styles.identity}>
                    <OfficialAvatar name={c.name} photoUrl={c.photoUrl} frame={c.photoFrame} size={48} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText
                        type="smallBold"
                        style={{ fontSize: 16 }}
                        accessibilityRole="link"
                        onPress={() => router.push(`/mayor/${c.slug}`)}>
                        {c.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {loc(c.title, c.titleEs)}
                      </ThemedText>
                    </View>
                  </View>
                  {c.pizza.preference ? <ThemedText>{loc(c.pizza.preference, c.pizza.preferenceEs)}</ThemedText> : null}
                  {c.pizza.quote ? <QuoteBlock quote={c.pizza.quote} /> : null}
                </Card>
              </Animated.View>
            ))}
          </View>
        )
      )}
      {groups.none.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <ThemedText
            type="smallBold"
            accessibilityRole="header"
            themeColor="textSecondary"
            style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {t("candidates who don't care about pizza")}
          </ThemedText>
          <Card>
            {groups.none.map((c) => (
              <Pressable
                key={c.slug}
                onPress={() => router.push(`/mayor/${c.slug}`)}
                accessibilityRole="link"
                style={styles.between}>
                <ThemedText style={{ flex: 1 }}>{c.name}</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </Pressable>
            ))}
          </Card>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('No pizza position found on the record, listed in random order. If one of them goes public, tell us and we will rank them.')}{' '}
            <ThemedText
              type="small"
              style={{ color: theme.primary, fontSize: 12 }}
              onPress={() => void openLink('https://www.waldgrave.com/directdemocracy')}>
              waldgrave.com/directdemocracy
            </ThemedText>
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // The small round button beside the stage's main button.
  side: {
    width: 84,
  },
  headline: {
    fontSize: 24,
    lineHeight: 30,
  },
  name: {
    fontSize: 19,
    lineHeight: 24,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  point: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  track: {
    height: 5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  sides: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  sideTab: {
    flex: 1,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingVertical: 7,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  // Pick-up lines: the quote, a choice, and the answer.
  line: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  lineText: {
    fontSize: 21,
    lineHeight: 29,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  // Cheap date: the field's total, a row's three numbers, its books.
  total: {
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  books: {
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.three,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
