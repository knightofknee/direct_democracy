import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pct, plural } from '@/lib/format';
import { tallyFor } from '@/lib/tally';
import type { DualTally, TallyLens } from '@/lib/types';

/**
 * Result bars for one tally through the selected lens, with the other key
 * lens shown inline so the "all users vs verified" comparison is always
 * one glance away - that contrast is the product.
 */
export function TallyResults({
  tally,
  options,
  lens,
  highlightKeys,
}: {
  tally: DualTally;
  options: { key: string; label: string }[];
  lens: TallyLens;
  /** Option keys the current user picked - rendered with the primary color. */
  highlightKeys?: string[];
}) {
  const theme = useTheme();
  const { counts, total } = tallyFor(tally, lens);
  const verified = tallyFor(tally, 'verified');

  return (
    <View style={{ gap: Spacing.two }}>
      {options.map((option) => {
        const count = counts[option.key] ?? 0;
        const percent = pct(count, total);
        const verifiedPercent = pct(verified.counts[option.key] ?? 0, verified.total);
        const mine = highlightKeys?.includes(option.key);
        return (
          <View key={option.key} style={{ gap: 3 }}>
            <View style={styles.labelRow}>
              <ThemedText type="small" style={mine ? { color: theme.primary, fontWeight: '700' } : undefined}>
                {option.label}
                {mine ? '  ✓' : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {lens === 'verified'
                  ? `${percent}%`
                  : `${percent}% · verified ${verifiedPercent}%`}
              </ThemedText>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: mine ? theme.primary : theme.primarySoft,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {plural(total, 'vote')}
        {lens === 'all' ? ` · ${plural(tally.totalVerified, 'verified vote')}` : ''}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});
