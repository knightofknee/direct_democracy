import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { GENERAL_ELECTION, JUDICIAL_2026, JUDICIAL_RACES, VOTER_LOOKUP_URL } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
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

  // One equality query (no composite index needed); the judicial slice is
  // filtered here.
  const { data: cards } = useLiveQuery<ElectionCandidateCard>(
    () => query(collection(db, 'electionCandidates'), where('election', '==', GENERAL_ELECTION)),
    []
  );
  const countByRace = new Map<string, number>();
  for (const c of cards) {
    if (c.race.startsWith('judicial-')) countByRace.set(c.race, (countByRace.get(c.race) ?? 0) + 1);
  }
  const subcircuits = [...countByRace.keys()]
    .map((r) => r.match(/^judicial-subcircuit-(\d+)$/))
    .filter((m): m is RegExpMatchArray => m != null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);

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
              {t("Independent reporting on every judge on the ballot: their records, controversies, and the bar associations' findings, in one place. The full 2026 guide publishes in late September.")}
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
          <View style={styles.grid}>
            {subcircuits.map((n) => (
              <Pressable
                key={n}
                onPress={() => router.push(`/election-race/judicial-subcircuit-${n}`)}
                accessibilityRole="button"
                accessibilityLabel={`Subcircuit ${n} vacancies`}
                style={({ pressed }) => [
                  styles.cell,
                  { borderColor: theme.border, backgroundColor: theme.background, opacity: pressed ? 0.7 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                  {n}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => openLink(VOTER_LOOKUP_URL)}
            hitSlop={8}
            accessibilityRole="link"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="location-outline" size={14} color={theme.primary} />
            <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
              {t('Look up your sample ballot')}
            </ThemedText>
          </Pressable>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    width: '8.5%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 8,
  },
});
