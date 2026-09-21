import { doc } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { OfficialAvatar } from '@/components/avatar';
import { CopyLinkButton } from '@/components/copy-link';
import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { WriteInChip, WriteInNote } from '@/components/write-in';
import { schoolBoardRaceLabel } from '@/constants/school-board';
import { Spacing } from '@/constants/theme';
import { useLiveDoc } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { host } from '@/lib/format';
import { openLink } from '@/lib/open-link';
import type { SchoolBoardCandidate } from '@/lib/types';
import { useLocalized, useT } from '@/lib/i18n';

/**
 * A school board nominee's voter-info card: what they say they are running
 * on, their background, and their campaign site. Compiled from public
 * sources - these nominees do not (yet) have accounts on the platform.
 */
export default function SchoolBoardCandidateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loc = useLocalized();
  const t = useT();

  const { data: candidate, loading } = useLiveDoc<SchoolBoardCandidate>(
    () => (id ? doc(db, 'schoolBoardCandidates', id) : null),
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
              <Chip label={schoolBoardRaceLabel(candidate.race)} />
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

      <SectionHeader title={t('Running on')} />
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
