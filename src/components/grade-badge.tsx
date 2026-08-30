import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// Color breaks track the letter bands in services/ama.ts letterFor:
// green for A/B, amber for C/D, red for F.
export function gradeColor(score: number | null, theme: ReturnType<typeof useTheme>): string {
  if (score == null) return theme.textSecondary;
  if (score >= 65) return theme.verified;
  if (score >= 35) return theme.warning;
  return theme.danger;
}

/** Circular letter grade - the official's overall mark. */
export function GradeBadge({
  letter,
  score,
  size = 48,
}: {
  letter: string;
  score: number | null;
  size?: number;
}) {
  const theme = useTheme();
  const color = gradeColor(score, theme);
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: size >= 48 ? 3 : 2.5,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color, fontSize: size * 0.42, lineHeight: size * 0.5 }}>
        {letter}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
