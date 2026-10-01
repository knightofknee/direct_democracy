import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

export type Ballot = 'november' | 'february';

/**
 * One ballot's stretch of the election tab (2026-09-30): a full-width band
 * in that ballot's color, headed by its date, so the November 3 races never
 * blend into the February 23 ones. The jump grid's cells carry the same
 * colors.
 */
export function ElectionBand({
  ballot,
  ref,
  children,
}: {
  ballot: Ballot;
  /** For jumping to the band. */
  ref?: React.Ref<View>;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const t = useT();
  const november = ballot === 'november';
  const ink = november ? theme.primary : theme.accent;
  return (
    <View
      ref={ref}
      style={[styles.band, { backgroundColor: november ? theme.novemberBand : theme.februaryBand }]}>
      <View style={styles.label}>
        <Ionicons name="calendar" size={14} color={ink} />
        <ThemedText type="smallBold" style={[styles.labelText, { color: ink }]}>
          {t(november ? 'November 3, 2026 ballot' : 'February 23, 2027 ballot')}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Edge to edge: the band cancels the screen's side padding and restores
  // it inside, so its color reaches both edges of the phone.
  band: {
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
});
