import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import type { TallyLens } from '@/lib/types';

export type ConcernSort = 'top' | 'newest';

type Option<K> = { key: K; label: string; icon: keyof typeof Ionicons.glyphMap };

/**
 * Whose votes the numbers count: everyone, or identity-verified users only.
 */
const LENSES: [Option<TallyLens>, Option<TallyLens>] = [
  { key: 'all', label: 'All users', icon: 'people-outline' },
  { key: 'verified', label: 'Verified only', icon: 'shield-checkmark' },
];

/**
 * "Highest rated" is the board's identity and the default; "Newest"
 * surfaces what just landed before it has had time to earn votes. There is
 * deliberately no oldest-first sort: age already compounds into score, so
 * the extra visibility goes to new entries. Rank badges keep their
 * score-order numbers either way.
 */
const SORTS: [Option<ConcernSort>, Option<ConcernSort>] = [
  { key: 'top', label: 'Highest rated', icon: 'flame-outline' },
  { key: 'newest', label: 'Newest', icon: 'time-outline' },
];

/**
 * The two view settings above a concerns list, as one quiet line: each is
 * a small button naming what the list shows now, and a tap flips it to the
 * other option. They are secondary to the list itself, so they stay small
 * and borderless until the verified lens is on, which tints its button
 * because it changes what every number below means.
 */
export function ListControls({
  lens,
  onLensChange,
  sort,
  onSortChange,
}: {
  lens: TallyLens;
  onLensChange: (lens: TallyLens) => void;
  sort: ConcernSort;
  onSortChange: (sort: ConcernSort) => void;
}) {
  return (
    <View style={styles.row}>
      <FlipButton options={LENSES} value={lens} onChange={onLensChange} highlight={lens === 'verified'} />
      <FlipButton options={SORTS} value={sort} onChange={onSortChange} />
    </View>
  );
}

function FlipButton<K extends string>({
  options,
  value,
  onChange,
  highlight = false,
}: {
  options: [Option<K>, Option<K>];
  value: K;
  onChange: (next: K) => void;
  highlight?: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  const [current, other] = options[0].key === value ? options : [options[1], options[0]];
  const color = highlight ? theme.primary : theme.textSecondary;
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onChange(other.key);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t(current.label)}
      accessibilityHint={t('Switches to {option}').replace('{option}', t(other.label))}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: highlight ? theme.backgroundSelected : theme.backgroundElement },
        pressed && { opacity: 0.6 },
      ]}>
      <Ionicons name={current.icon} size={13} color={color} />
      <ThemedText type="small" style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color }}>
        {t(current.label)}
      </ThemedText>
      <Ionicons name="swap-horizontal" size={12} color={theme.textSecondary} style={{ opacity: 0.7 }} />
    </Pressable>
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
  // Wraps rather than truncates when a narrow phone meets large text.
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
});
