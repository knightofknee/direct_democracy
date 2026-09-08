import { doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCelebration } from '@/components/celebration';
import { SkeletonButton } from '@/components/skeleton';
import { TallyResults } from '@/components/tally-results';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { tapHaptic } from '@/lib/haptics';
import { notify } from '@/lib/notify';
import { withBallotDelta, type BallotDelta } from '@/lib/tally';
import type { Poll, VoteDoc } from '@/lib/types';
import { closePoll, votePoll } from '@/services/polls';

const TYPE_LABELS: Record<Poll['type'], string> = {
  yesNo: 'Yes / No',
  multipleChoice: 'Pick one',
  approval: 'Pick all you support',
  scale5: 'How strongly do you feel?',
};

export function PollCard({ poll }: { poll: Poll }) {
  const theme = useTheme();
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { anticipate } = useCelebration();
  const [draft, setDraft] = useState<{ from: string; keys: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<{
    delta: BallotDelta;
    /** The server tally at cast time - any change to it means the trigger landed. */
    baseline: string;
  } | null>(null);

  const { data: myVote, loading: myVoteLoading } = useLiveDoc<VoteDoc & { id: string }>(
    () => (profile ? doc(db, 'polls', poll.id, 'votes', profile.uid) : null),
    [profile?.uid, poll.id]
  );

  // The moment the server tally moves, the optimistic overlay hands back.
  const talliesJson = JSON.stringify(poll.tallies);
  useEffect(() => {
    if (optimistic && talliesJson !== optimistic.baseline) setOptimistic(null);
  }, [talliesJson, optimistic]);

  const recordedKeys = myVote ? (Array.isArray(myVote.value) ? myVote.value : [myVote.value]) : [];
  // The overlayed ballot wins while in flight so the tap highlights NOW.
  const myKeys = optimistic
    ? optimistic.delta.to == null
      ? []
      : Array.isArray(optimistic.delta.to)
        ? optimistic.delta.to
        : [optimistic.delta.to]
    : recordedKeys;
  const hasVoted = myKeys.length > 0;
  const myKeysJson = JSON.stringify(myKeys);
  const shownTallies = optimistic ? withBallotDelta(poll.tallies, optimistic.delta) : poll.tallies;

  // Approval polls collect selections before casting. The draft remembers the
  // ballot it started from, so it falls back to the recorded ballot whenever
  // that changes - "change your vote" starts from what you actually voted for
  // rather than a blank slate, with no effect needed to keep them in step.
  const pending = draft?.from === myKeysJson ? draft.keys : myKeys;
  const wardLocked = poll.scope === 'ward' && (!profile?.verified || profile.wardId !== poll.wardId);
  const canVote = !!profile && poll.open && !wardLocked;

  // Optimistic: the tap counts NOW (tally overlay + milestone), because the
  // tally-trigger round trip is seconds and that reads as a broken button.
  // On failure we roll back and say so.
  const cast = (value: string | string[]) => {
    if (!profile) return;
    tapHaptic();
    // "First" only once the vote doc has actually loaded (see milestones.ts).
    const firstCast = !myVoteLoading && recordedKeys.length === 0;
    if (firstCast) anticipate('votes');
    setOptimistic({
      delta: {
        from: recordedKeys.length > 0 ? recordedKeys : null,
        to: value,
        // Ward polls only accept ward-resident verified voters (rules), so a
        // voter who can cast at all counts in the verified slice iff verified.
        verified: !!profile.verified && (poll.scope !== 'ward' || profile.wardId === poll.wardId),
      },
      baseline: JSON.stringify(poll.tallies),
    });
    setDraft(null); // fall back to the ballot now on record
    votePoll(profile, poll, value).catch((e) => {
      setOptimistic(null);
      notify('Vote failed', e instanceof Error ? e.message : 'Something went wrong.');
    });
  };

  const toggleApproval = (key: string) => {
    setDraft({
      from: myKeysJson,
      keys: pending.includes(key) ? pending.filter((k) => k !== key) : [...pending, key],
    });
  };

  return (
    <Card>
      <View style={styles.headerRow}>
        <Chip label={wardLabel(poll.wardId)} tone={poll.scope === 'city' ? 'primary' : 'neutral'} />
        <Chip label={poll.open ? TYPE_LABELS[poll.type] : 'Closed'} tone={poll.open ? 'neutral' : 'warning'} />
      </View>
      <ThemedText type="smallBold" style={{ fontSize: 16, lineHeight: 22 }}>
        {poll.question}
      </ThemedText>
      {poll.detail ? (
        <ThemedText type="small" themeColor="textSecondary">
          {poll.detail}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        Asked by {poll.authorName}
      </ThemedText>

      {hasVoted || !canVote ? (
        <View style={{ gap: Spacing.two }}>
          <TallyResults tally={shownTallies} options={poll.options} highlightKeys={myKeys} />
          {hasVoted && poll.open && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              You voted - tap an option below to change it.
            </ThemedText>
          )}
        </View>
      ) : null}

      {canVote ? (
        <View style={{ gap: Spacing.two }}>
          {poll.options.map((option) => {
            const selected =
              poll.type === 'approval' ? pending.includes(option.key) : myKeys.includes(option.key);
            return (
              <Pressable
                key={option.key}
                disabled={saving}
                onPress={() =>
                  poll.type === 'approval' ? toggleApproval(option.key) : cast(option.key)
                }
                style={[
                  styles.option,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.backgroundSelected : theme.background,
                  },
                ]}>
                <ThemedText type="small" style={selected ? { color: theme.primary, fontWeight: '700' } : undefined}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
          {poll.type === 'approval' && (
            <Button
              title={hasVoted ? 'Update votes' : 'Cast votes'}
              onPress={() => cast(pending)}
              disabled={pending.length === 0}
              loading={saving}
            />
          )}
        </View>
      ) : null}

      {profile?.uid === poll.authorUid && poll.open && (
        <Button
          title="Close voting"
          variant="secondary"
          loading={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await closePoll(profile, poll);
            } catch (e) {
              notify('Could not close poll', e instanceof Error ? e.message : 'Something went wrong.');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {wardLocked && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {profile?.verified
            ? 'Only residents of this ward can vote on this poll.'
            : 'Verify your identity to vote on ward polls.'}
        </ThemedText>
      )}
      {!profile &&
        (authLoading ? (
          <SkeletonButton />
        ) : (
          <Button title="Sign in to vote" variant="secondary" onPress={() => router.push('/sign-in')} />
        ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  option: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
  },
});
