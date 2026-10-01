import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/**
 * A district grid that leads with the viewer's own district (2026-09-29):
 * with an address on file, just theirs; with only a home ward, the few
 * districts that ward's residents live in; with neither, every district.
 * "See all" opens the full grid either way, so nothing is out of reach.
 */
export function DistrictCells<T extends number | string>({
  all,
  mine,
  exact,
  onOpen,
  cellLabel,
  highlighted,
  cellStyle,
}: {
  /** Every district with a race on this ballot, in order. */
  all: T[];
  /** The viewer's district(s) of this type; null when unknown. */
  mine: T[] | null;
  /** Whether `mine` comes from an address (one district) or a ward (a few). */
  exact: boolean;
  onOpen: (d: T) => void;
  cellLabel: (d: T) => string;
  /** Marks districts with candidates on record, where a grid does that. */
  highlighted?: (d: T) => boolean;
  /** Full-grid cell sizing, so each grid keeps its own rhythm. */
  cellStyle: ViewStyle;
}) {
  const t = useT();
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const cell = (d: T, style: ViewStyle) => {
    const lit = highlighted?.(d) ?? false;
    return (
      <Pressable
        key={String(d)}
        onPress={() => onOpen(d)}
        accessibilityRole="button"
        accessibilityLabel={cellLabel(d)}
        style={({ pressed }) => [
          styles.cell,
          style,
          {
            borderColor: lit ? theme.primary : theme.border,
            backgroundColor: theme.background,
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={{ fontSize: 14, color: lit ? theme.primary : theme.text }}>
          {String(d)}
        </ThemedText>
      </Pressable>
    );
  };
  const grid = <View style={styles.grid}>{all.map((d) => cell(d, cellStyle))}</View>;

  if (!mine) return grid;

  const onBallot = all.filter((d) => mine.includes(d));
  return (
    <View style={{ gap: Spacing.two }}>
      {onBallot.length > 0 ? (
        <View style={{ gap: 6 }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t(exact ? 'Your district' : 'Your ward’s districts')}
          </ThemedText>
          <View style={styles.grid}>{onBallot.map((d) => cell(d, styles.mine))}</View>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
          {exact
            ? t('Your district ({n}) has no race on this ballot.').replace('{n}', String(mine[0]))
            : t('None of your ward’s districts has a race on this ballot.')}
        </ThemedText>
      )}
      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
          {open ? t('Hide the others') : t('See all {n}').replace('{n}', String(all.length))}
        </ThemedText>
      </Pressable>
      {open && grid}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 8,
  },
  mine: {
    minWidth: 56,
    paddingHorizontal: Spacing.three,
  },
});
