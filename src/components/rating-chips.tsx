import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { openLink } from '@/lib/open-link';

/**
 * Bar association and Injustice Watch findings on a judicial candidate,
 * quoted as the rating body words them, each chip linking to that body's
 * page. Tone follows the wording: recommended/qualified reads as good, not
 * recommended/not qualified as a warning, anything else neutral.
 */
export function RatingChips({
  ratings,
}: {
  ratings: { source: string; rating: string; url?: string | null }[];
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {ratings.map((r) => {
        const word = r.rating.toLowerCase();
        const negative = /\bnot\b|unqualified|no\b/.test(word);
        const positive = !negative && /qualified|recommend|yes\b|retain/.test(word);
        const color = negative ? theme.danger : positive ? theme.verified : theme.textSecondary;
        const soft = negative ? theme.dangerSoft : positive ? theme.verifiedSoft : theme.backgroundElement;
        return (
          <Pressable
            key={`${r.source}-${r.rating}`}
            onPress={r.url ? () => openLink(r.url!) : undefined}
            disabled={!r.url}
            accessibilityRole={r.url ? 'link' : 'text'}
            style={[styles.chip, { backgroundColor: soft, borderColor: color }]}>
            <ThemedText type="smallBold" style={{ fontSize: 11, lineHeight: 14, color }}>
              {r.rating}
            </ThemedText>
            <ThemedText type="small" style={{ fontSize: 10, lineHeight: 13, color }}>
              {r.source}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 9,
    gap: 1,
  },
});
