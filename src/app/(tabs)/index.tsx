import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConcernCard } from '@/components/concern-card';
import { FlagAccent } from '@/components/flag-accent';
import { LensToggle } from '@/components/lens-toggle';
import { PollCard } from '@/components/poll-card';
import { Screen } from '@/components/screen';
import { SkeletonButton, SkeletonCards } from '@/components/skeleton';
import { SortToggle, sortConcerns, type ConcernSort } from '@/components/sort-toggle';
import { ThemedText } from '@/components/themed-text';
import { Button, ChicagoStar, EmptyState, InfoModal, SectionHeader } from '@/components/ui';
import { CITY } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { Concern, Poll, TallyLens } from '@/lib/types';

export default function BigBoardScreen() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [lens, setLens] = useState<TallyLens>('all');
  const [sort, setSort] = useState<ConcernSort>('top');

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
  // Ranks come from the score order regardless of the display sort, so a
  // concern keeps its board position while the list shows it by date.
  const rankById = new Map(visibleConcerns.map((c, i) => [c.id, i + 1]));
  const displayConcerns = sortConcerns(visibleConcerns, sort);

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
          {CITY.name}’s top concerns, ranked by the people.
        </ThemedText>
        <FlagAccent />
      </View>

      <LensToggle value={lens} onChange={setLens} />
      <SortToggle value={sort} onChange={setSort} />

      {authLoading ? (
        <SkeletonButton />
      ) : profile ? (
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
        displayConcerns.map((concern, i) => (
          <ConcernCard
            key={concern.id}
            concern={concern}
            rank={rankById.get(concern.id)}
            lens={lens}
            index={i}
          />
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

      <VerifiedInfo />
    </Screen>
  );
}

/**
 * The verified-votes explainer lives behind an info icon so the board stays
 * clean; the modal names Didit and spells out exactly what we receive.
 */
function VerifiedInfo() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityLabel="About verified votes and your data"
        style={styles.footer}>
        <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
      </Pressable>
      <InfoModal visible={open} onClose={() => setOpen(false)} title="Verified votes">
        <ThemedText type="small">
          Every tally counts two ways: all users, and verified users. Verified means an adult
          Chicago resident of a ward - nothing about party or voter registration. Use the toggle
          to switch views.
        </ThemedText>
        <ThemedText type="small">
          Verification is handled by Didit, an independent identity service. Your documents go to
          Didit, never to us - all we ever receive is a yes/no and your ward.
        </ThemedText>
      </InfoModal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  footer: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
