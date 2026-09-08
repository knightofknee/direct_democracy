import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, query, where } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { OfficialRow } from '@/components/politician-row';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, SectionHeader } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import {
  MUNICIPAL_2027_FILING,
  MUNICIPAL_ELECTION,
  MUNICIPAL_ELECTION_DATE,
} from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { ElectionCandidateCard, ElectionRaceNote, Official } from '@/lib/types';
import { useT } from '@/lib/i18n';

/**
 * One ward's February 2027 aldermanic race: the incumbent's report card
 * (grades from this platform, not from us) next to everyone who has
 * declared against them. No other voter guide puts "how did they do" and
 * "who is running against them" on the same screen - that pairing is the
 * point of this one.
 */
export default function WardRaceScreen() {
  const { ward } = useLocalSearchParams<{ ward: string }>();
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const wardId = Number(ward);
  const valid = Number.isInteger(wardId) && wardId >= 1 && wardId <= 50;
  const race = `ward-${wardId}`;

  const { data: officials } = useLiveQuery<Official>(
    () => (valid ? query(collection(db, 'officials'), where('wardId', '==', wardId)) : null),
    [wardId, valid]
  );
  const { data: candidates, loading } = useLiveQuery<ElectionCandidateCard>(
    () =>
      valid
        ? query(
            collection(db, 'electionCandidates'),
            where('election', '==', MUNICIPAL_ELECTION),
            where('race', '==', race)
          )
        : null,
    [race, valid]
  );
  const { data: raceNote } = useLiveDoc<ElectionRaceNote>(
    () => (valid ? doc(db, 'electionRaceNotes', `${MUNICIPAL_ELECTION}--${race}`) : null),
    [race, valid]
  );

  if (!valid) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" message={t('Ward not found.')} />
      </Screen>
    );
  }

  const incumbent = officials[0] ?? null;
  const incumbentCard = candidates.find((c) => c.incumbent) ?? null;
  const incumbentRunning = incumbentCard != null;
  const challengers = [...candidates]
    .filter((c) => !c.incumbent)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
          {wardLabel(wardId)}: {t('race')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Alderman, on the ballot')} {t(MUNICIPAL_ELECTION_DATE)}. {t(MUNICIPAL_2027_FILING)}.
        </ThemedText>
      </View>

      {incumbent && (
        <>
          <SectionHeader
            title={t('The incumbent')}
            subtitle={t(
              incumbentRunning
                ? 'Running for re-election. Their record here is the community grading them.'
                : 'Their record here is the community grading them.'
            )}
          />
          <OfficialRow official={incumbent} />
          {incumbentCard && (
            <Card onPress={() => router.push(`/election-candidate/${incumbentCard.id}`)}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 3 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 13 }}>
                    {t("What they say they're running on")}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={{ fontSize: 12 }}
                    numberOfLines={3}>
                    {incumbentCard.runningOn}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
            </Card>
          )}
        </>
      )}

      {raceNote ? (
        <Card>
          <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }}>
            {raceNote.note}
          </ThemedText>
        </Card>
      ) : null}

      <SectionHeader title={t(challengers.length ? 'Declared challengers' : 'Challengers')} />
      {loading ? (
        <SkeletonCards count={1} />
      ) : challengers.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
          {t('No declared challengers on record here yet. Petitions are circulating across the city; this page fills in as candidates go public and file.')}
        </ThemedText>
      ) : (
        challengers.map((candidate, i) => (
          <Animated.View
            key={candidate.id}
            entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}>
            <Card onPress={() => router.push(`/election-candidate/${candidate.id}`)}>
              <View style={styles.row}>
                <OfficialAvatar name={candidate.name} photoUrl={candidate.photoUrl ?? null} size={48} />
                <View style={{ flex: 1, gap: 3 }}>
                  <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                    {candidate.name}
                  </ThemedText>
                  {candidate.priorCareer ? (
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={{ fontSize: 12 }}
                      numberOfLines={1}>
                      {candidate.priorCareer}
                    </ThemedText>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
              {/* The comparison happens here, not one tap deeper. */}
              <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
                {candidate.runningOn}
              </ThemedText>
            </Card>
          </Animated.View>
        ))
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
