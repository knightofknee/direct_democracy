import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConcernCard } from '@/components/concern-card';
import { FlagAccent } from '@/components/flag-accent';
import { LensToggle } from '@/components/lens-toggle';
import { PollCard } from '@/components/poll-card';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, ChicagoStar, EmptyState, SectionHeader } from '@/components/ui';
import { CITY } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { Concern, Poll, TallyLens } from '@/lib/types';

export default function BigBoardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [lens, setLens] = useState<TallyLens>('all');

  // Each lens ranks by its own score, so the order you see is the order
  // that lens's voters produced.
  const rankField = lens === 'verified' ? 'scoreVerified' : 'score';
  const { data: concerns, loading } = useLiveQuery<Concern>(
    () =>
      query(
        collection(db, 'concerns'),
        where('scope', '==', 'city'),
        orderBy(rankField, 'desc'),
        orderBy('createdAt', 'desc')
      ),
    [rankField]
  );

  const { isBlocked } = useBlocks();
  const visibleConcerns = concerns.filter((c) => !isBlocked(c.authorUid));

  const { data: cityPolls } = useLiveQuery<Poll>(
    () =>
      query(
        collection(db, 'polls'),
        where('scope', '==', 'city'),
        where('open', '==', true),
        orderBy('createdAt', 'desc')
      ),
    []
  );

  return (
    <Screen tab>
      <View style={[styles.header, { alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            big board
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {CITY.name}’s top concerns, ranked by the people. Vote priority, not just up or down.
        </ThemedText>
        <FlagAccent />
      </View>

      <LensToggle value={lens} onChange={setLens} />

      {profile ? (
        <Button title="Raise a concern" onPress={() => router.push('/new-concern')} />
      ) : (
        <Button title="Sign in to raise a concern" variant="secondary" onPress={() => router.push('/sign-in')} />
      )}

      {loading ? (
        <SkeletonCards />
      ) : visibleConcerns.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          message="No citywide concerns yet. Be the first to raise one."
        />
      ) : (
        visibleConcerns.map((concern, i) => (
          <ConcernCard key={concern.id} concern={concern} rank={i + 1} lens={lens} index={i} />
        ))
      )}

      {cityPolls.length > 0 && (
        <>
          <SectionHeader
            title="Citywide votes"
            subtitle="Questions put to the whole city by elected officials"
          />
          {cityPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </>
      )}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={14} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, flex: 1 }}>
          Every result shows the general vote and the verified vote. Verification is handled by a
          third party; we never see your documents.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
    marginTop: Spacing.two,
  },
});
