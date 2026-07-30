import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Pulsing placeholder card shown while a live query warms up. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  const theme = useTheme();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={{ gap: Spacing.three }}>
      {Array.from({ length: count }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            style,
          ]}>
          <View style={[styles.line, { width: '70%', backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.line, { width: '45%', backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.line, { width: '58%', backgroundColor: theme.backgroundSelected }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  line: {
    height: 12,
    borderRadius: 6,
  },
});
