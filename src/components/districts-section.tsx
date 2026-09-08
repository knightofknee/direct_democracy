import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { DISTRICT_FAMILIES, GENERAL_ELECTION, VOTER_LOOKUP_URL } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { openLink } from '@/lib/open-link';
import type { ElectionCandidateCard } from '@/lib/types';
import { useT } from '@/lib/i18n';

/**
 * The races drawn by district rather than ward: Congress, the state
 * legislature, county commissioners, the Board of Review. Wards don't map
 * to districts, so the section opens with the address lookup and then lists
 * every district that touches the city, one grid per office.
 */
export function DistrictsSection() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();

  const { data: cards } = useLiveQuery<ElectionCandidateCard>(
    () => query(collection(db, 'electionCandidates'), where('election', '==', GENERAL_ELECTION)),
    []
  );

  const families = DISTRICT_FAMILIES.filter((f) => f.prefix !== 'judicial-subcircuit')
    .map((f) => {
      const districts = new Set<number>();
      for (const c of cards) {
        const m = c.race.match(new RegExp(`^${f.prefix}-(\\d+)$`));
        if (m) districts.add(Number(m[1]));
      }
      return { ...f, districts: [...districts].sort((a, b) => a - b) };
    })
    .filter((f) => f.districts.length > 0);

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('your districts')}
        subtitle={t('Congress, the state legislature, and county seats are drawn by district, not ward. Your sample ballot names yours; every district that touches the city is here.')}
      />

      <Card>
        <Pressable
          onPress={() => openLink(VOTER_LOOKUP_URL)}
          hitSlop={8}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="location-outline" size={14} color={theme.primary} />
          <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
            {t('Look up your districts by address')}
          </ThemedText>
        </Pressable>
      </Card>

      {families.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
          {t('District races are being added; check back shortly.')}
        </ThemedText>
      )}

      {families.map((f) => (
        <Card key={f.prefix}>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            {t(f.label)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
            {t(f.detail)}
          </ThemedText>
          <View style={styles.grid}>
            {f.districts.map((n) => (
              <Pressable
                key={n}
                onPress={() => router.push(`/election-race/${f.prefix}-${n}`)}
                accessibilityRole="button"
                accessibilityLabel={f.districtLabel(n)}
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
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    minWidth: 44,
    flexGrow: 1,
    maxWidth: 72,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 8,
  },
});
