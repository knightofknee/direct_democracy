import { Ionicons } from '@expo/vector-icons';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { successHaptic } from '@/lib/haptics';
import { tr } from '@/lib/i18n';
import { markReachedMilestones, takeAnticipatedMilestone, type Milestone } from '@/lib/milestones';
import type { UserStats } from '@/lib/types';
import { enter } from '@/lib/motion';

/**
 * Celebration moments: a few fireworks in Chicago-flag colors over whatever
 * screen the person is on, and a small note at the top that leaves on its
 * own. Nothing blocks: the overlay never takes a touch outside the note, so
 * the tap that earned the moment flows straight into the next one (a tap on
 * the note just sends it away sooner). The provider watches the signed-in
 * user's server-counted stats and fires each milestone exactly once per
 * account per device; a welcome moment fires on brand-new accounts.
 */

const CelebrationContext = createContext<{
  celebrate: (m: Milestone) => void;
  /**
   * Call right after a successful FIRST-TIME action (new vote, new concern,
   * new judgment - not a change to an existing one) so threshold milestones
   * fire instantly instead of after the Cloud Functions stats round trip.
   */
  anticipate: (stat: keyof UserStats) => void;
} | null>(null);

export function useCelebration() {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used inside <CelebrationProvider>');
  return ctx;
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [active, setActive] = useState<Milestone | null>(null);
  const queue = useRef<Milestone[]>([]);

  const celebrate = useCallback((m: Milestone) => {
    setActive((current) => {
      if (current) {
        queue.current.push(m);
        return current;
      }
      return m;
    });
  }, []);

  const dismiss = useCallback(() => {
    setActive(queue.current.shift() ?? null);
  }, []);

  const uid = profile?.uid ?? null;
  const createdMs = profile?.createdAt?.toMillis?.() ?? null;
  const stats = profile?.stats ?? null;
  const statsKey = stats ? JSON.stringify(stats) : null;

  // Refs so anticipate() reads the freshest profile without re-creating the
  // callback (and the context value) on every stats tick.
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const anticipate = useCallback(
    (stat: keyof UserStats) => {
      if (!uidRef.current) return;
      const current = statsRef.current ?? { concerns: 0, comments: 0, votes: 0, judgments: 0 };
      takeAnticipatedMilestone(uidRef.current, current, stat).then((m) => {
        if (m) celebrate(m);
      });
    },
    [celebrate]
  );

  // Welcome moment for brand-new accounts (created in the last two minutes).
  useEffect(() => {
    if (!uid || !createdMs || Date.now() - createdMs > 2 * 60 * 1000) return;
    const key = `dd:welcomed:${uid}`;
    AsyncStorage.getItem(key).then((seen) => {
      if (seen) return;
      AsyncStorage.setItem(key, '1');
      celebrate({
        key: 'welcome',
        title: tr('Welcome to direct democracy'),
      });
    });
  }, [uid, createdMs, celebrate]);

  // Server-counted stats only record what's been reached; they never
  // celebrate. A celebration answers a tap on this device (anticipate), so
  // a vote made elsewhere, or stats that land at sign-in, fire nothing.
  useEffect(() => {
    if (!uid || !stats) return;
    markReachedMilestones(uid, stats).catch(() => {});
    // statsKey stands in for the stats object so deep-equal updates don't refire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, statsKey, celebrate]);

  return (
    <CelebrationContext.Provider
      value={useMemo(() => ({ celebrate, anticipate }), [celebrate, anticipate])}>
      {children}
      {active && <CelebrationOverlay key={active.key} milestone={active} onDismiss={dismiss} />}
    </CelebrationContext.Provider>
  );
}

const COLORS = ['#41B6E6', '#C8102E', '#FFD100', '#B3DDF2'];
const BURSTS = 3;
const SPARKS_PER_BURST = 14;
const BURST_MS = 1300;
const BURST_STAGGER_MS = 260;

/** Long enough to read a short title, never a lingering banner. */
const NOTE_MS = 3000;

function CelebrationOverlay({
  milestone,
  onDismiss,
}: {
  milestone: Milestone;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    successHaptic();
    AccessibilityInfo.announceForAccessibility(milestone.title);
    const timer = setTimeout(onDismiss, NOTE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone.key]);

  // Deterministic pseudo-randoms (pure for the compiler; varied per milestone).
  const bursts = useMemo(() => {
    let seed = 2166136261;
    for (const ch of milestone.key) seed = (seed ^ ch.charCodeAt(0)) * 16777619;
    const prand = (i: number, salt: number) => {
      const n = Math.sin(seed + i * 127.1 + salt * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    return Array.from({ length: BURSTS }, (_, b) => ({
      id: `${milestone.key}-${b}`,
      // Spread across the width, just under the note where the eye already is.
      x: 0.15 + 0.7 * ((b + 0.2 + prand(b, 1) * 0.6) / BURSTS),
      y: 0.18 + prand(b, 2) * 0.2,
      delay: b * BURST_STAGGER_MS,
      sparks: Array.from({ length: SPARKS_PER_BURST }, (_, i) => ({
        angle: (i / SPARKS_PER_BURST) * Math.PI * 2 + prand(b * 31 + i, 3) * 0.3,
        reach: 60 + prand(b * 31 + i, 4) * 50,
        size: 4 + prand(b * 31 + i, 5) * 4,
        color: COLORS[(b + i) % COLORS.length],
        star: i % 5 === 0,
      })),
    }));
  }, [milestone.key]);

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {!reduceMotion && bursts.map((burst) => <Burst key={burst.id} burst={burst} />)}
      <Animated.View
        entering={enter(FadeInDown.duration(220))}
        exiting={FadeOutUp.duration(200)}
        pointerEvents="box-none"
        style={[styles.noteWrap, { top: insets.top + Spacing.two }]}>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="alert"
          style={[styles.note, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.starBubble, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="star" size={16} color={theme.accent} />
          </View>
          {/* The title is the whole message: no line of commentary under it. */}
          <ThemedText type="smallBold" style={{ flexShrink: 1, fontSize: 15, lineHeight: 20 }}>
            {milestone.title}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

type BurstSpec = {
  x: number;
  y: number;
  delay: number;
  sparks: { angle: number; reach: number; size: number; color: string; star: boolean }[];
};

/** One firework: sparks fly out from a point, sink a little, and fade. */
function Burst({ burst }: { burst: BurstSpec }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      burst.delay,
      withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { width, height } = Dimensions.get('window');
  return (
    <View pointerEvents="none" style={[styles.burst, { left: burst.x * width, top: burst.y * height }]}>
      {burst.sparks.map((spark, i) => (
        <Spark key={i} spark={spark} progress={progress} />
      ))}
    </View>
  );
}

function Spark({
  spark,
  progress,
}: {
  spark: BurstSpec['sparks'][number];
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: Math.cos(spark.angle) * spark.reach * p },
        // Gravity: a gentle fall that grows as the burst spends itself.
        { translateY: Math.sin(spark.angle) * spark.reach * p + 40 * p * p },
        { scale: 1 - 0.4 * p },
      ],
      opacity: p === 0 ? 0 : p < 0.6 ? 1 : (1 - p) / 0.4,
    };
  });
  return (
    <Animated.View style={[styles.spark, style]}>
      {spark.star ? (
        <Ionicons name="star" size={spark.size + 6} color={spark.color} />
      ) : (
        <View
          style={{
            width: spark.size,
            height: spark.size,
            borderRadius: spark.size / 2,
            backgroundColor: spark.color,
          }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  burst: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  spark: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  noteWrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  starBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
