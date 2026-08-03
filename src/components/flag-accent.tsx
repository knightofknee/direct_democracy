import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * A quiet nod to the Chicago flag: two sky-blue stripes with the four red
 * six-pointed stars between them. Used as a brand accent under tab headers.
 */
export function FlagAccent() {
  const theme = useTheme();
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.stripe, { backgroundColor: theme.primarySoft }]} />
      <View style={styles.stars}>
        {[0, 1, 2, 3].map((i) => (
          <Ionicons key={i} name="star" size={9} color={theme.accent} />
        ))}
      </View>
      <View style={[styles.stripe, { backgroundColor: theme.primarySoft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 3,
    alignSelf: 'center',
    minWidth: 96,
  },
  stripe: {
    height: 3,
    borderRadius: 2,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
});
