import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { CONCERN_PRIORITIES, type ConcernPriority } from '@/lib/types';

/** How strongly each step is tinted before it's picked: deeper toward 5. */
const TINT = [0.07, 0.13, 0.2, 0.28, 0.37];

function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * The 1-5 "how much does this matter" scale (2026-09-29). One joined bar,
 * like a segmented control, whose fill deepens toward 5, with the ends
 * named under it ("Minor" ... "Urgent"), the way rating scales anchor their
 * ends, so nobody reads 1 as "number one priority". Tapping your own pick
 * again takes the vote back (the caller decides what a tap does).
 */
export function PriorityScale({
  value,
  onSelect,
  compact = false,
}: {
  value: ConcernPriority | null;
  onSelect: (p: ConcernPriority) => void;
  /** The board card's slimmer version. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  const dark = useColorScheme() === 'dark';
  // White on the light-mode blue; the dark-mode blue is too light for white.
  const onPrimary = dark ? theme.background : '#FFFFFF';

  return (
    <View style={{ gap: 3 }}>
      <View style={[styles.bar, { height: compact ? 30 : 42, borderRadius: compact ? 9 : 12 }]}>
        {CONCERN_PRIORITIES.map((p, i) => {
          const selected = value === p;
          const label =
            i === 0 ? `${p}, ${t('Minor')}` : i === CONCERN_PRIORITIES.length - 1 ? `${p}, ${t('Urgent')}` : p;
          return (
            <Pressable
              key={p}
              onPress={() => onSelect(p)}
              hitSlop={compact ? { top: 6, bottom: 6 } : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={t('Priority {n}').replace('{n}', label)}
              style={({ pressed }) => [
                styles.step,
                {
                  backgroundColor: selected ? theme.primary : tint(theme.primary, TINT[i]),
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ fontSize: compact ? 13 : 15, lineHeight: compact ? 17 : 20, color: selected ? onPrimary : theme.text }}>
                {p}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.anchors} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ThemedText type="small" themeColor="textSecondary" style={styles.anchor}>
          {t('Minor')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.anchor}>
          {t('Urgent')}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 2,
    overflow: 'hidden',
  },
  step: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  anchor: {
    fontSize: 11,
    lineHeight: 14,
  },
});
