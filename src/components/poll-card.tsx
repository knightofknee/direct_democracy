import { doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCelebration } from '@/components/celebration';
import { HomeWardChoice } from '@/components/home-ward-choice';
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
import { plural } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { errorMessage, notify } from '@/lib/notify';
import { withBallotDelta, type BallotDelta } from '@/lib/tally';
import type { Poll, VoteDoc } from '@/lib/types';
import { closePoll, retractPollVote, votePoll } from '@/services/polls';

const TYPE_LABELS: Record<Poll['type'], string> = {
  yesNo: 'Yes / No',
  multipleChoice: 'Pick one',
  approval: 'Pick all you support',
  scale5: 'How strongly do you feel?',
};

export function PollCard({
  poll,
  manage = false,
}: {
  poll: Poll;
  /** The author's controls (close voting): only in their command center. */
  manage?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
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
  // Built-in option labels (yes/no, the 5-point scale) are the app's own
  // words to translate; multiple-choice and approval options are the
  // author's words and stay as written.
  const builtinLabels = poll.type === 'yesNo' || poll.type === 'scale5';
  const shownOptions = builtinLabels
    ? poll.options.map((o) => ({ ...o, label: t(o.label) }))
    : poll.options;

  // Approval polls collect selections before casting. The draft remembers the
  // ballot it started from, so it falls back to the recorded ballot whenever
  // that changes - "change your vote" starts from what you actually voted for
  // rather than a blank slate, with no effect needed to keep them in step.
  const pending = draft?.from === myKeysJson ? draft.keys : myKeys;
  // Ward polls take a home ward in that ward, verified or declared.
  const wardLocked = poll.scope === 'ward' && profile?.wardId !== poll.wardId;
  // The author watches their own poll rather than voting in it: live
  // results from the first ballot, open or closed.
  const isAuthor = profile?.uid === poll.authorUid;
  const canVote = !!profile && poll.open && !wardLocked && !isAuthor;

  // Optimistic: the tap counts NOW (tally overlay + milestone), because the
  // tally-trigger round trip is seconds and that reads as a broken button.
  // On failure we roll back and say so.
  // `null` takes the vote back (allowed while voting is open).
  const cast = (value: string | string[] | null) => {
    if (!profile) return;
    tapHaptic();
    // "First" only once the vote doc has actually loaded (see milestones.ts).
    // A server count of zero means certainly first, loaded or not.
    const firstCast =
      (!myVoteLoading && recordedKeys.length === 0) || (profile.stats?.votes ?? 0) === 0;
    if (value != null && firstCast) anticipate('votes');
    setOptimistic({
      delta: {
        // The ballot the server tally holds: while an earlier tap is still in
        // flight, the overlay's own starting ballot, not the cached new one.
        from: optimistic ? optimistic.delta.from : recordedKeys.length > 0 ? recordedKeys : null,
        to: value,
        // Ward polls only accept residents of the ward (rules), so a voter
        // who can cast at all counts in the verified slice iff verified.
        verified: !!profile.verified && (poll.scope !== 'ward' || profile.wardId === poll.wardId),
      },
      baseline: JSON.stringify(poll.tallies),
    });
    setDraft(null); // fall back to the ballot now on record
    (value == null ? retractPollVote(profile, poll) : votePoll(profile, poll, value)).catch((e) => {
      setOptimistic(null);
      notify(t('Vote failed'), errorMessage(e));
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
        <Chip label={poll.open ? t(TYPE_LABELS[poll.type]) : t('Closed')} tone={poll.open ? 'neutral' : 'warning'} />
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
        {t('Asked by {name}').replace('{name}', poll.authorName)}
      </ThemedText>

      {hasVoted || !canVote ? (
        <View style={{ gap: Spacing.two }}>
          <TallyResults tally={shownTallies} options={shownOptions} highlightKeys={myKeys} />
          {hasVoted && poll.open && (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {t(poll.type === 'approval'
                ? 'You voted. Change your picks below, or clear them all to take your vote back.'
                : 'You voted. Tap another option to change it, or yours again to take it back.')}
            </ThemedText>
          )}
        </View>
      ) : null}

      {canVote && !hasVoted ? (
        // Everyone sees how many have taken part; the breakdown is the
        // reward for taking part yourself.
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('{votes} so far. Vote to see the results.').replace(
            '{votes}',
            `${plural(shownTallies.totalAll, 'vote')} · ${plural(shownTallies.totalVerified, 'verified vote')}`
          )}
        </ThemedText>
      ) : null}

      {canVote ? (
        <View style={{ gap: Spacing.two }}>
          {shownOptions.map((option) => {
            const selected =
              poll.type === 'approval' ? pending.includes(option.key) : myKeys.includes(option.key);
            return (
              <Pressable
                key={option.key}
                disabled={saving}
                accessibilityRole={poll.type === 'approval' ? 'checkbox' : 'radio'}
                accessibilityLabel={option.label}
                accessibilityState={{ selected, checked: poll.type === 'approval' ? selected : undefined }}
                onPress={() =>
                  poll.type === 'approval'
                    ? toggleApproval(option.key)
                    : cast(myKeys.includes(option.key) ? null : option.key)
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
              title={hasVoted ? (pending.length === 0 ? t('Take back my vote') : t('Update votes')) : t('Cast votes')}
              onPress={() => cast(pending.length === 0 ? null : pending)}
              disabled={pending.length === 0 && !hasVoted}
              loading={saving}
            />
          )}
        </View>
      ) : null}

      {manage && profile?.uid === poll.authorUid && poll.open && (
        <Button
          title={t('Close voting')}
          variant="secondary"
          loading={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await closePoll(profile, poll);
            } catch (e) {
              notify(t('Could not close poll'), errorMessage(e));
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {wardLocked &&
        profile &&
        (profile.wardId == null ? (
          <HomeWardChoice note={t('Ward polls are for residents of the ward.')} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('Only residents of this ward can vote on this poll.')}
          </ThemedText>
        ))}
      {!profile &&
        (authLoading ? (
          <SkeletonButton />
        ) : (
          <Button title={t('Sign in to vote')} variant="secondary" onPress={() => router.push('/sign-in')} />
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
