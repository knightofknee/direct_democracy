import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocalized, useT } from '@/lib/i18n';
import {
  hostLine,
  inTheRace,
  liveSplits,
  loadTriviaSeen,
  onlyProposals,
  pickTrivia,
  saveTriviaSeen,
  shuffledBy,
  splitsFor,
  type MayorCandidate,
  type MayorGamesDoc,
  type MayorQuote,
  type MayorTriviaItem,
} from '@/lib/mayor-games';
import { enter } from '@/lib/motion';
import { openLink } from '@/lib/open-link';

/**
 * Pieces every mayor game shares: a quote with its source, the host's line
 * between dates, where a candidate stands, and the two ways out of a card
 * (everything about them, their full platform).
 */

/** A verbatim quote in the language it was said in, with where it was said. */
export function QuoteBlock({ quote, sealed }: { quote: MayorQuote; sealed?: boolean }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={[styles.quote, { borderLeftColor: theme.accent }]}>
      <ThemedText style={{ fontStyle: 'italic' }}>“{quote.text}”</ThemedText>
      {sealed ? (
        // On a blind date the source would give the date away: most are the
        // campaign's own site, named after the candidate. It opens with the
        // reveal (found on the simulator, 2026-11-10).
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Source shown with the reveal')}
        </ThemedText>
      ) : (
        <Pressable onPress={() => void openLink(quote.url)} accessibilityRole="link" hitSlop={6}>
          <ThemedText type="small" style={{ color: theme.primary, fontSize: 12 }}>
            {t('Source')}: {quote.source}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** The host between dates: a line about the game, never about a candidate. */
export function HostLine({ index }: { index: number }) {
  const t = useT();
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', fontStyle: 'italic' }}>
      {t(hostLine(index))}
    </ThemedText>
  );
}

/** Where the candidate stands with the Board of Elections. */
export function StatusChip({ candidate }: { candidate: MayorCandidate }) {
  const t = useT();
  switch (candidate.status) {
    case 'certified':
      return <Chip label={t('On the ballot')} tone="success" icon="checkmark" />;
    case 'removed':
      return <Chip label={t('Off the ballot')} tone="danger" />;
    case 'withdrawn':
      return <Chip label={t('Withdrew')} tone="warning" />;
    default:
      return <Chip label={t('Petitions filed')} tone="primary" />;
  }
}

/** Name, job, and standing beside the portrait: the top of every card. */
export function MayorHeader({ candidate, size = 56 }: { candidate: MayorCandidate; size?: number }) {
  const loc = useLocalized();
  return (
    <View style={styles.row}>
      <OfficialAvatar
        name={candidate.name}
        photoUrl={candidate.photoUrl}
        frame={candidate.photoFrame}
        size={size}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 24 }}>
          {candidate.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {loc(candidate.title, candidate.titleEs)}
        </ThemedText>
        <View style={{ flexDirection: 'row' }}>
          <StatusChip candidate={candidate} />
        </View>
      </View>
    </View>
  );
}

/**
 * Out of a card and into the facts: the candidate's page in the app
 * (everything the games know, with sources) and their full platform, which
 * is their page on the platform when they have one and their own site
 * otherwise.
 */
export function MayorLinks({ candidate, compact }: { candidate: MayorCandidate; compact?: boolean }) {
  const router = useRouter();
  const t = useT();
  const platform = candidate.candidateUid
    ? () => router.push(`/candidate/${candidate.candidateUid}`)
    : candidate.platformUrl
      ? () => void openLink(candidate.platformUrl!)
      : candidate.website
        ? () => void openLink(candidate.website!)
        : null;
  return (
    <View style={{ gap: Spacing.two }}>
      <Button
        title={t('Everything about {name}').replace('{name}', candidate.shortName)}
        variant={compact ? 'secondary' : 'primary'}
        icon={<Ionicons name="person-circle-outline" size={16} color={compact ? undefined : '#FFFFFF'} />}
        onPress={() => router.push(`/mayor/${candidate.slug}`)}
      />
      {platform && (
        <Button
          title={t(candidate.candidateUid ? 'Full platform' : 'Full platform on their site')}
          variant="secondary"
          icon={<Ionicons name={candidate.candidateUid ? 'document-text-outline' : 'globe-outline'} size={16} />}
          onPress={platform}
        />
      )}
    </View>
  );
}

/**
 * What nearly every candidate says, stated once (2026-11-09, Brian: the
 * summaries walked every candidate through the same police, housing, and
 * budget lines, which tells a voter nothing about any one of them). Folded
 * by default: it is here so nobody has to read it sixteen times.
 */
export function ConsensusCard({ doc }: { doc: MayorGamesDoc }) {
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const [open, setOpen] = useState(false);
  if (!doc.consensus?.length) return null;
  return (
    <View style={[styles.consensus, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.row}>
        <Ionicons name="copy-outline" size={18} color={theme.textSecondary} />
        <View style={{ flex: 1, gap: 1 }}>
          <ThemedText type="smallBold" style={{ fontSize: 15 }}>
            {t('What nearly all of them say')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Said once here, so no candidate\'s page repeats it.')}
          </ThemedText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Pressable>
      {open &&
        doc.consensus.map((line, i) => (
          <View key={i} style={[styles.row, { alignItems: 'flex-start' }]}>
            <Ionicons name="remove" size={14} color={theme.textSecondary} style={{ marginTop: 4 }} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {loc(line.text, line.textEs)}
            </ThemedText>
          </View>
        ))}
    </View>
  );
}

/** A candidate's name as a link to their page, for the lines of a split. */
function NameLinks({ candidates }: { candidates: MayorCandidate[] }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <>
      {candidates.map((c, i) => (
        <ThemedText
          key={c.slug}
          type="smallBold"
          style={{ color: theme.primary }}
          accessibilityRole="link"
          onPress={() => router.push(`/mayor/${c.slug}`)}>
          {c.shortName}
          {i < candidates.length - 1 ? ', ' : ''}
        </ThemedText>
      ))}
    </>
  );
}

/**
 * The questions the field splits on, drawn from the one table on the doc.
 * With `slug`, one candidate's view: the splits they have taken a side on,
 * their side first with who stands with them, then the other sides by
 * name. Without it, every split with everyone on every side. Sides and
 * the names inside them come in a random order (the seed's), their own
 * side aside: nothing here ranks a candidate or an answer.
 */
export function SplitList({ doc, slug, seed }: { doc: MayorGamesDoc; slug?: string; seed: number }) {
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const order = shuffledBy(inTheRace(doc.candidates), seed);
  const mixed = <T extends { label: string }>(sides: T[]) =>
    shuffledBy(
      sides.map((side) => ({ ...side, slug: side.label })),
      seed
    );

  if (slug) {
    const views = splitsFor(doc, slug, order);
    if (views.length === 0) {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          {t('No side found yet on any of the questions that divide the field.')}
        </ThemedText>
      );
    }
    return (
      <View style={{ gap: Spacing.three }}>
        {views.map(({ split, mine, sides }) => {
          const my = sides[mine];
          const with_ = my.candidates.filter((c) => c.slug !== slug);
          return (
            <View key={split.id} style={{ gap: 3 }}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
                {loc(split.title, split.titleEs)}
              </ThemedText>
              <ThemedText style={{ fontWeight: '700', color: theme.accent }}>{loc(my.label, my.labelEs)}</ThemedText>
              {with_.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Also:')} <NameLinks candidates={with_} />
                </ThemedText>
              )}
              {mixed(sides.filter((_, i) => i !== mine)).map((side) => (
                <ThemedText key={side.label} type="small" themeColor="textSecondary">
                  {loc(side.label, side.labelEs)}: <NameLinks candidates={side.candidates} />
                </ThemedText>
              ))}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.three }}>
      {liveSplits(doc, order).map(({ split, sides }) => (
        <View
          key={split.id}
          style={[styles.split, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" accessibilityRole="header" style={{ fontSize: 16 }}>
            {loc(split.title, split.titleEs)}
          </ThemedText>
          {mixed(sides).map((side) => (
            <View key={side.label} style={{ gap: 1 }}>
              <ThemedText type="small" style={{ fontWeight: '600' }}>
                {loc(side.label, side.labelEs)}
              </ThemedText>
              <ThemedText type="small">
                <NameLinks candidates={side.candidates} />
              </ThemedText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * What only one candidate would do (2026-11-09, Brian: change that goes
 * unmatched by the rest of the field is what the app most wants to show).
 * Read off each summary's leading "Only <Name>" chunk. A few at a time, in
 * a random order, with the rest one tap away.
 */
export function OnlyList({ doc, seed }: { doc: MayorGamesDoc; seed: number }) {
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const items = onlyProposals(shuffledBy(inTheRace(doc.candidates), seed));
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, 4);
  return (
    <View style={[styles.split, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      {shown.map(({ candidate, text, textEs }) => (
        <ThemedText key={candidate.slug} type="small">
          <ThemedText
            type="smallBold"
            style={{ color: theme.primary }}
            accessibilityRole="link"
            onPress={() => router.push(`/mayor/${candidate.slug}`)}>
            {candidate.shortName}
          </ThemedText>
          {'  '}
          {loc(text, textEs)}
        </ThemedText>
      ))}
      {items.length > 4 && (
        <Pressable
          onPress={() => setAll((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ expanded: all }}>
          <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
            {all ? t('Hide the others') : t('See all {n}').replace('{n}', String(items.length))}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Former mayor trivia (2026-11-09): one fact about a past mayor and a
 * shuffle button, in a card kept deliberately small so it never crowds
 * "where they split" under it. Facts come at random and this phone
 * remembers which it has shown, so none repeats until all have had a turn.
 */
export function MayorTrivia({ items }: { items: MayorTriviaItem[] }) {
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const [seen, setSeen] = useState<string[] | null>(null);
  // The facts shown since the card appeared, oldest first, and which one
  // is up. Back walks toward the start; the shuffle button walks forward
  // again before it deals a new one, so a step back never loses a fact.
  const [trail, setTrail] = useState<string[]>([]);
  const [at, setAt] = useState(0);
  const [tallest, setTallest] = useState<number | null>(null);
  const [labelHeight, setLabelHeight] = useState<number | null>(null);
  // One line of fact text at this phone's text size (small text stops
  // growing at 1.6x, see ThemedText).
  const { fontScale } = useWindowDimensions();
  const oneLine = Math.round(18 * Math.min(fontScale, 1.6));
  const current = trail[at] ?? null;

  useEffect(() => {
    let live = true;
    void loadTriviaSeen().then((stored) => {
      if (!live) return;
      const next = pickTrivia(items, stored, null);
      setSeen(next?.seen ?? stored);
      setTrail(next ? [next.id] : []);
      setAt(0);
      if (next) saveTriviaSeen(next.seen);
    });
    return () => {
      live = false;
    };
    // A longer list is a new deal; an edited fact is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const fact = items.find((x) => x.id === current);
  if (!fact) return null;
  const shuffle = () => {
    if (at < trail.length - 1) {
      setAt(at + 1);
      return;
    }
    const next = pickTrivia(items, seen ?? [], current);
    if (!next) return;
    setSeen(next.seen);
    // Forty is far more than anyone walks back; it only keeps the list short.
    const grown = [...trail, next.id].slice(-40);
    setTrail(grown);
    setAt(grown.length - 1);
    saveTriviaSeen(next.seen);
  };
  const canGoBack = at > 0;
  const source = (f: MayorTriviaItem) => `${f.mayor}, ${f.years} · ${t('Source')}`;
  // The card's height without a long fact in it: the label, then one line
  // less than the tallest fact. Known only once both have been laid out.
  const base = labelHeight != null && tallest != null ? labelHeight + 2 + tallest - oneLine : null;
  return (
    <View style={[styles.trivia, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityRole="header"
          style={styles.triviaLabel}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h !== labelHeight) setLabelHeight(h);
          }}>
          {t('former mayor trivia')}
        </ThemedText>
        {/* How tall the card is (Brian, 2026-11-10). A shuffle that moves
            its own button, or the section under the card, is jarring, but
            sizing the card for its longest fact left most facts with empty
            space under them, and the long ones are the interesting ones.
            So: the card is one line shorter than its tallest fact, most
            facts fit and nothing moves, and only the longest grow it by a
            line. Every fact is laid out unseen behind the one on show, side
            by side in a clipped row, so that row's height is the tallest
            fact's at this width, text size and language; it is measured,
            and the area is given that height less a line. (Pulling the row
            up with a negative margin did the same on the web without
            measuring, but phones ignore it: found on the simulator.) */}
        <View style={[styles.triviaArea, tallest != null && { minHeight: tallest - oneLine }]}>
          <Animated.View key={fact.id} entering={enter(FadeIn.duration(180))} style={styles.triviaFact}>
            <ThemedText type="small" style={styles.triviaText}>
              {loc(fact.text, fact.textEs)}
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.triviaSource, { color: theme.primary }]}
              accessibilityRole="link"
              onPress={() => void openLink(fact.url)}>
              {source(fact)}
            </ThemedText>
          </Animated.View>
          <View
            style={styles.triviaSizer}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h !== tallest) setTallest(h);
            }}>
            {items.map((f) => (
              <View key={f.id} style={styles.triviaFact}>
                <ThemedText type="small" style={styles.triviaText}>
                  {loc(f.text, f.textEs)}
                </ThemedText>
                <ThemedText type="small" style={styles.triviaSource}>
                  {source(f)}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
      {/* The shuffle button sits at the middle of the card as it is without
          a long fact, and the arrow halfway between that button and the
          card's bottom edge (Brian, 2026-11-10). Both are placed by
          arithmetic from the measured height, in a column that keeps the
          shorter card's height and stays at the top, so neither moves when
          a long fact makes the card taller. Not by flex: the phone and the
          web shared the space around the button differently, and the
          button sat 11 points high on the simulator. */}
      <View style={[styles.triviaButtons, base != null ? { alignSelf: 'flex-start', height: base } : { height: SHUFFLE }]}>
        <Pressable
          onPress={shuffle}
          accessibilityRole="button"
          accessibilityLabel={t('Another fact')}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 0 }}
          style={({ pressed }) => [
            styles.shuffle,
            {
              top: base != null ? (base - SHUFFLE) / 2 : 0,
              borderColor: theme.border,
              backgroundColor: theme.background,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Ionicons name="shuffle" size={18} color={theme.primary} />
        </Pressable>
        {/* Its touch area starts 8 points under the shuffle button, so a
            thumb aiming at one does not land on the other, and runs to the
            bottom of the column; the arrow is drawn at its middle. Hidden
            until there is a fact to go back to. */}
        {base != null && (
          <Pressable
            onPress={() => setAt(at - 1)}
            disabled={!canGoBack}
            accessibilityRole="button"
            accessibilityLabel={t('Previous fact')}
            accessibilityElementsHidden={!canGoBack}
            importantForAccessibility={canGoBack ? 'yes' : 'no-hide-descendants'}
            hitSlop={{ top: 0, left: 12, right: 12, bottom: 8 }}
            style={({ pressed }) => [
              styles.triviaBack,
              { top: (base + SHUFFLE) / 2 + 8, opacity: !canGoBack ? 0 : pressed ? 0.5 : 1 },
            ]}>
            <Ionicons name="arrow-undo" size={13} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The trivia card's shuffle button, in points across. */
const SHUFFLE = 38;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  trivia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  triviaArea: {
    overflow: 'hidden',
  },
  // The fact on show and every unseen one: each exactly as wide as the area.
  triviaFact: {
    width: '100%',
    flexShrink: 0,
    gap: 2,
  },
  // Out of the flow, so it sizes nothing by itself: it is only measured.
  triviaSizer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
  },
  triviaText: {
    fontSize: 13,
    lineHeight: 18,
  },
  triviaSource: {
    fontSize: 11,
    lineHeight: 15,
  },
  triviaLabel: {
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  triviaButtons: {
    width: SHUFFLE,
  },
  triviaBack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffle: {
    position: 'absolute',
    left: 0,
    width: SHUFFLE,
    height: SHUFFLE,
    borderRadius: SHUFFLE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consensus: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  split: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.three,
    gap: 4,
  },
});
