import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/open-link';

type Rating = { source: string; rating: string; url?: string | null };

/**
 * A bar association saying no: "No" on retention, "Not Recommended" or
 * "Not Qualified" (or "Unqualified") on a contested seat. Injustice Watch's
 * flags describe a record and never count as a negative rating.
 */
export function isNegativeRating(r: Rating): boolean {
  if (r.source === 'Injustice Watch') return false;
  return /^no$|\bnot (recommended|qualified)\b|\bunqualified\b/i.test(r.rating.trim());
}

/** How many bar associations rated this candidate negatively. */
export function negativeRatingCount(ratings: Rating[] | undefined): number {
  return new Set((ratings ?? []).filter(isNegativeRating).map((r) => r.source)).size;
}

/**
 * Bar association and Injustice Watch findings on a judicial candidate,
 * quoted as the rating body words them, each chip linking to that body's
 * page. A negative rating from any bar association is the single most
 * useful signal on a judge, so those lead: a red banner with the count, then
 * the negative chips first. Other chips keep their published order; tone
 * follows the wording (qualified / yes reads as good, anything else neutral).
 */
export function RatingChips({ ratings }: { ratings: Rating[] }) {
  const theme = useTheme();
  const t = useT();
  const negatives = negativeRatingCount(ratings);
  const ordered = [...ratings.filter(isNegativeRating), ...ratings.filter((r) => !isNegativeRating(r))];
  return (
    <View style={{ gap: 8 }}>
      {negatives > 0 && (
        <View style={[styles.banner, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
          <Ionicons name="alert-circle" size={18} color={theme.danger} />
          <ThemedText type="smallBold" style={{ flex: 1, fontSize: 14, lineHeight: 19, color: theme.danger }}>
            {negatives === 1
              ? t('Negative rating from 1 bar association')
              : t('Negative ratings from {n} bar associations').replace('{n}', String(negatives))}
          </ThemedText>
        </View>
      )}
      <View style={styles.wrap}>
        {ordered.map((r) => {
          const negative = isNegativeRating(r);
          const positive = !negative && /qualified|recommend|^yes$|retain/i.test(r.rating.trim());
          const color = negative ? theme.danger : positive ? theme.verified : theme.textSecondary;
          const soft = negative ? theme.dangerSoft : positive ? theme.verifiedSoft : theme.backgroundElement;
          return (
            <Pressable
              key={`${r.source}-${r.rating}`}
              onPress={r.url ? () => openLink(r.url!) : undefined}
              disabled={!r.url}
              accessibilityRole={r.url ? 'link' : 'text'}
              style={[styles.chip, { backgroundColor: soft, borderColor: color, borderWidth: negative ? 2 : 1 }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    gap: 1,
  },
});
