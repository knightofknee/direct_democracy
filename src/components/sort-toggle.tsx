import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

export type ConcernSort = 'top' | 'newest';

const SORTS: { key: ConcernSort; label: string }[] = [
  { key: 'top', label: 'Highest rated' },
  { key: 'newest', label: 'Newest' },
];

/**
 * Order for a concerns list. "Highest rated" is the board's identity and the
 * default; "Newest" surfaces what just landed before it has had time to earn
 * votes. There is deliberately no oldest-first sort: age already compounds
 * into score, so the extra visibility goes to new entries. Rank badges keep
 * their score-order numbers either way.
 */
export function SortToggle({
  value,
  onChange,
}: {
  value: ConcernSort;
  onChange: (sort: ConcernSort) => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {SORTS.map((sort) => {
        const selected = sort.key === value;
        return (
          <Pressable
            key={sort.key}
            onPress={() => onChange(sort.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: theme.background }]}>
            <ThemedText
              type="small"
              style={{
                fontSize: 12,
                lineHeight: 16,
                fontWeight: selected ? '700' : '500',
                color: selected ? theme.primary : theme.textSecondary,
              }}>
              {t(sort.label)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Reorders score-ranked concerns without touching their rank numbers. */
export function sortConcerns<T extends { createdAt?: { toMillis?: () => number } | null }>(
  ranked: T[],
  sort: ConcernSort
): T[] {
  if (sort === 'top') return ranked;
  const ms = (c: T) => c.createdAt?.toMillis?.() ?? 0;
  return [...ranked].sort((a, b) => ms(b) - ms(a));
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
});
