import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { TallyLens } from '@/lib/types';

const LENSES: { key: TallyLens; label: string }[] = [
  { key: 'all', label: 'All users' },
  { key: 'verified', label: 'Verified' },
];

/**
 * The second axis of every result: whose votes are you looking at?
 * Everyone, or identity-verified users only.
 */
export function LensToggle({
  value,
  onChange,
}: {
  value: TallyLens;
  onChange: (lens: TallyLens) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {LENSES.map((lens) => {
        const selected = lens.key === value;
        return (
          <Pressable
            key={lens.key}
            onPress={() => onChange(lens.key)}
            style={[styles.segment, selected && { backgroundColor: theme.background }]}>
            <ThemedText
              type="small"
              style={{
                fontSize: 12,
                lineHeight: 16,
                fontWeight: selected ? '700' : '500',
                color: selected ? theme.primary : theme.textSecondary,
              }}>
              {lens.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
});
