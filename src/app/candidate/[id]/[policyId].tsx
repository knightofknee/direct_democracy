import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CommentsSection } from '@/components/comments';
import { ContentActions } from '@/components/content-actions';
import { LensToggle } from '@/components/lens-toggle';
import { Screen } from '@/components/screen';
import { TallyResults } from '@/components/tally-results';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { confirmDestructive, notify, notifyError } from '@/lib/notify';
import type { Candidate, Comment, Policy, PolicyStance, VoteDoc } from '@/lib/types';
import {
  addPolicyComment,
  deletePolicy,
  deletePolicyComment,
  setCommentCredit,
  setPolicyArchived,
  voteOnPolicyComment,
  votePolicy,
} from '@/services/candidates';

const STANCE_OPTIONS: { key: PolicyStance; label: string }[] = [
  { key: 'support', label: 'Support' },
  { key: 'oppose', label: 'Oppose' },
];

/** One plank of a platform: the full text, the receipts, the vote, the fight. */
export default function PolicyScreen() {
  const { id, policyId } = useLocalSearchParams<{ id: string; policyId: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [lens, setLens] = useState<'all' | 'verified'>('all');
  const [savingVote, setSavingVote] = useState(false);

  const { data: candidate } = useLiveDoc<Candidate>(
    () => (id ? doc(db, 'candidates', id) : null),
    [id]
  );
  const { data: policy, loading } = useLiveDoc<Policy>(
    () => (id && policyId ? doc(db, 'candidates', id, 'policies', policyId) : null),
    [id, policyId]
  );
  const { data: myVote } = useLiveDoc<VoteDoc>(
    () =>
      id && policyId && profile
        ? doc(db, 'candidates', id, 'policies', policyId, 'votes', profile.uid)
        : null,
    [id, policyId, profile?.uid]
  );
  const { data: comments } = useLiveQuery<Comment>(
    () =>
      id && policyId
        ? query(
            collection(db, 'candidates', id, 'policies', policyId, 'comments'),
            orderBy('createdAt', 'desc')
          )
        : null,
    [id, policyId]
  );

  if (!policy) {
    return (
      <Screen>
        {loading ? null : <EmptyState icon="alert-circle-outline" message="Policy not found." />}
      </Screen>
    );
  }

  const myStance = (myVote?.value as PolicyStance | undefined) ?? null;
  const isThisCandidate = profile?.uid === policy.candidateUid;

  const castVote = async (stance: PolicyStance) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    setSavingVote(true);
    try {
      await votePolicy(profile, policy.candidateUid, policy.id, stance);
    } catch (e) {
      notifyError('Vote failed', e);
    } finally {
      setSavingVote(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <View style={styles.metaRow}>
          {policy.section ? <Chip label={policy.section} /> : null}
          {policy.archived && <Chip label="Hidden" tone="warning" icon="eye-off" />}
          <View style={{ flex: 1 }} />
          {candidate && (
            <ContentActions
              contentPath={`candidates/${policy.candidateUid}/policies/${policy.id}`}
              contentType="policy"
              excerpt={policy.title}
              authorUid={policy.candidateUid}
              authorName={candidate.name}
            />
          )}
        </View>
        <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 30 }}>
          {policy.title}
        </ThemedText>
        {candidate && (
          <Pressable onPress={() => router.push(`/candidate/${policy.candidateUid}`)}>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              From the platform of {candidate.name} · {candidate.office}
            </ThemedText>
          </Pressable>
        )}
        <ThemedText>{policy.body}</ThemedText>
      </View>

      {policy.links.length > 0 && <Receipts links={policy.links} />}

      {isThisCandidate && <CandidateTools policy={policy} />}

      <SectionHeader title="Where do you stand?" subtitle="Both counts are public: everyone, and verified Chicagoans" />
      <View style={styles.stanceRow}>
        {STANCE_OPTIONS.map((option) => {
          const selected = myStance === option.key;
          return (
            <Button
              key={option.key}
              title={`${option.label}${selected ? ' ✓' : ''}`}
              variant={
                selected ? (option.key === 'support' ? 'primary' : 'danger') : 'secondary'
              }
              onPress={() => castVote(option.key)}
              disabled={savingVote}
              style={{ flex: 1 }}
            />
          );
        })}
      </View>

      <SectionHeader title="Results" />
      <LensToggle value={lens} onChange={setLens} />
      <TallyResults
        tally={policy.tallies}
        options={STANCE_OPTIONS}
        lens={lens}
        highlightKeys={myStance ? [myStance] : undefined}
      />

      <SectionHeader title={`Comments (${policy.commentCount})`} />
      <CommentsSection
        comments={comments}
        opUid={policy.candidateUid}
        contentPathFor={(comment) =>
          `candidates/${policy.candidateUid}/policies/${policy.id}/comments/${comment.id}`
        }
        onSubmit={(body, reply) =>
          addPolicyComment(profile!, policy.candidateUid, policy.id, body, reply)
        }
        onDelete={(comment) =>
          deletePolicyComment(profile!, policy.candidateUid, policy.id, comment)
        }
        onCredit={(comment, credited) =>
          setCommentCredit(profile!, policy.candidateUid, policy.id, comment, credited)
        }
        onVote={(comment, value) =>
          voteOnPolicyComment(profile!, policy.candidateUid, policy.id, comment.id, value)
        }
      />
    </Screen>
  );
}

/** The cited sources backing the policy. */
function Receipts({ links }: { links: Policy['links'] }) {
  const theme = useTheme();

  const open = async (url: string) => {
    const { openBrowserAsync } = await import('expo-web-browser');
    await openBrowserAsync(url);
  };

  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        Receipts
      </ThemedText>
      {links.map((link, i) => (
        <Pressable key={`${link.url}-${i}`} onPress={() => void open(link.url)} style={styles.linkRow}>
          <Ionicons name="link-outline" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, flex: 1 }} numberOfLines={2}>
            {link.label}
          </ThemedText>
        </Pressable>
      ))}
    </Card>
  );
}

/** The candidate's own controls on an in-app policy. */
function CandidateTools({ policy }: { policy: Policy }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  if (policy.source === 'site') {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        This policy is synced from your campaign site - edit it there and it updates here on the
        next sync.
      </ThemedText>
    );
  }

  const toggleArchived = async () => {
    setBusy(true);
    try {
      await setPolicyArchived(profile, policy, !policy.archived);
    } catch (e) {
      notifyError('Could not update', e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    // Third gate on top of the inline two-step - deleting a plank takes the
    // whole debate with it, so it must be hard to do by accident.
    const sure = await confirmDestructive(
      'Delete this policy?',
      'This permanently removes the policy, everyone’s votes on it, and its comments. It cannot be undone.',
      'Delete forever'
    );
    if (!sure) return;
    setBusy(true);
    try {
      await deletePolicy(profile, policy);
      notify('Policy withdrawn', 'The policy and its votes were removed.');
      if (router.canGoBack()) router.back();
      else router.replace(`/candidate/${policy.candidateUid}`);
    } catch (e) {
      notifyError('Could not delete', e);
      setBusy(false);
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
      <Button
        title="Edit"
        variant="secondary"
        disabled={busy}
        onPress={() =>
          router.push({
            pathname: '/edit-policy',
            params: { candidateId: policy.candidateUid, policyId: policy.id },
          })
        }
      />
      <Button
        title={policy.archived ? 'Unhide' : 'Hide'}
        variant="secondary"
        disabled={busy}
        onPress={toggleArchived}
      />
      {confirmDelete ? (
        <>
          <Button title="Yes, delete" variant="danger" onPress={remove} disabled={busy} />
          <Button title="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
        </>
      ) : (
        <Button title="Delete" variant="ghost" onPress={() => setConfirmDelete(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  stanceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
