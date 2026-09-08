import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { ordinal, wardLabel } from '@/constants/chicago';
import {
  MUNICIPAL_2027_CITYWIDE,
  MUNICIPAL_2027_FILING,
  MUNICIPAL_ELECTION,
  MUNICIPAL_ELECTION_DATE,
  POLICE_DISTRICTS,
} from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { ElectionCandidateCard } from '@/lib/types';
import { usePlural, useT } from '@/lib/i18n';

// The last ward race opened from the grid, so someone without a verified
// ward still gets a one-tap way back to the race they care about.
const LAST_WARD_KEY = 'wardRace.lastWard';

/**
 * The February 2027 municipal races beyond mayor: every ward's aldermanic
 * seat plus the two other citywide offices. Each ward race pairs the
 * incumbent's report card with their declared challengers - your ward
 * leads if we know it, the grid covers the rest of the city.
 */
export function WardRaceSection() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();
  const { profile } = useAuth();

  const { data: candidates } = useLiveQuery<ElectionCandidateCard>(
    () =>
      query(collection(db, 'electionCandidates'), where('election', '==', MUNICIPAL_ELECTION)),
    []
  );
  const countByRace = new Map<string, number>();
  for (const c of candidates) countByRace.set(c.race, (countByRace.get(c.race) ?? 0) + 1);

  const verifiedWard =
    profile?.wardId != null && profile.wardId >= 1 && profile.wardId <= 50
      ? profile.wardId
      : null;

  const [lastWard, setLastWard] = useState<number | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(LAST_WARD_KEY)
      .then((v) => {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 1 && n <= 50) setLastWard(n);
      })
      .catch(() => {});
  }, []);

  const openWard = (ward: number) => {
    setLastWard(ward);
    AsyncStorage.setItem(LAST_WARD_KEY, String(ward)).catch(() => {});
    router.push(`/ward-race/${ward}`);
  };

  // Districts with anyone on record; the grid stays hidden until there is one.
  const pdcDeclared = POLICE_DISTRICTS.filter((d) => countByRace.has(`pdc-${d}`));

  // A verified ward wins; otherwise the ward they last picked stands in.
  const myWard = verifiedWard ?? lastWard;
  const myWardTitle = verifiedWard != null ? t('Your ward') : t('Your last pick');

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('ward races - february 2027')}
        subtitle={t(`Every alderman's seat and every police district council is on the ${MUNICIPAL_ELECTION_DATE} ballot with the mayor's race above. ${MUNICIPAL_2027_FILING}; candidates appear here as they declare.`)}
      />

      {MUNICIPAL_2027_CITYWIDE.map((race) => (
        <Card key={race.id} onPress={() => router.push(`/election-race/${race.id}`)}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                {t(race.label)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t(race.detail)}
                {countByRace.has(race.id)
                  ? ` · ${pluralT(countByRace.get(race.id)!, 'candidate')}`
                  : ''}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      ))}

      {myWard != null && (
        <Card onPress={() => openWard(myWard)}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                {myWardTitle}: {wardLabel(myWard)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t("Your alderman's record next to everyone running against them.")}
                {countByRace.has(`ward-${myWard}`)
                  ? ` · ${pluralT(countByRace.get(`ward-${myWard}`)!, 'candidate')}`
                  : ''}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t("Every ward's race")}
        </ThemedText>
        <View style={styles.grid}>
          {Array.from({ length: 50 }, (_, i) => i + 1).map((ward) => {
            const declared = countByRace.has(`ward-${ward}`);
            return (
              <Pressable
                key={ward}
                onPress={() => openWard(ward)}
                accessibilityRole="button"
                accessibilityLabel={`${wardLabel(ward)} race`}
                style={({ pressed }) => [
                  styles.wardButton,
                  {
                    borderColor: declared ? theme.primary : theme.border,
                    backgroundColor: theme.background,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ fontSize: 14, color: declared ? theme.primary : theme.text }}>
                  {ward}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Highlighted wards have declared candidates on record.')}
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t('Police district councils')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
          {t('Three elected seats in each of the 22 police districts, on the same February ballot. Police districts do not follow ward lines; your sample ballot names yours.')}
        </ThemedText>
        {pdcDeclared.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13, lineHeight: 19 }}>
            {t('No candidates are on record yet. Filing runs October 19-26, 2026; the districts fill in here as candidates declare.')}
          </ThemedText>
        ) : (
        <View style={styles.grid}>
          {POLICE_DISTRICTS.map((district) => {
            const declared = countByRace.has(`pdc-${district}`);
            return (
              <Pressable
                key={district}
                onPress={() => router.push(`/election-race/pdc-${district}`)}
                accessibilityRole="button"
                accessibilityLabel={`${ordinal(district)} Police District Council race`}
                style={({ pressed }) => [
                  styles.wardButton,
                  {
                    borderColor: declared ? theme.primary : theme.border,
                    backgroundColor: theme.background,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ fontSize: 14, color: declared ? theme.primary : theme.text }}>
                  {district}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        )}
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
  wardButton: {
    width: '8.5%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 8,
  },
});
