import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { WARD_MAP_VIEW, WARD_SHAPES } from '@/constants/ward-map';
import { useTheme } from '@/hooks/use-theme';

/**
 * The city, ward by ward: every boundary a tappable shape. Pinch (or the
 * corner buttons) to zoom, drag to pan while zoomed, double-tap to jump in
 * and out; taps keep working at any zoom because the transform sits above
 * the SVG. Shapes come from the city's own boundary dataset via
 * scripts/build-ward-map.ts.
 */

const MAX_SCALE = 8;
const ZOOM_STEP = 2;
const TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

export function WardMap({
  homeWard,
  onPick,
}: {
  homeWard: number | null;
  onPick: (wardId: number) => void;
}) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const aspect = WARD_MAP_VIEW.width / WARD_MAP_VIEW.height;

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  // Mirrored into React so the pan gesture only competes with the page's
  // scroll while actually zoomed in.
  const [zoomed, setZoomed] = useState(false);
  useAnimatedReaction(
    () => scale.value > 1.02,
    (isZoomed, prev) => {
      if (isZoomed !== prev) runOnJS(setZoomed)(isZoomed);
    }
  );

  // Transforms use the view's center as origin: clamp so the map always
  // fills the frame (|t| <= (scale - 1) * half).
  const clamp = (v: number, s: number, extent: number) => {
    'worklet';
    const limit = ((s - 1) * extent) / 2;
    return Math.min(limit, Math.max(-limit, v));
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(1, startScale.value * e.scale));
      const ratio = next / startScale.value;
      // Keep the focal point under the fingers while scaling.
      const ux = e.focalX - size.width / 2;
      const uy = e.focalY - size.height / 2;
      scale.value = next;
      tx.value = clamp(ux - ratio * (ux - startTx.value), next, size.width);
      ty.value = clamp(uy - ratio * (uy - startTy.value), next, size.height);
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = clamp(startTx.value + e.translationX, scale.value, size.width);
      ty.value = clamp(startTy.value + e.translationY, scale.value, size.height);
    });

  const zoomTo = (next: number, focalX?: number, focalY?: number) => {
    const target = Math.min(MAX_SCALE, Math.max(1, next));
    const ratio = target / scale.value;
    const ux = (focalX ?? size.width / 2) - size.width / 2;
    const uy = (focalY ?? size.height / 2) - size.height / 2;
    scale.value = withTiming(target, TIMING);
    tx.value = withTiming(clamp(ux - ratio * (ux - tx.value), target, size.width), TIMING);
    ty.value = withTiming(clamp(uy - ratio * (uy - ty.value), target, size.height), TIMING);
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      runOnJS(zoomTo)(scale.value > 1.02 ? 1 : 3, e.x, e.y);
    });

  const gestures = Gesture.Simultaneous(pinch, pan, doubleTap);

  const transformStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const shapes = useMemo(() => WARD_SHAPES, []);

  return (
    <View
      style={[styles.frame, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      onLayout={(e) => setSize(e.nativeEvent.layout)}>
      <GestureDetector gesture={gestures}>
        <Animated.View style={{ width: '100%', aspectRatio: aspect }}>
          <Animated.View style={[{ width: '100%', height: '100%' }, transformStyle]}>
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${WARD_MAP_VIEW.width} ${WARD_MAP_VIEW.height}`}>
              <G>
                {shapes.map((w) => (
                  <Path
                    key={w.id}
                    d={w.d}
                    fill={w.id === homeWard ? theme.primarySoft : theme.background}
                    stroke={w.id === homeWard ? theme.primary : theme.border}
                    strokeWidth={w.id === homeWard ? 3 : 1.5}
                    fillRule="evenodd"
                    onPress={() => onPick(w.id)}
                  />
                ))}
                {shapes.map((w) => (
                  <SvgText
                    key={`label-${w.id}`}
                    x={w.cx}
                    y={w.cy}
                    fontSize={20}
                    fontWeight="600"
                    {...(Platform.OS === 'web' ? { fontFamily: 'system-ui, sans-serif' } : {})}
                    fill={w.id === homeWard ? theme.primary : theme.textSecondary}
                    textAnchor="middle"
                    alignmentBaseline="central"
                    pointerEvents="none">
                    {String(w.id)}
                  </SvgText>
                ))}
              </G>
            </Svg>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Corner zoom controls, for pointers without a pinch (and quick reset). */}
      <View style={styles.controls}>
        <MapButton
          icon="add"
          label="Zoom in"
          onPress={() => zoomTo(scale.value * ZOOM_STEP)}
        />
        <MapButton
          icon="remove"
          label="Zoom out"
          onPress={() => zoomTo(scale.value / ZOOM_STEP)}
        />
        {zoomed && <MapButton icon="contract" label="Reset zoom" onPress={() => zoomTo(1)} />}
      </View>
    </View>
  );
}

function MapButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.mapButton,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={icon} size={16} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  controls: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    gap: Spacing.one,
  },
  mapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
