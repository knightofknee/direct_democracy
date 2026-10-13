import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBallot } from '@/lib/ballot';
import { usePlural, useT } from '@/lib/i18n';

/** The way to My ballot from a race or the election tab, with how many choices are made so far. */
export function MyBallotLink() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();
  const ballot = useBallot();
  // Counted the way My ballot counts them: the judges up for retention are
  // one line there, however many of them have an answer.
  const made =
    Object.keys(ballot.picks).length + (Object.keys(ballot.retain).length ? 1 : 0) + (ballot.question ? 1 : 0);
  return (
    <Pressable
      onPress={() => router.push('/my-ballot')}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.primary, backgroundColor: theme.primarySoft, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Ionicons name="checkbox-outline" size={20} color={theme.primary} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText type="smallBold" style={{ fontSize: 15, color: theme.primary }}>
          {t('My ballot')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
          {made > 0
            ? t('{n} made so far. Your picks stay on this phone.').replace('{n}', pluralT(made, 'choice'))
            : t('Pick a candidate in each race and take the list with you to vote.')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
});
