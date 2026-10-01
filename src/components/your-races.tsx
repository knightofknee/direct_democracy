import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { DISTRICT_FAMILIES, GENERAL_ELECTION } from '@/constants/elections';
import { schoolBoardRaceLabel } from '@/constants/school-board';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { useMyDistricts, type DistrictType } from '@/lib/districts';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import type { ElectionCandidateCard, SchoolBoardCandidate } from '@/lib/types';

/** The November races an address decides, in ballot order. */
const DISTRICT_RACES: { type: DistrictType; prefix: string }[] = [
  { type: 'usHouse', prefix: 'us-house' },
  { type: 'ilSenate', prefix: 'il-senate' },
  { type: 'ilHouse', prefix: 'il-house' },
  { type: 'cookCommissioner', prefix: 'cook-commissioner' },
  { type: 'boardOfReview', prefix: 'cook-board-of-review' },
  { type: 'subcircuit', prefix: 'judicial-subcircuit' },
];

interface Row {
  key: string;
  label: string;
  names: string[];
  href: string;
}

/**
 * The top of the November ballot (2026-09-30): the races this person's
 * address puts on their ballot, with who is running in each, before
 * anything else. Without an address on file it asks for one, since the
 * address is what lets the tab put their races first and fold the rest
 * away (every race stays one "See all" away in the sections below).
 */
export function YourRaces() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const mine = useMyDistricts();

  const { data: cards, loading: cardsLoading } = useLiveQuery<ElectionCandidateCard>(
    () => query(collection(db, 'electionCandidates'), where('election', '==', GENERAL_ELECTION)),
    []
  );
  const { data: board, loading: boardLoading } = useLiveQuery<SchoolBoardCandidate & { id: string }>(
    () => query(collection(db, 'schoolBoardCandidates')),
    []
  );

  if (!profile || !mine.exact) {
    return (
      <View style={[styles.card, { borderColor: theme.primary, backgroundColor: theme.background }]}>
        <View style={styles.titleRow}>
          <Ionicons name="location" size={18} color={theme.primary} />
          <ThemedText type="smallBold" style={{ fontSize: 16, lineHeight: 22, flex: 1 }}>
            {t('See the races on your ballot')}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13, lineHeight: 19 }}>
          {t('Congress, the state legislature, the county board, judges, and the school board are drawn by district, and your street address decides which of those races you vote in. Enter it once and your races show up here, first. We keep only the district numbers, never the address.')}
        </ThemedText>
        <Button
          title={t(profile ? 'Find my races' : 'Sign in to find your races')}
          onPress={() => router.push(profile ? '/my-districts' : '/sign-in')}
        />
      </View>
    );
  }

  const namesIn = (race: string, list: { race: string; name: string; writeIn?: boolean }[]) =>
    [...list.filter((c) => c.race === race && !c.writeIn), ...list.filter((c) => c.race === race && c.writeIn)].map(
      (c) => c.name
    );

  const rows: Row[] = [];
  const notUp: string[] = [];
  for (const r of DISTRICT_RACES) {
    // Every type here is numbered (only the school board's are '3b'-style).
    const n = mine.of(r.type)?.[0] as number | undefined;
    const family = DISTRICT_FAMILIES.find((f) => f.prefix === r.prefix);
    if (n == null || !family) continue;
    const race = `${r.prefix}-${n}`;
    const names = namesIn(race, cards);
    if (names.length > 0) {
      rows.push({ key: race, label: family.districtLabel(n), names, href: `/election-race/${race}` });
    } else {
      notUp.push(family.districtLabel(n));
    }
  }
  const seat = mine.of('schoolBoard')?.[0];
  if (seat) {
    rows.push({
      key: `school-${seat}`,
      label: `${t('School board')}, ${schoolBoardRaceLabel(seat)}`,
      names: namesIn(seat, board),
      href: `/school-board/${seat}`,
    });
  }
  const loading = cardsLoading || boardLoading;

  return (
    <View style={[styles.card, { borderColor: theme.primary, backgroundColor: theme.background }]}>
      <View style={styles.titleRow}>
        <Ionicons name="location" size={18} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" style={{ fontSize: 16, lineHeight: 22 }}>
            {t('Your races')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
            {t('Decided by your address in the {ward}').replace('{ward}', wardLabel(profile.districts!.wardId))}
          </ThemedText>
        </View>
      </View>

      {rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={() => router.push(row.href as never)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="smallBold" style={{ fontSize: 15, lineHeight: 20 }}>
              {row.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
              {row.names.length > 0 ? row.names.join(', ') : t('No candidates on record yet')}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      ))}

      {!loading && notUp.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
          {t('Not on your ballot this year: {list}.').replace('{list}', notUp.join('; '))}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
        {t('Every Chicagoan also votes on the offices below.')}
      </ThemedText>

      <Pressable
        onPress={() => router.push('/my-districts')}
        hitSlop={8}
        accessibilityRole="link"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name="location-outline" size={14} color={theme.primary} />
        <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
          {t('Use a different address')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
});
