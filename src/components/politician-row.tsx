import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { OfficialAvatar } from '@/components/avatar';
import { GradeBadge } from '@/components/grade-badge';
import { ThemedText } from '@/components/themed-text';
import { Card, Chip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useScreenRoom } from '@/hooks/use-screen-room';
import { useTheme } from '@/hooks/use-theme';
import type { Candidate, Official } from '@/lib/types';
import { computeGrade } from '@/services/officials';
import { usePlural, useT } from '@/lib/i18n';

/**
 * An official's public row card - portrait, claim status, grade - as shown on
 * the ward tab and previewed to the official on their own profile tab.
 */
export function OfficialRow({ official }: { official: Official }) {
  const router = useRouter();
  const theme = useTheme();
  // The whole card is the tap target; on a tight screen the chevron's width
  // goes to the name instead.
  const { tight } = useScreenRoom();
  const t = useT();
  const grade = computeGrade(official);
  return (
    <Card onPress={() => router.push(`/official/${official.uid}`)}>
      <View style={styles.row}>
        <OfficialAvatar name={official.name} photoUrl={official.photoUrl} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: Spacing.two, rowGap: 2 }}>
            <ThemedText type="smallBold">{official.name}</ThemedText>
            {official.claimed && <Chip label={t('on the platform')} tone="success" />}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {official.title} · {t('ask them anything')}
          </ThemedText>
        </View>
        <GradeBadge letter={grade.letter} score={grade.overall} />
        {tight ? null : <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
      </View>
    </Card>
  );
}

/** A candidate's public row card, as listed on the election tab. */
export function CandidateRow({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const theme = useTheme();
  // The whole card is the tap target; on a tight screen the chevron's width
  // goes to the name instead.
  const { tight } = useScreenRoom();
  const t = useT();
  const pluralT = usePlural();
  return (
    <Card onPress={() => router.push(`/candidate/${candidate.uid}`)}>
      <View style={styles.row}>
        <OfficialAvatar name={candidate.name} photoUrl={candidate.photoUrl} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <ThemedText type="smallBold" style={{ fontSize: 15 }}>
            {candidate.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t(candidate.office)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {candidate.directory
              ? pluralT(candidate.policyCount ?? 0, 'candidate')
              : pluralT(candidate.policyCount ?? 0, 'policy', 'policies')}
          </ThemedText>
        </View>
        {tight ? null : <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
