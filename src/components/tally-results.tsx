import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pct, plural } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { tallyFor } from '@/lib/tally';
import type { DualTally } from '@/lib/types';

/**
 * Result bars for one tally, all users and verified side by side - the
 * "all users vs verified" contrast is the product, no toggle to hunt for.
 */
export function TallyResults({
  tally,
  options,
  highlightKeys,
  noun = 'vote',
}: {
  tally: DualTally;
  options: { key: string; label: string }[];
  /** Option keys the current user picked - rendered with the primary color. */
  highlightKeys?: string[];
  /** What one ballot is called in the summary line ("vote", "verdict"). */
  noun?: string;
}) {
  const theme = useTheme();
  const t = useT();
  const { counts, total } = tallyFor(tally, 'all');
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
                {`${percent}% · ${t('verified')} ${verifiedPercent}%`}
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
        {plural(total, noun)} · {plural(tally.totalVerified, `verified ${noun}`)}
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
