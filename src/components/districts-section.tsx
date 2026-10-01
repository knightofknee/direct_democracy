import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Pressable, View } from 'react-native';

import { DistrictCells } from '@/components/district-cells';
import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { DISTRICT_FAMILIES, GENERAL_ELECTION, VOTER_LOOKUP_URL } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { useMyDistricts, type DistrictType } from '@/lib/districts';
import { db } from '@/lib/firebase';
import { openLink } from '@/lib/open-link';
import type { ElectionCandidateCard } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** Each family's field in a person's Districts. */
const TYPE_OF: Record<string, DistrictType> = {
  'us-house': 'usHouse',
  'il-senate': 'ilSenate',
  'il-house': 'ilHouse',
  'cook-commissioner': 'cookCommissioner',
  'cook-board-of-review': 'boardOfReview',
};

/**
 * The races drawn by district rather than ward: Congress, the state
 * legislature, county commissioners, the Board of Review. Each grid leads
 * with the viewer's own district (from their address) or their ward's few,
 * with every district one tap away. Signed-in people without an address on
 * file get the in-app lookup; everyone else, the county's.
 */
export function DistrictsSection() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const mine = useMyDistricts();

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

      {!mine.exact && (
        <Card>
          <Pressable
            onPress={() => (profile ? router.push('/my-districts') : openLink(VOTER_LOOKUP_URL))}
            hitSlop={8}
            accessibilityRole="link"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="location-outline" size={14} color={theme.primary} />
            <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
              {t('Look up your districts by address')}
            </ThemedText>
          </Pressable>
        </Card>
      )}

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
          <DistrictCells
            all={f.districts}
            mine={mine.of(TYPE_OF[f.prefix]) as number[] | null}
            exact={mine.exact}
            onOpen={(n) => router.push(`/election-race/${f.prefix}-${n}`)}
            cellLabel={f.districtLabel}
            cellStyle={{ minWidth: 44, flexGrow: 1, maxWidth: 72 }}
          />
        </Card>
      ))}
    </View>
  );
}

