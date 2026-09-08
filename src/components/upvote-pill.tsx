import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc } from 'firebase/firestore';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { tapHaptic } from '@/lib/haptics';
import { useOptimistic } from '@/lib/optimistic';
import { notifyError } from '@/lib/notify';
import type { ElectionQuestion } from '@/lib/types';
import { setElectionQuestionUpvote } from '@/services/election';

/**
 * "I want this answered too" - the join affordance on a question. Presence
 * is the whole ballot: tap to join, tap again to leave. The count shown is
 * everyone; the verified slice does the grade-weighting behind the scenes
 * (see services/ama.ts).
 */
export function UpvotePill({
  count,
  active,
  onPress,
  disabled,
}: {
  count: number;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={
        active ? 'Leave this question' : 'Join this question, I want it answered too'
      }
      style={[
        styles.pill,
        {
          backgroundColor: active ? theme.primary : theme.backgroundElement,
          borderColor: active ? theme.primary : theme.border,
        },
      ]}>
      <Ionicons
        name={active ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
        size={20}
        color={active ? '#fff' : theme.primary}
      />
      <ThemedText
        type="smallBold"
        style={{ fontSize: 15, lineHeight: 20, color: active ? '#fff' : theme.text }}>
        {count}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Optimistic count for the pill: the tap is assumed to succeed (the write
 * is the user's own vote doc and should essentially never fail), so the
 * number moves the instant they tap instead of waiting the second or two
 * for the trigger recount. Thin wrapper over useOptimistic; `settle` rolls
 * back after a failed write, which is when the user gets told.
 */
export function useOptimisticUpvotes(serverCount: number) {
  const { value, predict, rollback } = useOptimistic(serverCount);
  return {
    count: value,
    bump: (d: 1 | -1) => predict(Math.max(0, serverCount + d)),
    settle: rollback,
  };
}

/**
 * Join an election question ("I want this answered too") - the pill wired to
 * the election AMA, shared by the tab list and the question screen.
 */
export function ElectionQuestionJoin({ question }: { question: ElectionQuestion }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { count, bump, settle } = useOptimisticUpvotes(question.upvotes ?? 0);

  const { data: myUpvote } = useLiveDoc<{ uid: string }>(
    () => (profile ? doc(db, 'electionQuestions', question.id, 'votes', profile.uid) : null),
    [profile?.uid, question.id]
  );

  const toggle = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    tapHaptic();
    const up = myUpvote == null;
    bump(up ? 1 : -1);
    try {
      await setElectionQuestionUpvote(profile, question.id, up);
    } catch (e) {
      settle();
      notifyError('Your voice was not recorded', e);
    }
  };

  return <UpvotePill count={count} active={myUpvote != null} onPress={toggle} />;
}

const styles = StyleSheet.create({
  // A vote control, not a badge: sized for thumbs (the app's minimum-ish
  // 36pt tap height before hitSlop), loud enough to read as the main action
  // on a question row.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
});
