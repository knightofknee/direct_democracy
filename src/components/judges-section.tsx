import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DistrictCells } from '@/components/district-cells';
import { negativeRatingCount } from '@/components/rating-chips';
import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { GENERAL_ELECTION, JUDICIAL_2026, JUDICIAL_RACES, VOTER_LOOKUP_URL } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { useMyDistricts } from '@/lib/districts';
import { db } from '@/lib/firebase';
import { openLink } from '@/lib/open-link';
import type { ElectionCandidateCard } from '@/lib/types';
import { usePlural, useT } from '@/lib/i18n';

/**
 * The judicial ballot: retention first (every voter answers all of it),
 * then the contested vacancies, then the subcircuit seats that depend on
 * where you live. Injustice Watch leads the section on purpose: this app
 * carries the list and the bar ratings, their reporting is the reason to
 * read before voting.
 */
export function JudgesSection() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();
  const { profile } = useAuth();
  const mine = useMyDistricts();

  // One equality query (no composite index needed); the judicial slice is
  // filtered here.
  const { data: cards } = useLiveQuery<ElectionCandidateCard>(
    () => query(collection(db, 'electionCandidates'), where('election', '==', GENERAL_ELECTION)),
    []
  );
  const countByRace = new Map<string, number>();
  // Judges a bar association rated negatively, per race: the one number a
  // voter skimming the judicial ballot most needs to see.
  const flaggedByRace = new Map<string, number>();
  for (const c of cards) {
    if (!c.race.startsWith('judicial-')) continue;
    countByRace.set(c.race, (countByRace.get(c.race) ?? 0) + 1);
    if (negativeRatingCount(c.ratings) > 0) flaggedByRace.set(c.race, (flaggedByRace.get(c.race) ?? 0) + 1);
  }
  const subcircuits = [...countByRace.keys()]
    .map((r) => r.match(/^judicial-subcircuit-(\d+)$/))
    .filter((m): m is RegExpMatchArray => m != null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  const flaggedSubcircuits = subcircuits.filter((n) => flaggedByRace.has(`judicial-subcircuit-${n}`));

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('judges')}
        subtitle={t('The longest part of the ballot and the least known. Read Injustice Watch before you vote; the lists and ratings here are the shortcut back to it.')}
      />

      <Card>
        <View style={styles.row}>
          <Ionicons name="scale-outline" size={22} color={theme.primary} />
          <View style={{ flex: 1, gap: 3 }}>
            <ThemedText type="smallBold" style={{ fontSize: 15 }}>
              {t('Injustice Watch judicial guide')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
              {t("Independent reporting on every judge on the ballot: their records, controversies, and the bar associations' findings, in one place.")}
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => openLink(JUDICIAL_2026.guideUrl)}
          hitSlop={6}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="open-outline" size={14} color={theme.primary} />
          <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
            {t('Open the guide')}
          </ThemedText>
        </Pressable>
      </Card>

      {JUDICIAL_RACES.map((race) => (
        <Card key={race.id} onPress={() => router.push(`/election-race/${race.id}`)}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                {t(race.label)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t(race.detail)}
                {countByRace.has(race.id)
                  ? ` · ${pluralT(countByRace.get(race.id)!, race.id === 'judicial-retention' ? 'judge' : 'candidate', race.id === 'judicial-retention' ? 'judges ' : undefined)}`
                  : ''}
              </ThemedText>
              {flaggedByRace.has(race.id) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="alert-circle" size={15} color={theme.danger} />
                  <ThemedText type="smallBold" style={{ flex: 1, fontSize: 13, color: theme.danger }}>
                    {t('{n} with a negative bar rating').replace('{n}', String(flaggedByRace.get(race.id)))}
                  </ThemedText>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      ))}

      {subcircuits.length > 0 && (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            {t("Your subcircuit's vacancies")}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
            {t('Some trial judges are elected by one part of the county. Your sample ballot names your subcircuit.')}
          </ThemedText>
          <DistrictCells
            all={subcircuits}
            mine={mine.of('subcircuit')}
            exact={mine.exact}
            onOpen={(n) => router.push(`/election-race/judicial-subcircuit-${n}`)}
            cellLabel={(n) => t('Subcircuit {n} vacancies').replace('{n}', String(n))}
            cellStyle={{ width: '8.5%', flexGrow: 1 }}
          />
          {flaggedSubcircuits.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="alert-circle" size={15} color={theme.danger} />
              <ThemedText type="smallBold" style={{ flex: 1, fontSize: 13, color: theme.danger }}>
                {t('Negative bar ratings for candidates in subcircuits {list}').replace(
                  '{list}',
                  flaggedSubcircuits.join(', ')
                )}
              </ThemedText>
            </View>
          )}
          {!mine.exact && (
            <Pressable
              onPress={() => (profile ? router.push('/my-districts') : openLink(VOTER_LOOKUP_URL))}
              hitSlop={8}
              accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="location-outline" size={14} color={theme.primary} />
              <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
                {t(profile ? 'Look up your districts by address' : 'Look up your sample ballot')}
              </ThemedText>
            </Pressable>
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
