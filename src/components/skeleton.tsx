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
import { useT } from '@/lib/i18n';

function usePulse() {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({ opacity: pulse.value }));
}

/** Pulsing placeholder card shown while a live query warms up. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  const theme = useTheme();
  const t = useT();
  const style = usePulse();

  // One "Loading" for a screen reader instead of empty boxes.
  return (
    <View style={{ gap: Spacing.three }} accessible accessibilityLabel={t('Loading')}>
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

/**
 * Pulsing placeholder the size of a primary Button. Shown where an
 * auth-dependent call to action will appear once we know whether the user is
 * signed in - never flash the signed-out button while auth is restoring.
 */
export function SkeletonButton() {
  const theme = useTheme();
  const t = useT();
  const style = usePulse();
  return (
    <Animated.View
      accessible
      accessibilityLabel={t('Loading')}
      style={[styles.button, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}
    />
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
  button: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
