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
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { takeAnticipatedMilestone, takeNewMilestone, type Milestone } from '@/lib/milestones';
import type { UserStats } from '@/lib/types';

/**
 * Celebration moments: confetti in Chicago-flag colors over a milestone card.
 * The provider watches the signed-in user's server-counted stats and fires
 * each milestone exactly once per account per device; a welcome moment fires
 * on brand-new accounts.
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

const CONFETTI_COLORS = ['#41B6E6', '#C8102E', '#FFD100', '#FFFFFF', '#B3DDF2'];
const PARTICLE_COUNT = 26;

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
        title: 'Welcome to direct democracy',
        message:
          'Your city, your voice. Raise concerns, vote your priorities, and hold officials to real answers.',
      });
    });
  }, [uid, createdMs, celebrate]);

  // Milestone watcher - stats are written by Cloud Functions, so they arrive
  // through the live profile listener a beat after the action.
  useEffect(() => {
    if (!uid || !stats) return;
    takeNewMilestone(uid, stats).then((m) => {
      if (m) celebrate(m);
    });
    // statsKey stands in for the stats object so deep-equal updates don't refire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, statsKey, celebrate]);

  return (
    <CelebrationContext.Provider
      value={useMemo(() => ({ celebrate, anticipate }), [celebrate, anticipate])}>
      {children}
      {active && <CelebrationOverlay milestone={active} onDismiss={dismiss} />}
    </CelebrationContext.Provider>
  );
}

function CelebrationOverlay({
  milestone,
  onDismiss,
}: {
  milestone: Milestone;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) });
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone.key]);

  // Deterministic pseudo-randoms (pure for the compiler; varied per milestone).
  const particles = useMemo(() => {
    let seed = 2166136261;
    for (const ch of milestone.key) seed = (seed ^ ch.charCodeAt(0)) * 16777619;
    const prand = (i: number, salt: number) => {
      const n = Math.sin(seed + i * 127.1 + salt * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: `${milestone.key}-${i}`,
      x: prand(i, 1),
      drift: (prand(i, 2) - 0.5) * 140,
      spin: (prand(i, 3) - 0.5) * 720,
      size: 6 + prand(i, 4) * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delayFactor: prand(i, 5) * 0.35,
      star: i % 6 === 0,
    }));
  }, [milestone.key]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(250)}
      style={[styles.overlay, { backgroundColor: 'rgba(8, 16, 26, 0.72)' }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      {particles.map((p) => (
        <Particle key={p.id} particle={p} progress={progress} />
      ))}
      <Animated.View
        entering={ZoomIn.duration(220)}
        style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={[styles.starBubble, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="star" size={30} color={theme.accent} />
        </View>
        <ThemedText type="smallBold" style={{ fontSize: 22, lineHeight: 28, textAlign: 'center' }}>
          {milestone.title}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={{ textAlign: 'center', fontSize: 15, lineHeight: 21 }}>
          {milestone.message}
        </ThemedText>
        <Button title="Keep going" onPress={onDismiss} style={{ alignSelf: 'stretch' }} />
      </Animated.View>
    </Animated.View>
  );
}

function Particle({
  particle,
  progress,
}: {
  particle: {
    x: number;
    drift: number;
    spin: number;
    size: number;
    color: string;
    delayFactor: number;
    star: boolean;
  };
  progress: SharedValue<number>;
}) {
  const { width, height } = Dimensions.get('window');
  const style = useAnimatedStyle(() => {
    const local = Math.min(
      1,
      Math.max(0, (progress.value - particle.delayFactor) / (1 - particle.delayFactor))
    );
    return {
      transform: [
        { translateX: particle.x * width + Math.sin(local * Math.PI * 2) * particle.drift },
        { translateY: -40 + local * (height + 80) },
        { rotate: `${local * particle.spin}deg` },
      ],
      opacity: local > 0.85 ? (1 - local) / 0.15 : 1,
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.particle, style]}>
      {particle.star ? (
        <Ionicons name="star" size={particle.size + 4} color={particle.color} />
      ) : (
        <View
          style={{
            width: particle.size,
            height: particle.size * 1.6,
            borderRadius: 2,
            backgroundColor: particle.color,
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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
    maxWidth: 340,
    marginHorizontal: Spacing.four,
  },
  starBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
