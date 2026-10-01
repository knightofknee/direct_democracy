import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ConcernCard } from '@/components/concern-card';
import { CouncilSection } from '@/components/council-section';
import { FlagAccent } from '@/components/flag-accent';
import { PollCard } from '@/components/poll-card';
import { Screen } from '@/components/screen';
import { SkeletonButton, SkeletonCards } from '@/components/skeleton';
import { ListControls, sortConcerns, type ConcernSort } from '@/components/list-controls';
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
import { useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';

const BOARD_FIRST = 10;
const BOARD_MORE = 20;

export default function BigBoardScreen() {
  const router = useRouter();
  const t = useT();
  const { profile, loading: authLoading } = useAuth();
  const [lens, setLens] = useState<TallyLens>('all');
  const [sort, setSort] = useState<ConcernSort>('top');
  // The board shows its top 10; each "Show more" adds 20. It's one part of
  // the home tab, so it doesn't run on forever above everything else.
  const [shown, setShown] = useState(BOARD_FIRST);
  const changeLens = (next: TallyLens) => {
    setLens(next);
    setShown(BOARD_FIRST);
  };
  const changeSort = (next: ConcernSort) => {
    setSort(next);
    setShown(BOARD_FIRST);
  };

  // Signing in or out always lands at the top of the board. The board stays
  // mounted under the sign-in sheet, where the keyboard's inset can scroll
  // it, so it goes back to the top as it comes back into view; and at once,
  // for a sign-in that finishes while the board is already showing.
  const scrollRef = useRef<ScrollView>(null);
  const uid = profile?.uid ?? null;
  const backToTop = useRef(false);
  useEffect(() => {
    backToTop.current = true;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      if (!backToTop.current) return;
      backToTop.current = false;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

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

  // The help sheet's summary of the board as it stands.
  const leader = visibleConcerns[0];
  usePageSummary('(tabs)/index', [
    !loading && t('Concerns on the big board: {n}.').replace('{n}', String(visibleConcerns.length)),
    leader &&
      t('Ranked first: “{title}”. Votes: {n}.')
        .replace('{title}', leader.title)
        .replace('{n}', String(lens === 'verified' ? leader.tallies.totalVerified : leader.tallies.totalAll)),
    lens === 'verified' ? t('Ranked by verified votes only.') : t('Ranked by votes from all users.'),
    cityPolls.length > 0
      ? t('Open citywide polls: {n}.').replace('{n}', String(cityPolls.length))
      : t('No citywide polls are open.'),
  ]);

  return (
    <Screen tab ref={scrollRef}>
      <View style={[styles.header, { alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            {t('big board')}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {t('{city}’s top concerns, ranked by the people.').replace('{city}', CITY.name)}
        </ThemedText>
        <FlagAccent />
      </View>

      {authLoading ? (
        <SkeletonButton />
      ) : profile ? (
        <Button title={t('Raise a concern')} onPress={() => router.push('/new-concern')} />
      ) : (
        <Button title={t('Sign in to raise a concern')} variant="secondary" onPress={() => router.push('/sign-in')} />
      )}

      {/* The view settings sit on the list they change, under the way in. */}
      <ListControls lens={lens} onLensChange={changeLens} sort={sort} onSortChange={changeSort} />
      {loading ? (
        <SkeletonCards />
      ) : visibleConcerns.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          message={t('No citywide concerns yet. Be the first to raise one.')}
        />
      ) : (
        <>
          {displayConcerns.slice(0, shown).map((concern, i) => (
            <ConcernCard
              key={concern.id}
              concern={concern}
              rank={rankById.get(concern.id)}
              lens={lens}
              index={i}
            />
          ))}
          {displayConcerns.length > shown && (
            <Button
              title={t('Show more ({n} left)').replace('{n}', String(displayConcerns.length - shown))}
              variant="ghost"
              onPress={() => setShown((n) => n + BOARD_MORE)}
            />
          )}
        </>
      )}

      {cityPolls.length > 0 && (
        <>
          <SectionHeader
            title={t('Citywide votes')}
            subtitle={t('Questions put to the whole city by elected officials')}
          />
          {cityPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </>
      )}

      <CouncilSection />

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
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityLabel={t('About verified votes and your data')}
        style={styles.footer}>
        <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
      </Pressable>
      <InfoModal visible={open} onClose={() => setOpen(false)} title={t('Verified votes')}>
        <ThemedText type="small">
          {t('Every tally counts two ways: all users, and verified users. Verified means an adult Chicago resident of a ward - nothing about party or voter registration. Use the toggle to switch views.')}
        </ThemedText>
        <ThemedText type="small">
          {t('Verification is handled by Didit, an independent identity service. Your documents go to Didit, never to us - all we ever receive is a yes/no, your ward, and your district numbers.')}
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
