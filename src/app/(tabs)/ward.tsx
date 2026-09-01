import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConcernCard } from '@/components/concern-card';
import { FlagAccent } from '@/components/flag-accent';
import { LensToggle } from '@/components/lens-toggle';
import { PollCard } from '@/components/poll-card';
import { OfficialRow } from '@/components/politician-row';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
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

export default function WardScreen() {
  const { profile, loading } = useAuth();
  // Anyone can browse any ward; residents just land on their own by default.
  const [selected, setSelected] = useState<number | 'picker' | null>(null);
  const homeWard = profile?.wardId ?? null;
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
  const theme = useTheme();
  const { profile } = useAuth();
  const canGoHome = profile?.wardId != null;

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            wards
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Every ward’s board is public. Pick one to browse.
        </ThemedText>
        <FlagAccent />
      </View>

      {canGoHome && (
        <Button title={`Back to my ward (${wardLabel(profile!.wardId)})`} onPress={() => onPick(profile!.wardId!)} />
      )}

      <Card>
        <View style={[styles.wardGrid, { justifyContent: 'center' }]}>
          {WARDS.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => onPick(w.id)}
              style={[styles.wardCell, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <ThemedText type="small" style={{ fontSize: 13 }}>
                {w.id}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* One row, not a pitch: the full verification story lives on /verify.
          Kept compact so the map below clears the fold. */}
      {!profile?.verified && (
        <Card onPress={() => router.push(profile ? '/verify' : '/sign-in')}>
          <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={22} color={theme.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold" style={{ fontSize: 13 }}>
                {profile ? 'Verify your residency' : 'Sign in to verify your residency'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                Verified votes count in your ward’s verified tallies.
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
        </Card>
      )}

      <View style={{ alignItems: 'center', gap: Spacing.one }}>
        <FlagAccent />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          50 wards, one city
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
  const { profile } = useAuth();
  const [lens, setLens] = useState<TallyLens>('verified');
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

  const isWardOfficial = profile?.role === 'official' && profile.wardId === wardId;
  const openPolls = polls.filter((p) => p.open);
  const closedPolls = polls.filter((p) => !p.open);
  const { isBlocked } = useBlocks();
  const visibleConcerns = concerns.filter((c) => !isBlocked(c.authorUid));

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
            All wards
          </ThemedText>
        </Pressable>
      </View>

      {/* Residents first: the ward's own concerns lead the page, the
          alderman and their ballot questions follow. */}
      <SectionHeader
        title="Ward leaderboard"
        subtitle="Anyone can weigh in. Verified counts are residents of this ward only."
      />
      <LensToggle value={lens} onChange={setLens} />
      {isHomeWard && (profile?.verified || profile?.role === 'official') ? (
        <Button
          title="Raise a ward concern"
          variant="secondary"
          onPress={() => router.push({ pathname: '/new-concern', params: { scope: 'ward' } })}
        />
      ) : !profile ? (
        // Signed-out visitors get a door, not a dead end.
        <>
          <Button title="Sign in to vote and comment" variant="secondary" onPress={() => router.push('/sign-in')} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            Raising a ward concern takes a verified resident of the ward.
          </ThemedText>
        </>
      ) : !profile.verified ? (
        <>
          <Button title="Verify to unlock your home ward" variant="secondary" onPress={() => router.push('/verify')} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            Anyone can vote and comment here; raising a ward concern takes a verified resident.
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {profile.wardId == null
            ? 'Anyone can vote and comment here; ward posting unlocks once your verification includes your ward.'
            : `Anyone can vote and comment here; you raise ward concerns in your home ward, the ${wardLabel(profile.wardId)}.`}
        </ThemedText>
      )}
      {loading ? (
        <SkeletonCards />
      ) : visibleConcerns.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          message={isHomeWard ? 'No ward concerns yet. Raise the first one.' : 'No concerns in this ward yet.'}
        />
      ) : (
        visibleConcerns.map((concern, i) => (
          <ConcernCard key={concern.id} concern={concern} rank={i + 1} lens={lens} index={i} />
        ))
      )}

      {alderman && <OfficialRow official={alderman} />}

      {isWardOfficial && (
        <Button title="Put a question to your ward" onPress={() => router.push('/new-poll')} />
      )}

      {openPolls.length > 0 && (
        <>
          <SectionHeader title="On the ballot" subtitle="Open votes from your alderman - verified residents only" />
          {openPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </>
      )}

      {closedPolls.length > 0 && (
        <>
          <SectionHeader title="Past votes" />
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
