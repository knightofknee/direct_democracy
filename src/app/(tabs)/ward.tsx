import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConcernCard } from '@/components/concern-card';
import { FlagAccent } from '@/components/flag-accent';
import { HomeWardChoice } from '@/components/home-ward-choice';
import { PollCard } from '@/components/poll-card';
import { OfficialRow } from '@/components/politician-row';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ListControls, sortConcerns, type ConcernSort } from '@/components/list-controls';
import { ThemedText } from '@/components/themed-text';
import { WardMap } from '@/components/ward-map';
import { Button, Card, ChicagoStar, EmptyState, SectionHeader } from '@/components/ui';
import { WARDS, wardById, wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { Concern, Official, Poll, TallyLens } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import { computeGrade } from '@/services/officials';

export default function WardScreen() {
  const { profile, loading } = useAuth();
  // Anyone can browse any ward; residents just land on their own by default.
  // A pick is remembered with the home ward it was made under, so setting or
  // changing the home ward lands on the new one.
  const homeWard = profile?.wardId ?? null;
  const [pick, setPick] = useState<{ view: number | 'picker'; home: number | null } | null>(null);
  const selected = pick && pick.home === homeWard ? pick.view : null;
  const setSelected = (view: number | 'picker' | null) => setPick(view == null ? null : { view, home: homeWard });
  const view = selected ?? homeWard ?? 'picker';

  if (loading)
    return (
      <Screen tab>
        <SkeletonCards />
      </Screen>
    );
  if (view === 'picker') return <WardPicker onPick={setSelected} />;
  return (
    <WardHome
      wardId={view}
      isHomeWard={homeWard != null && view === homeWard}
      onBrowseOthers={() => setSelected('picker')}
    />
  );
}

/** Every ward, open to every visitor - verification only decides where you can VOTE. */
function WardPicker({ onPick }: { onPick: (wardId: number) => void }) {
  const router = useRouter();
  const t = useT();
  const theme = useTheme();
  const { profile } = useAuth();
  const canGoHome = profile?.wardId != null;
  usePageSummary('(tabs)/ward', [
    t('Showing all 50 wards to pick from.'),
    profile?.wardId != null
      ? t(profile.verified ? 'Your home ward: the {ward}, verified.' : 'Your home ward: the {ward}, set without an ID.').replace(
          '{ward}',
          wardLabel(profile.wardId)
        )
      : profile
        ? t('You have no home ward yet.')
        : t('You are signed out.'),
  ]);

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            {t('wards')}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {t('Every ward’s board is public. Pick one to browse.')}
        </ThemedText>
        <FlagAccent />
      </View>

      {canGoHome && (
        <Button title={`${t('Back to my ward')} (${wardLabel(profile!.wardId)})`} onPress={() => onPick(profile!.wardId!)} />
      )}

      <Card>
        <View style={[styles.wardGrid, { justifyContent: 'center' }]}>
          {WARDS.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => onPick(w.id)}
              accessibilityRole="button"
              accessibilityLabel={wardLabel(w.id)}
              style={[styles.wardCell, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <ThemedText type="small" style={{ fontSize: 13 }}>
                {w.id}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* The way into a ward. No ward yet: both doors, verify or set it
          without an ID. A declared ward: just the verify row. Kept compact
          so the map below clears the fold. */}
      {profile && !profile.verified && profile.wardId == null ? (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            {t('Join your ward')}
          </ThemedText>
          <HomeWardChoice note={t('Raise concerns, vote on ward polls, and rate your alderman.')} />
        </Card>
      ) : (
        !profile?.verified && (
          <Card onPress={() => router.push(profile ? '/verify' : '/sign-in')}>
            <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
              <Ionicons name="shield-checkmark" size={22} color={theme.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold" style={{ fontSize: 13 }}>
                  {t(profile ? 'Verify your residency' : 'Sign in to join your ward')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  {profile
                    ? t('Verified residents also count in the verified tallies.')
                    : t('Raise concerns, vote on ward polls, and rate your alderman.')}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </View>
          </Card>
        )
      )}

      <View style={{ alignItems: 'center', gap: Spacing.one }}>
        <FlagAccent />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('50 wards, one city')}
        </ThemedText>
        <View style={{ alignSelf: 'stretch', marginTop: Spacing.one }}>
          <WardMap homeWard={profile?.wardId ?? null} onPick={onPick} />
        </View>
      </View>
    </Screen>
  );
}

function WardHome({
  wardId,
  isHomeWard,
  onBrowseOthers,
}: {
  wardId: number;
  isHomeWard: boolean;
  onBrowseOthers: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const [lens, setLens] = useState<TallyLens>('verified');
  const [sort, setSort] = useState<ConcernSort>('top');
  const ward = wardById(wardId);

  const rankField = lens === 'verified' ? 'scoreVerified' : 'score';
  const { data: concerns, loading } = useLiveQuery<Concern>(
    () =>
      query(
        collection(db, 'concerns'),
        where('scope', '==', 'ward'),
        where('wardId', '==', wardId),
        orderBy(rankField, 'desc'),
        orderBy('createdAt', 'desc')
      ),
    [wardId, rankField]
  );

  const { data: polls } = useLiveQuery<Poll>(
    () =>
      query(
        collection(db, 'polls'),
        where('scope', '==', 'ward'),
        where('wardId', '==', wardId),
        orderBy('createdAt', 'desc')
      ),
    [wardId]
  );

  const { data: aldermen } = useLiveQuery<Official>(
    () => query(collection(db, 'officials'), where('wardId', '==', wardId)),
    [wardId]
  );
  const alderman = aldermen[0];

  const openPolls = polls.filter((p) => p.open);
  const closedPolls = polls.filter((p) => !p.open);
  const { isBlocked } = useBlocks();
  const visibleConcerns = concerns.filter((c) => !isBlocked(c.authorUid));
  // Same contract as the big board: rank badges follow the score order even
  // when the list is displayed by date.
  const rankById = new Map(visibleConcerns.map((c, i) => [c.id, i + 1]));
  const displayConcerns = sortConcerns(visibleConcerns, sort);

  // The help sheet's summary of this ward's board as it stands.
  const aldermanGrade = alderman ? computeGrade(alderman) : null;
  usePageSummary('(tabs)/ward', [
    t(isHomeWard ? 'Showing the {ward}, your home ward.' : 'Showing the {ward}.').replace('{ward}', wardLabel(wardId)),
    !loading && t('Ward concerns: {n}.').replace('{n}', String(visibleConcerns.length)),
    visibleConcerns[0] && t('Ranked first: “{title}”.').replace('{title}', visibleConcerns[0].title),
    alderman &&
      aldermanGrade &&
      (aldermanGrade.overall != null
        ? t('Alderman: {name}, overall grade {letter}.')
            .replace('{name}', alderman.name)
            .replace('{letter}', aldermanGrade.letter)
        : t('Alderman: {name}, not graded yet.').replace('{name}', alderman.name)),
    openPolls.length > 0
      ? t('Open ward polls: {n}.').replace('{n}', String(openPolls.length))
      : t('No ward polls are open.'),
  ]);

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            {wardLabel(wardId).toLowerCase()}
          </ThemedText>
        </View>
        {ward && (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {ward.areas}
          </ThemedText>
        )}
        <FlagAccent />
        <Pressable onPress={onBrowseOthers} hitSlop={8} style={styles.browseButton}>
          <Ionicons name="map-outline" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>
            {t('All wards')}
          </ThemedText>
        </Pressable>
      </View>

      {!profile ? (
        // Signed-out visitors get a door, not a dead end.
        <Button title={t('Sign in to vote and comment')} variant="secondary" onPress={() => router.push('/sign-in')} />
      ) : (
        <>
          <Button
            title={t(isHomeWard ? 'Raise a ward concern' : 'Raise a concern in this ward')}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/new-concern', params: { scope: 'ward', wardId: String(wardId) } })
            }
          />
          {!isHomeWard && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {profile.wardId == null
                ? t('Anyone can post here once a week. With a home ward you can post there up to 3 times a day, vote on its polls, and rate its alderman.')
                : t('This isn’t your home ward, so you can post here once a week.')}
            </ThemedText>
          )}
          {profile.wardId == null && <HomeWardChoice />}
        </>
      )}
      {/* Residents first: the ward's own concerns lead the page (the way to
          raise one sits above them, like the big board's), the alderman and
          their ballot questions follow. */}
      <SectionHeader
        title={t('Ward leaderboard')}
        subtitle={t('Anyone can weigh in. Verified counts are residents of this ward only.')}
      />
      <ListControls lens={lens} onLensChange={setLens} sort={sort} onSortChange={setSort} />
      {loading ? (
        <SkeletonCards />
      ) : visibleConcerns.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          message={t(isHomeWard ? 'No ward concerns yet. Raise the first one.' : 'No concerns in this ward yet.')}
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

      {alderman && <OfficialRow official={alderman} />}

      {openPolls.length > 0 && (
        <>
          <SectionHeader title={t('On the ballot')} subtitle={t('Open votes from your alderman, for residents of the ward. Verified residents are counted apart.')} />
          {openPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </>
      )}

      {closedPolls.length > 0 && (
        <>
          <SectionHeader title={t('Past votes')} />
          {closedPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  // flexBasis packs 7 per row on phones (8 rows, so the picker fits without
  // scrolling); flexGrow then stretches each row edge to edge, and maxWidth
  // keeps a short last row (the lone 50) from ballooning.
  wardCell: {
    flexGrow: 1,
    flexBasis: 38,
    maxWidth: 52,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
