import { Ionicons } from '@expo/vector-icons';
import { collection, query } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import {
  DISTRICT_LOOKUP_URL,
  SCHOOL_BOARD_ELECTION_DATE,
  SCHOOL_BOARD_RACES,
} from '@/constants/school-board';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { openLink } from '@/lib/open-link';
import type { SchoolBoardCandidate } from '@/lib/types';
import { usePlural, useT } from '@/lib/i18n';

/**
 * The school board directory on the election tab: the citywide president
 * race on top (everyone votes in it), then the 20 district seats as a grid -
 * voters care about their own district's race, not the whole 51-candidate
 * pool at once. Districts don't follow ward lines, so the lookup link is how
 * a voter finds theirs.
 */
export function SchoolBoardSection() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();

  const { data: candidates } = useLiveQuery<SchoolBoardCandidate & { id: string }>(
    () => query(collection(db, 'schoolBoardCandidates')),
    []
  );
  const countByRace = new Map<string, number>();
  for (const c of candidates) countByRace.set(c.race, (countByRace.get(c.race) ?? 0) + 1);

  const president = SCHOOL_BOARD_RACES[0];
  const districts = SCHOOL_BOARD_RACES.slice(1);

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('school board')}
        subtitle={t(`All 21 board seats are on the ${SCHOOL_BOARD_ELECTION_DATE} ballot. You vote in two races: board president and your district's seat.`)}
      />

      <Card onPress={() => router.push(`/school-board/${president.id}`)}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 3 }}>
            <ThemedText type="smallBold" style={{ fontSize: 15 }}>
              {president.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {president.detail}
              {countByRace.has(president.id)
                ? ` · ${pluralT(countByRace.get(president.id)!, 'candidate')}`
                : ''}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </Card>

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t("Your district's seat")}
        </ThemedText>
        <View style={styles.grid}>
          {districts.map((race) => (
            <Pressable
              key={race.id}
              onPress={() => router.push(`/school-board/${race.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`School board ${race.label}`}
              style={({ pressed }) => [
                styles.districtButton,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                {race.id}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => openLink(DISTRICT_LOOKUP_URL)}
          hitSlop={8}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="location-outline" size={14} color={theme.primary} />
          <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
            {t('Not sure which district? Look up your address')}
          </ThemedText>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  districtButton: {
    width: '17.6%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
});
