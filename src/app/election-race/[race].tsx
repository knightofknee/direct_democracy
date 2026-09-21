import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, query, where } from 'firebase/firestore';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { RatingChips } from '@/components/rating-chips';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Card, Chip, EmptyState } from '@/components/ui';
import { WriteInChip, WriteInHeader } from '@/components/write-in';
import {
  GENERAL_ELECTION,
  GENERAL_ELECTION_DATE,
  isKnownRace,
  JUDICIAL_2026,
  MUNICIPAL_ELECTION_DATE,
  raceInfo,
} from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { openLink } from '@/lib/open-link';
import type { ElectionCandidateCard, ElectionRaceNote } from '@/lib/types';
import { useT, useLocalized } from '@/lib/i18n';

/**
 * One race on either upcoming ballot: the candidates a voter picks between,
 * each with what they say they are running on, so the comparison happens
 * here. Judicial races add the vacancy, the court, and the bar ratings;
 * retention is a yes-or-no on each sitting judge rather than a contest.
 */
export default function ElectionRaceScreen() {
  const { race } = useLocalSearchParams<{ race: string }>();
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const loc = useLocalized();
  const info = race ? raceInfo(race) : null;
  const known = race ? isKnownRace(race) : false;
  const retention = race === 'judicial-retention';
  const judicial = race?.startsWith('judicial-') ?? false;

  const { data: candidates, loading } = useLiveQuery<ElectionCandidateCard>(
    () =>
      race && info
        ? query(
            collection(db, 'electionCandidates'),
            where('election', '==', info.election),
            where('race', '==', race)
          )
        : null,
    [race]
  );
  const { data: raceNote } = useLiveDoc<ElectionRaceNote>(
    () => (race && info ? doc(db, 'electionRaceNotes', `${info.election}--${race}`) : null),
    [race]
  );

  if (!info || !known) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" message={t('Race not found.')} />
      </Screen>
    );
  }

  // Retention lists alphabetically (there is nothing to rank); contests put
  // ballot names before declared write-ins, the incumbent first, then
  // alphabetical.
  const sorted = [...candidates].sort((a, b) =>
    retention
      ? a.name.localeCompare(b.name)
      : Number(!!a.writeIn) - Number(!!b.writeIn) ||
        Number(b.incumbent) - Number(a.incumbent) ||
        a.name.localeCompare(b.name)
  );
  const onBallot = sorted.filter((c) => !c.writeIn);
  const firstWriteIn = sorted.find((c) => c.writeIn)?.id;
  const electionDate =
    info.election === GENERAL_ELECTION ? GENERAL_ELECTION_DATE : MUNICIPAL_ELECTION_DATE;

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
          {t(info.label)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {info.detail ? `${t(info.detail)} · ` : ''}{t('on the ballot')} {t(electionDate)}.
        </ThemedText>
      </View>

      {judicial && (
        <Card>
          <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }}>
            {t(JUDICIAL_2026.detail)}
          </ThemedText>
          <GuideLink label={t(JUDICIAL_2026.guideLabel)} url={JUDICIAL_2026.guideUrl} />
          <GuideLink label={t(JUDICIAL_2026.cbaLabel)} url={JUDICIAL_2026.cbaUrl} />
        </Card>
      )}

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
          {onBallot.length === 1 && !retention && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {onBallot[0].name}{' '}
              {t(sorted.length === 1 ? 'is running unopposed.' : 'is the only name printed on the ballot.')}
            </ThemedText>
          )}
          {retention && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {sorted.length} {t('judges. Each is a separate yes-or-no question on your ballot.')}
            </ThemedText>
          )}
          {sorted.map((candidate, i) => (
            <Animated.View
              key={candidate.id}
              entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}
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
                      {candidate.incumbent && !retention && <Chip label={t('Incumbent')} tone="primary" />}
                      {candidate.writeIn && <WriteInChip />}
                    </View>
                    {candidate.seat || candidate.court ? (
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                        {[candidate.seat, candidate.court && t(candidate.court)].filter(Boolean).join(' · ')}
                      </ThemedText>
                    ) : candidate.priorCareer ? (
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }} numberOfLines={2}>
                        {loc(candidate.priorCareer, candidate.priorCareerEs)}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </View>
                {candidate.ratings && candidate.ratings.length > 0 && (
                  <RatingChips ratings={candidate.ratings} />
                )}
                {/* The comparison happens here, not one tap deeper. */}
                {!retention && (
                  <ThemedText type="small" style={{ fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
                    {loc(candidate.runningOn, candidate.runningOnEs)}
                  </ThemedText>
                )}
              </Card>
            </Animated.View>
          ))}
        </>
      )}
    </Screen>
  );
}

function GuideLink({ label, url }: { label: string; url: string }) {
  const theme = useTheme();
  return (
    <ThemedText
      type="smallBold"
      style={{ color: theme.primary, fontSize: 13 }}
      onPress={() => openLink(url)}
      accessibilityRole="link">
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
