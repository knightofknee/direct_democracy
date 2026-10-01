import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { usePlural, useT } from '@/lib/i18n';
import type { OfficialGrade } from '@/services/officials';

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
  const t = useT();
  const color = gradeColor(score, theme);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('Grade {letter}').replace('{letter}', letter)}
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

/**
 * What a grade stands on, beside every letter (2026-09-29): how many
 * verified residents rated the official and how many questions were graded
 * (answered, dodged, or ignored; pending ones don't count yet). A letter
 * from 5 people reads differently from one from 500, and the app says so.
 */
export function GradeBasis({ grade, style }: { grade: OfficialGrade; style?: StyleProp<TextStyle> }) {
  const t = useT();
  const plural = usePlural();
  const residents = grade.approval.constituentBallots;
  const questions = grade.answers.answered + grade.answers.dodged + grade.answers.ignored;
  return (
    <ThemedText type="small" themeColor="textSecondary" style={[{ fontSize: 11, lineHeight: 14 }, style]}>
      {t('From {residents} · {questions}')
        .replace('{residents}', plural(residents, 'verified resident'))
        .replace('{questions}', plural(questions, 'graded question'))}
    </ThemedText>
  );
}
