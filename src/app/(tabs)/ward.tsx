import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OfficialAvatar } from '@/components/avatar';
import { ConcernCard } from '@/components/concern-card';
import { FlagAccent } from '@/components/flag-accent';
import { GradeBadge } from '@/components/grade-badge';
import { LensToggle } from '@/components/lens-toggle';
import { PollCard } from '@/components/poll-card';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ChicagoStar, EmptyState, SectionHeader } from '@/components/ui';
import { wardById, wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import type { Concern, Official, Poll, TallyLens } from '@/lib/types';
import { computeGrade } from '@/services/officials';

export default function WardScreen() {
  const { profile, loading } = useAuth();
  const hasWardAccess =
    !!profile && profile.wardId != null && (profile.verified || profile.role === 'official');

  if (loading) return <Screen tab>{null}</Screen>;
  if (!hasWardAccess) return <WardGate signedIn={!!profile} />;
  return <WardHome wardId={profile!.wardId!} />;
}

/** The pitch shown to signed-out and unverified users. */
function WardGate({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen tab>
      <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
        my ward
      </ThemedText>
      <Card>
        <View style={{ alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three }}>
          <Ionicons name="shield-checkmark" size={40} color={theme.primary} />
          <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 24, textAlign: 'center' }}>
            Your ward, verified
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            The ward tab is where your neighborhood speaks with a verified voice: a leaderboard of
            your ward’s concerns, and votes on questions your alderman puts directly to residents.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Verification is one-time and handled by a third party — direct democracy never sees your
            documents, only a yes/no and your ward.
          </ThemedText>
          {signedIn ? (
            <Button title="Verify my identity" onPress={() => router.push('/verify')} />
          ) : (
            <Button title="Sign in to get started" onPress={() => router.push('/sign-in')} />
          )}
        </View>
      </Card>
    </Screen>
  );
}

function WardHome({ wardId }: { wardId: number }) {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const [lens, setLens] = useState<TallyLens>('verified');
  const ward = wardById(wardId);

  const rankField = lens === 'all' ? 'score' : 'scoreVerified';
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

  return (
    <Screen tab>
      <View style={{ gap: Spacing.one }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <ChicagoStar size={18} />
          <ThemedText type="subtitle" style={{ fontSize: 28, lineHeight: 34 }}>
            {wardLabel(wardId).toLowerCase()}
          </ThemedText>
        </View>
        {ward && (
          <ThemedText type="small" themeColor="textSecondary">
            {ward.areas}
          </ThemedText>
        )}
        <FlagAccent />
      </View>

      {alderman && (
        <Card onPress={() => router.push(`/official/${alderman.uid}`)}>
          <View style={styles.aldermanRow}>
            <OfficialAvatar name={alderman.name} photoUrl={alderman.photoUrl} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold">{alderman.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {alderman.title} · ask them anything
              </ThemedText>
            </View>
            <GradeBadge
              letter={computeGrade(alderman).letter}
              score={computeGrade(alderman).overall}
            />
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      )}

      {isWardOfficial && (
        <Button title="Put a question to your ward" onPress={() => router.push('/new-poll')} />
      )}

      {openPolls.length > 0 && (
        <>
          <SectionHeader title="On the ballot" subtitle="Open votes from your alderman — verified residents only" />
          {openPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </>
      )}

      <SectionHeader title="Ward leaderboard" subtitle="Top concerns as voted by people in the ward" />
      <LensToggle value={lens} onChange={setLens} />
      <Button title="Raise a ward concern" variant="secondary" onPress={() => router.push('/new-concern')} />
      {loading ? (
        <SkeletonCards />
      ) : concerns.length === 0 ? (
        <EmptyState icon="megaphone-outline" message="No ward concerns yet. Raise the first one." />
      ) : (
        concerns.map((concern, i) => (
          <ConcernCard key={concern.id} concern={concern} rank={i + 1} lens={lens} index={i} />
        ))
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
  aldermanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
