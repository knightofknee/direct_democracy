import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { collection, doc, query, where } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ShareButton } from '@/components/share-button';
import { HeaderActions } from '@/components/help-button';
import { OfficialAvatar } from '@/components/avatar';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Card, Chip, EmptyState } from '@/components/ui';
import { WriteInChip, WriteInFootnote, WriteInHeader } from '@/components/write-in';
import { isKnownRace, MUNICIPAL_ELECTION_DATE, raceInfo } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { ElectionCandidateCard, ElectionRaceNote } from '@/lib/types';
import { useT, useLocalized } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import { enter } from '@/lib/motion';

/**
 * One race on the February 23, 2027 ballot (city clerk, city treasurer, or
 * a police district council; ward races have their own screen): the
 * candidates a voter picks between, each with what they say they are
 * running on, so the comparison happens here.
 */
export default function ElectionRaceScreen() {
  const { race } = useLocalSearchParams<{ race: string }>();
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const info = race ? raceInfo(race) : null;
  const known = race ? isKnownRace(race) : false;

  const { data: candidates, loading } = useLiveQuery<ElectionCandidateCard>(
    () =>
      race && info && known
        ? query(
            collection(db, 'electionCandidates'),
            where('election', '==', info.election),
            where('race', '==', race)
          )
        : null,
    [race]
  );
  const { data: raceNote } = useLiveDoc<ElectionRaceNote>(
    () => (race && info && known ? doc(db, 'electionRaceNotes', `${info.election}--${race}`) : null),
    [race]
  );

  const printed = candidates.filter((c) => !c.writeIn);
  const writeIns = candidates.length - printed.length;
  const sitting = candidates.find((c) => c.incumbent);
  usePageSummary('election-race/[race]', [
    info && known && `${t(info.label)}.`,
    info && known && t('On the February 23, 2027 ballot.'),
    !loading &&
      (candidates.length === 0
        ? t('No candidates are listed yet.')
        : writeIns > 0
          ? t('On the ballot: {n}. Declared write-ins: {w}.').replace('{n}', String(printed.length)).replace('{w}', String(writeIns))
          : t('On the ballot: {n}.').replace('{n}', String(printed.length))),
    printed.length > 0 &&
      printed.length <= 8 &&
      t('Running: {names}.').replace('{names}', printed.map((c) => c.name).join(', ')),
    sitting && t('Incumbent: {name}.').replace('{name}', sitting.name),
  ]);

  if (!info || !known) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" message={t('Race not found.')} />
      </Screen>
    );
  }

  // Ballot names before declared write-ins, the incumbent first, then
  // alphabetical.
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(!!a.writeIn) - Number(!!b.writeIn) ||
      Number(b.incumbent) - Number(a.incumbent) ||
      a.name.localeCompare(b.name)
  );
  const onBallot = sorted.filter((c) => !c.writeIn);
  const firstWriteIn = sorted.find((c) => c.writeIn)?.id;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderActions>
              <ShareButton path={`/election-race/${race}`} title={t(info.label)} />
            </HeaderActions>
          ),
        }}
      />
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="subtitle" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30 }}>
          {t(info.label)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {info.detail ? `${t(info.detail)} · ` : ''}{t('on the ballot')} {t(MUNICIPAL_ELECTION_DATE)}.
        </ThemedText>
      </View>

      {raceNote ? (
        <Card>
          <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }}>
            {loc(raceNote.note, raceNote.noteEs)}
          </ThemedText>
        </Card>
      ) : null}

      {loading ? (
        <SkeletonCards count={2} />
      ) : sorted.length === 0 ? (
        <EmptyState icon="ribbon-outline" message={t('No candidates listed for this race yet.')} />
      ) : (
        <>
          {onBallot.length === 1 && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {onBallot[0].name}{' '}
              {t(sorted.length === 1 ? 'is running unopposed.' : 'is the only name printed on the ballot.')}
            </ThemedText>
          )}
          {sorted.map((candidate, i) => (
            <Animated.View
              key={candidate.id}
              entering={enter(FadeInDown.duration(280).delay(Math.min(i, 8) * 45))}
              style={{ gap: Spacing.three }}>
              {candidate.id === firstWriteIn && <WriteInHeader />}
              <Card onPress={() => router.push(`/election-candidate/${candidate.id}`)}>
                <View style={styles.row}>
                  <OfficialAvatar
                    name={candidate.name}
                    photoUrl={candidate.photoUrl ?? null}
                    frame={candidate.photoFrame}
                    size={48}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
                      <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                        {candidate.name}
                      </ThemedText>
                      {candidate.party && <Chip label={t(candidate.party)} />}
                      {candidate.incumbent && <Chip label={t('Incumbent')} tone="primary" />}
                      {candidate.writeIn && <WriteInChip />}
                    </View>
                    {candidate.priorCareer ? (
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }} numberOfLines={2}>
                        {loc(candidate.priorCareer, candidate.priorCareerEs)}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </View>
                {/* The comparison happens here, not one tap deeper. */}
                <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
                  {loc(candidate.runningOn, candidate.runningOnEs)}
                </ThemedText>
              </Card>
            </Animated.View>
          ))}
          {firstWriteIn && <WriteInFootnote />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
