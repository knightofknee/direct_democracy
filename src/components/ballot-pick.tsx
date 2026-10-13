import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { contestOf, maxPicks, useBallot } from '@/lib/ballot';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { notify } from '@/lib/notify';

/**
 * "Pick" on a candidate's card in a race (2026-10-09): adds them to the
 * person's own ballot plan (src/lib/ballot.ts, kept on this device only).
 * Tapping your pick again takes it back; in a one-seat race, picking
 * someone else moves the pick.
 */
export function PickButton({
  race,
  seat,
  candidateId,
  candidateName,
}: {
  race: string;
  seat?: string | null;
  candidateId: string;
  /** Named in the screen reader label, so "Pick" says who. */
  candidateName: string;
}) {
  const t = useT();
  const theme = useTheme();
  const ballot = useBallot();
  const contest = contestOf(race, seat);
  const picked = (ballot.picks[contest] ?? []).includes(candidateId);
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        if (ballot.toggle(contest, candidateId) === 'full') {
          notify(t('You can pick up to {n} here').replace('{n}', String(maxPicks(contest))), t('Take one of your picks back first.'));
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={(picked ? t('Your pick: {name}') : t('Pick {name}')).replace('{name}', candidateName)}
      accessibilityState={{ selected: picked }}
      hitSlop={6}
      style={[
        styles.pill,
        picked
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: 'transparent', borderColor: theme.primary },
      ]}>
      <Ionicons name={picked ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={picked ? '#fff' : theme.primary} />
      <ThemedText type="smallBold" style={{ fontSize: 13, color: picked ? '#fff' : theme.primary }}>
        {picked ? t('Your pick') : t('Pick')}
      </ThemedText>
    </Pressable>
  );
}

/** Retention: "Keep this judge?" yes or no, for the ballot plan. */
export function RetainButtons({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const t = useT();
  const theme = useTheme();
  const ballot = useBallot();
  const answer = ballot.retain[candidateId];
  const option = (value: 'yes' | 'no', label: string) => {
    const on = answer === value;
    return (
      <Pressable
        onPress={() => {
          tapHaptic();
          ballot.setRetain(candidateId, value);
        }}
        // Yes and No are one choice of two, and each says which judge.
        accessibilityRole="radio"
        accessibilityLabel={`${t('Keep {name}?').replace('{name}', candidateName)} ${label}`}
        accessibilityState={{ selected: on }}
        hitSlop={6}
        style={[
          styles.pill,
          on ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.primary },
        ]}>
        <ThemedText type="smallBold" style={{ fontSize: 13, color: on ? '#fff' : theme.primary }}>
          {label}
        </ThemedText>
      </Pressable>
    );
  };
  return (
    <View style={styles.retainRow}>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
        {t('Keep this judge?')}
      </ThemedText>
      {option('yes', t('Yes'))}
      {option('no', t('No'))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
  },
  retainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
