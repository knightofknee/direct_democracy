import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { OfficialAvatar } from '@/components/avatar';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Card, Chip, EmptyState } from '@/components/ui';
import { SCHOOL_BOARD_ELECTION_DATE, SCHOOL_BOARD_RACES, schoolBoardRaceLabel } from '@/constants/school-board';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { SchoolBoardCandidate } from '@/lib/types';
import { useLocalized, useT } from '@/lib/i18n';
import { collection, query, where } from 'firebase/firestore';

/** One school board race: the nominees a voter picks between on the ballot. */
export default function SchoolBoardRaceScreen() {
  const { race } = useLocalSearchParams<{ race: string }>();
  const router = useRouter();
  const theme = useTheme();
  const loc = useLocalized();
  const t = useT();
  const info = SCHOOL_BOARD_RACES.find((r) => r.id === race);

  const { data: candidates, loading } = useLiveQuery<SchoolBoardCandidate & { id: string }>(
    () =>
      race ? query(collection(db, 'schoolBoardCandidates'), where('race', '==', race)) : null,
    [race]
  );

  if (!info) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" message={t('Race not found.')} />
      </Screen>
    );
  }

  const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
          {schoolBoardRaceLabel(info.id)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t(info.detail)} · {t('on the ballot')} {t(SCHOOL_BOARD_ELECTION_DATE)}.
        </ThemedText>
      </View>

      {loading ? (
        <SkeletonCards count={2} />
      ) : sorted.length === 0 ? (
        <EmptyState icon="ribbon-outline" message={t('No candidates listed for this race yet.')} />
      ) : (
        <>
          {sorted.length === 1 && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {sorted[0].name} {t('is running unopposed.')}
            </ThemedText>
          )}
          {sorted.map((candidate, i) => (
            <Animated.View
              key={candidate.id}
              entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}>
              <Card onPress={() => router.push(`/school-board-candidate/${candidate.id}`)}>
                <View style={styles.row}>
                  <OfficialAvatar name={candidate.name} photoUrl={candidate.photoUrl ?? null} size={48} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                      <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                        {candidate.name}
                      </ThemedText>
                      {candidate.incumbent && <Chip label={t('Incumbent')} tone="primary" />}
                    </View>
                    {candidate.priorCareer ? (
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={{ fontSize: 12 }}
                        numberOfLines={1}>
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
