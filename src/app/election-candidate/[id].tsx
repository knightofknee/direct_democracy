import { doc } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { OfficialAvatar } from '@/components/avatar';
import { CopyLinkButton } from '@/components/copy-link';
import { RatingChips } from '@/components/rating-chips';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { WriteInChip, WriteInNote } from '@/components/write-in';
import { GENERAL_ELECTION, generalRaceLabel, municipalRaceLabel } from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useLiveDoc } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { host } from '@/lib/format';
import { openLink } from '@/lib/open-link';
import type { ElectionCandidateCard } from '@/lib/types';
import { useT, useLocalized } from '@/lib/i18n';

/**
 * A ballot candidate's voter-info card: what they say they are running on,
 * their background, and their campaign site. Compiled from public sources -
 * these candidates do not (yet) have accounts on the platform. Serves both
 * the November 2026 and February 2027 directories.
 */
export default function ElectionCandidateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const loc = useLocalized();

  const { data: candidate, loading } = useLiveDoc<ElectionCandidateCard>(
    () => (id ? doc(db, 'electionCandidates', id) : null),
    [id]
  );

  if (!candidate) {
    return (
      <Screen>
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <EmptyState icon="alert-circle-outline" message={t('Candidate not found.')} />
        )}
      </Screen>
    );
  }

  const raceLabel =
    candidate.election === GENERAL_ELECTION
      ? generalRaceLabel(candidate.race)
      : municipalRaceLabel(candidate.race);

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
          <OfficialAvatar
            name={candidate.name}
            photoUrl={candidate.photoUrl ?? null}
            frame={candidate.photoFrame}
            size={56}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText type="subtitle" style={{ fontSize: 20, lineHeight: 26 }}>
              {candidate.name}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
              <Chip label={t(raceLabel)} />
              {candidate.party && <Chip label={t(candidate.party)} />}
              {candidate.incumbent && <Chip label={t('Incumbent')} tone="primary" />}
              {candidate.writeIn && <WriteInChip />}
            </View>
          </View>
        </View>
        {candidate.website ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Button
              title={`${t('Campaign site')} (${host(candidate.website)})`}
              variant="secondary"
              onPress={() => openLink(candidate.website!)}
              style={{ flex: 1 }}
            />
            <CopyLinkButton url={candidate.website} label={t('Copy campaign site link')} />
          </View>
        ) : null}
      </Card>

      {candidate.writeIn && <WriteInNote />}

      {(candidate.seat || candidate.court) && (
        <Card>
          <ThemedText type="small" style={{ fontSize: 14, lineHeight: 20 }}>
            {[candidate.seat, candidate.court && t(candidate.court)].filter(Boolean).join(' · ')}
          </ThemedText>
        </Card>
      )}

      {candidate.ratings && candidate.ratings.length > 0 && (
        <>
          <SectionHeader title={t('Ratings')} subtitle={t('As published by each screening body; tap one to read its evaluation.')} />
          <Card>
            <RatingChips ratings={candidate.ratings} />
          </Card>
        </>
      )}

      <SectionHeader title={t(candidate.race === 'judicial-retention' ? 'Record' : 'Running on')} />
      <Card>
        <ThemedText type="small" style={{ fontSize: 15, lineHeight: 22 }}>
          {loc(candidate.runningOn, candidate.runningOnEs)}
        </ThemedText>
      </Card>

      {candidate.priorCareer ? (
        <>
          <SectionHeader title={t('Background')} />
          <Card>
            <ThemedText type="small" style={{ fontSize: 15, lineHeight: 22 }}>
              {loc(candidate.priorCareer, candidate.priorCareerEs)}
            </ThemedText>
          </Card>
        </>
      ) : null}

      {candidate.sourceUrls.length > 0 && (
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Compiled from public sources:')}
          </ThemedText>
          {candidate.sourceUrls.map((url) => (
            <ThemedText
              key={url}
              type="small"
              themeColor="textSecondary"
              style={{ fontSize: 12, textDecorationLine: 'underline' }}
              onPress={() => openLink(url)}>
              {host(url)}
            </ThemedText>
          ))}
        </View>
      )}
    </Screen>
  );
}
