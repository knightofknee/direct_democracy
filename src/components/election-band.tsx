import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/**
 * The February 23, 2027 ballot's stretch of the mayor games tab
 * (2026-09-30, one ballot since 2026-11-04): a full-width band in the
 * ballot's color, headed by its date, so the races read as one ballot
 * under the games.
 */
export function ElectionBand({
  ref,
  children,
}: {
  /** For jumping to the band. */
  ref?: React.Ref<View>;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const t = useT();
  const ink = theme.accent;
  return (
    <View ref={ref} style={[styles.band, { backgroundColor: theme.februaryBand }]}>
      <View style={styles.label}>
        <Ionicons name="calendar" size={14} color={ink} />
        <ThemedText type="smallBold" accessibilityRole="header" style={[styles.labelText, { color: ink }]}>
          {t('February 23, 2027 ballot')}
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
