import { useRouter } from 'expo-router';
import { collection, collectionGroup, orderBy, query, where } from 'firebase/firestore';
import React from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { plural, timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { usePageSummary } from '@/lib/page-help';
import type { AmaQuestion, Concern } from '@/lib/types';

/** Everything you've put on the record, in one place. */
export default function MyActivityScreen() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const t = useT();

  const { data: concerns, loading: concernsLoading } = useLiveQuery<Concern>(
    () =>
      profile
        ? query(
            collection(db, 'concerns'),
            where('authorUid', '==', profile.uid),
            orderBy('createdAt', 'desc')
          )
        : null,
    [profile?.uid]
  );

  const { data: questions, loading: questionsLoading } = useLiveQuery<AmaQuestion>(
    () =>
      profile
        ? query(
            collectionGroup(db, 'questions'),
            where('authorUid', '==', profile.uid),
            orderBy('createdAt', 'desc')
          )
        : null,
    [profile?.uid]
  );

  const awaiting = questions.filter((q) => q.status === 'awaitingResponse').length;
  usePageSummary('my-activity', [
    !profile
      ? t('You are signed out.')
      : !concernsLoading &&
        !questionsLoading &&
        t('Concerns you raised: {concerns}. Questions you asked: {questions}.')
          .replace('{concerns}', String(concerns.length))
          .replace('{questions}', String(questions.length)),
    profile && awaiting > 0 && t('Still waiting for a response: {n}.').replace('{n}', String(awaiting)),
  ]);

  if (authLoading)
    return (
      <Screen>
        <SkeletonCards />
      </Screen>
    );
  if (!profile) {
    return (
      <Screen>
        <Button title={t('Sign in first')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  const STATUS_LABELS: Record<AmaQuestion['status'], string> = {
    awaitingResponse: 'Awaiting response',
    underReview: 'Community reviewing',
    answered: 'Answered',
    dodged: 'Dodged',
  };

  return (
    <Screen>
      <SectionHeader title={t('My concerns')} subtitle={t('Tap one to see votes and comments')} />
      {concernsLoading ? (
        <SkeletonCards count={2} />
      ) : concerns.length === 0 ? (
        <EmptyState icon="megaphone-outline" message={t("You haven't raised a concern yet.")} />
      ) : (
        concerns.map((c) => (
          <Card key={c.id} onPress={() => router.push(`/concern/${c.id}`)}>
            <ThemedText type="smallBold">{c.title}</ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip label={wardLabel(c.wardId)} tone={c.scope === 'city' ? 'primary' : 'neutral'} />
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {plural(c.tallies.totalAll, 'vote')} · {plural(c.commentCount, 'comment')} ·{' '}
                {timeAgo(c.createdAt)}
              </ThemedText>
            </View>
          </Card>
        ))
      )}

      <SectionHeader title={t('My AMA questions')} subtitle={t("Tap one to see the official's page")} />
      {questionsLoading ? (
        <SkeletonCards count={2} />
      ) : questions.length === 0 ? (
        <EmptyState icon="help-circle-outline" message={t("You haven't asked an official anything yet.")} />
      ) : (
        questions.map((q) => (
          <Card key={q.id} onPress={() => router.push(`/official/${q.officialUid}`)}>
            <ThemedText type="small" style={{ fontSize: 14, lineHeight: 20 }}>
              {q.body}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                label={t(STATUS_LABELS[q.status])}
                tone={q.status === 'answered' ? 'success' : q.status === 'dodged' ? 'danger' : 'neutral'}
              />
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {timeAgo(q.createdAt)}
              </ThemedText>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
