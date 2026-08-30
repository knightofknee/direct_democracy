import { collection, orderBy, query } from 'firebase/firestore';
import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FlagAccent } from '@/components/flag-accent';
import { CandidateRow } from '@/components/politician-row';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ChicagoStar, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import type { Candidate } from '@/lib/types';

/**
 * The election tab: every candidate on the platform, each carrying their
 * more perfect platform - the full slate of policies, open to votes and
 * comments from the whole city.
 */
export default function ElectionScreen() {
  const { data: candidates, loading } = useLiveQuery<Candidate & { id: string }>(
    () => query(collection(db, 'candidates'), orderBy('name')),
    []
  );

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            election
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          The more perfect platform: every candidate lays out their full platform, and the city
          debates each policy, plank by plank.
        </ThemedText>
        <FlagAccent />
      </View>

      {loading ? (
        <SkeletonCards />
      ) : candidates.length === 0 ? (
        <EmptyState icon="ribbon-outline" message="No candidates on the platform yet." />
      ) : (
        candidates.map((candidate, i) => (
          <Animated.View
            key={candidate.uid}
            entering={FadeInDown.duration(280).delay(Math.min(i, 8) * 45)}>
            <CandidateRow candidate={candidate} />
          </Animated.View>
        ))
      )}
    </Screen>
  );
}
