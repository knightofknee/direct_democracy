import { doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
import { notify } from '@/lib/notify';
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
  const [draft, setDraft] = useState<{ from: string; keys: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: myVote } = useLiveDoc<VoteDoc & { id: string }>(
    () => (profile ? doc(db, 'polls', poll.id, 'votes', profile.uid) : null),
    [profile?.uid, poll.id]
  );

  const myKeys = myVote ? (Array.isArray(myVote.value) ? myVote.value : [myVote.value]) : [];
  const hasVoted = myKeys.length > 0;
  const myKeysJson = JSON.stringify(myKeys);

  // Approval polls collect selections before casting. The draft remembers the
  // ballot it started from, so it falls back to the recorded ballot whenever
  // that changes - "change your vote" starts from what you actually voted for
  // rather than a blank slate, with no effect needed to keep them in step.
  const pending = draft?.from === myKeysJson ? draft.keys : myKeys;
  const wardLocked = poll.scope === 'ward' && (!profile?.verified || profile.wardId !== poll.wardId);
  const canVote = !!profile && poll.open && !wardLocked;

  const cast = async (value: string | string[]) => {
    if (!profile) return;
    setSaving(true);
    try {
      await votePoll(profile, poll, value);
      setDraft(null); // fall back to the ballot now on record
    } catch (e) {
      notify('Vote failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
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
          <TallyResults tally={poll.tallies} options={poll.options} highlightKeys={myKeys} />
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
