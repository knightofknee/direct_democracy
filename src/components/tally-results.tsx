import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { pct, plural } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { tallyFor } from '@/lib/tally';
import type { DualTally } from '@/lib/types';

/**
 * Result bars for one tally, all users and verified side by side - the
 * "all users vs verified" contrast is the product, no toggle to hunt for.
 * Every option shows its count beside its percentage, so a small turnout
 * never passes for a landslide.
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
  // Dark mode's soft blue is darker than the track it would fill, so the
  // bars there are the primary blue at half strength instead.
  const fill = useColorScheme() === 'dark' ? `${theme.primary}80` : theme.primarySoft;
  const { counts, total } = tallyFor(tally, 'all');
  const verified = tallyFor(tally, 'verified');

  return (
    <View style={{ gap: Spacing.two }}>
      {options.map((option) => {
        const count = counts[option.key] ?? 0;
        const percent = pct(count, total);
        const verifiedCount = verified.counts[option.key] ?? 0;
        const verifiedPercent = pct(verifiedCount, verified.total);
        const mine = highlightKeys?.includes(option.key);
        return (
          <View
            key={option.key}
            style={{ gap: 3 }}
            accessible
            accessibilityLabel={`${option.label}${mine ? `, ${t('your choice')}` : ''}: ${percent}% (${count}), ${t('verified')} ${verifiedPercent}% (${verifiedCount})`}>
            <View style={styles.labelRow}>
              <ThemedText
                type="small"
                style={[{ flexShrink: 1 }, mine ? { color: theme.primary, fontWeight: '700' } : null]}>
                {option.label}
                {mine ? '  ✓' : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                <ThemedText type="small" style={{ fontSize: 12, fontWeight: '700' }}>
                  {`${percent}%`}
                </ThemedText>
                {` (${count.toLocaleString()}) · ${t('verified')} ${verifiedPercent}% (${verifiedCount.toLocaleString()})`}
              </ThemedText>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: mine ? theme.primary : fill,
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
  // Wraps on a narrow phone: the numbers drop under a long option label
  // rather than squeezing it.
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: Spacing.two,
    rowGap: 2,
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
