import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfficialAvatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useScreenRoom } from '@/hooks/use-screen-room';
import { useTheme } from '@/hooks/use-theme';
import type { MayorCandidate } from '@/lib/mayor-games';

/**
 * The stage a date plays on (2026-11-09, Brian: the first blind date made
 * you scroll up to see who was revealed and back down to move on; on a
 * phone neither scroll should exist). Three fixed bands fill the screen:
 * who you are with (pinned on top), the card (the only part that moves),
 * and the buttons (pinned at the bottom, under the thumb). The card
 * scrolls inside itself when a candidate has more to say than fits, and
 * swipes sideways: a swipe is the same act as the button on that side.
 */
export function GameStage({
  top,
  bottom,
  children,
  cardKey,
  onSwipeLeft,
  onSwipeRight,
  leftStamp,
  rightStamp,
  flyOut,
}: {
  top: React.ReactNode;
  bottom: React.ReactNode;
  children: React.ReactNode;
  /** Changes with the card: the scroll starts over at the top. */
  cardKey: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** What a swipe that way means, shown on the card as it is dragged. */
  leftStamp?: string;
  rightStamp?: string;
  /** The card leaves with the swipe (moving on) instead of settling back (a verdict). */
  flyOut?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Inside a tab the tab bar already clears the home indicator.
  const segments = useSegments();
  const bottomInset = segments[0] === '(tabs)' ? 0 : insets.bottom;

  const tx = useSharedValue(0);
  // A new card starts centered, whatever the last one was doing.
  useEffect(() => {
    tx.set(0);
  }, [cardKey, tx]);

  const canLeft = !!onSwipeLeft;
  const canRight = !!onSwipeRight;
  const left = () => onSwipeLeft?.();
  const right = () => onSwipeRight?.();
  const pan = Gesture.Pan()
    // Sideways only: an up-and-down drag is the card's own scroll.
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const x = e.translationX;
      // A side with nothing behind it resists instead of following.
      tx.set((x < 0 && !canLeft) || (x > 0 && !canRight) ? x * 0.15 : x);
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > 90 || Math.abs(e.velocityX) > 900;
      const goLeft = far && e.translationX < 0 && canLeft;
      const goRight = far && e.translationX > 0 && canRight;
      if (!goLeft && !goRight) {
        tx.set(withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }));
        return;
      }
      if (flyOut) {
        tx.set(
          withTiming(goLeft ? -width : width, { duration: 170, easing: Easing.in(Easing.cubic) }, (done) => {
            if (done) runOnJS(goLeft ? left : right)();
          })
        );
      } else {
        runOnJS(goLeft ? left : right)();
        tx.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }));
      }
    });

  const card = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { rotate: `${interpolate(tx.value, [-300, 300], [-5, 5])}deg` }],
    opacity: interpolate(Math.abs(tx.value), [0, width], [1, 0.4]),
  }));
  const stampLeft = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-110, -30, 0], [1, 0, 0], 'clamp') }));
  const stampRight = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, 30, 110], [0, 0, 1], 'clamp') }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.column}>
        <View style={styles.top}>{top}</View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, card]}>
            <ScrollView
              key={cardKey}
              style={{ flex: 1 }}
              contentContainerStyle={styles.card}
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {/* More below the fold fades out rather than ending on a cut line. */}
            <LinearGradient
              pointerEvents="none"
              colors={[`${theme.background}00`, theme.background]}
              style={styles.fade}
            />
            {leftStamp ? (
              <Animated.View pointerEvents="none" style={[styles.stamp, { right: Spacing.three, borderColor: theme.textSecondary }, stampLeft]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {leftStamp}
                </ThemedText>
              </Animated.View>
            ) : null}
            {rightStamp ? (
              <Animated.View pointerEvents="none" style={[styles.stamp, { left: Spacing.three, borderColor: theme.accent }, stampRight]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {rightStamp}
                </ThemedText>
              </Animated.View>
            ) : null}
          </Animated.View>
        </GestureDetector>
        <View
          style={[
            styles.bottom,
            { borderTopColor: theme.border, paddingBottom: bottomInset + Spacing.two },
          ]}>
          {bottom}
        </View>
      </View>
    </View>
  );
}

/** A round button with its word under it: the stage's controls. */
export function RoundAction({
  icon,
  label,
  onPress,
  tone = 'neutral',
  size = 60,
  disabled,
  filled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'primary' | 'accent';
  size?: number;
  disabled?: boolean;
  /** Solid in its tone's color (the chosen one, or the main action). */
  filled?: boolean;
}) {
  const theme = useTheme();
  const ink = tone === 'accent' ? theme.accent : tone === 'primary' ? theme.primary : theme.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: filled }}
      hitSlop={6}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.35 : pressed ? 0.75 : 1 }]}>
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.circle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: ink,
                backgroundColor: filled ? ink : theme.backgroundElement,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}>
            <Ionicons name={icon} size={size * 0.46} color={filled ? '#FFFFFF' : ink} />
          </View>
          <ThemedText type="small" style={{ fontSize: 12, lineHeight: 16, textAlign: 'center', color: ink }}>
            {label}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

/**
 * The portrait as a coin: a question mark on one face, the candidate on the
 * other, turned over by `revealed`. One timing curve, no bounce, and no 3D
 * transform (see below).
 */
export function FlipAvatar({
  candidate,
  revealed,
  size = 60,
}: {
  candidate: MayorCandidate;
  revealed: boolean;
  size?: number;
}) {
  const theme = useTheme();
  // The same yield OfficialAvatar makes on a tight screen.
  const { tight } = useScreenRoom();
  const box = tight ? Math.min(size, 40) : size;
  const turn = useSharedValue(revealed ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(revealed ? 1 : 0, {
      duration: revealed ? 520 : 0,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [revealed, turn]);
  // A flat flip: the question mark narrows to an edge, then the portrait
  // widens from it. NOT a 3D rotation: on iPhone a rotateY with perspective
  // on these faces left a blank layer over the whole stage, from the
  // portrait's middle to the right edge, that also swallowed every tap
  // (found on the simulator 2026-11-10; the web never showed it).
  const front = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(turn.value, [0, 0.5], [1, 0.02], 'clamp') }],
    opacity: turn.value < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(turn.value, [0.5, 1], [0.02, 1], 'clamp') }],
    opacity: turn.value < 0.5 ? 0 : 1,
  }));
  return (
    <View style={{ width: box, height: box }}>
      {/* The portrait is not in the tree until the reveal: hidden behind
          the question mark it was still read out by screen readers (name
          or initials), which gave the date away. It mounts as the flip
          starts and shows from its second half. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, back]}>
        {revealed ? (
          <OfficialAvatar name={candidate.name} photoUrl={candidate.photoUrl} frame={candidate.photoFrame} size={size} />
        ) : null}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.face,
          styles.mystery,
          { borderRadius: box / 2, backgroundColor: theme.februaryBand, borderColor: theme.accent },
          front,
        ]}>
        <ThemedText type="smallBold" style={{ fontSize: box * 0.5, lineHeight: box * 0.62, color: theme.accent }}>
          ?
        </ThemedText>
      </Animated.View>
    </View>
  );
}

/**
 * The round at a glance: one mark per candidate, filled as they are met
 * (red for a second date), the one on stage in blue.
 */
export function RoundMarks({
  total,
  states,
}: {
  total: number;
  /**
   * In the order they came up: 'yes' | 'no' | 'met' for dates, 'right' |
   * 'wrong' for answers, then 'now' for the one on stage.
   */
  states: ('yes' | 'no' | 'met' | 'now' | 'right' | 'wrong')[];
}) {
  const theme = useTheme();
  return (
    <View style={styles.marks} accessible={false} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => {
        const s = states[i];
        const color =
          s === 'yes' || s === 'wrong'
            ? theme.accent
            : s === 'right'
              ? theme.verified
              : s === 'now'
                ? theme.primary
                : s
                  ? theme.textSecondary
                  : theme.border;
        return <View key={i} style={[styles.mark, { backgroundColor: color }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Phone width even on a wide window: this is a card game, not a page.
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  top: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  card: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.four,
    gap: Spacing.two + 2,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
  },
  stamp: {
    position: 'absolute',
    top: Spacing.two,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: Spacing.two + 2,
  },
  bottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mystery: {
    borderWidth: 1.5,
  },
  marks: {
    flexDirection: 'row',
    gap: 3,
  },
  mark: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
});
