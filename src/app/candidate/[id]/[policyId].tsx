import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CommentsSection } from '@/components/comments';
import { ContentActions } from '@/components/content-actions';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { host } from '@/lib/format';
import { confirmDestructive, notify, notifyError } from '@/lib/notify';
import { openLink } from '@/lib/open-link';
import type { Candidate, Comment, Policy } from '@/lib/types';
import {
  addPolicyComment,
  deletePolicy,
  deletePolicyComment,
  setCommentCredit,
  setPolicyArchived,
  voteOnPolicyComment,
} from '@/services/candidates';

/** One plank of a platform: the full text, the receipts, the feedback. */
export default function PolicyScreen() {
  const { id, policyId } = useLocalSearchParams<{ id: string; policyId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const { data: candidate } = useLiveDoc<Candidate>(
    () => (id ? doc(db, 'candidates', id) : null),
    [id]
  );
  const { data: policy, loading } = useLiveDoc<Policy>(
    () => (id && policyId ? doc(db, 'candidates', id, 'policies', policyId) : null),
    [id, policyId]
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

  const isThisCandidate = profile?.uid === policy.candidateUid;

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
        {policy.source === 'site' && candidate?.sourceUrl ? (
          // Imported wholesale from the campaign site; the label goes away
          // the moment the candidate edits the policy in the app (takeover).
          <Pressable
            onPress={() => void openLink(candidate.sourceUrl!)}
            style={styles.linkRow}
            accessibilityRole="link">
            <Ionicons name="globe-outline" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, fontSize: 12, flex: 1 }}>
              Imported from {host(candidate.sourceUrl)}
            </ThemedText>
          </Pressable>
        ) : null}
        <ThemedText>{policy.body}</ThemedText>
      </View>

      {policy.links.length > 0 && <Receipts links={policy.links} />}

      {isThisCandidate && <CandidateTools policy={policy} />}

      <SectionHeader title={`Comments (${policy.commentCount})`} />
      <CommentsSection
        comments={comments}
        opUid={policy.candidateUid}
        contentPathFor={(comment) =>
          `candidates/${policy.candidateUid}/policies/${policy.id}/comments/${comment.id}`
        }
        onSubmit={(body, reply, references) =>
          addPolicyComment(profile!, policy.candidateUid, policy.id, body, reply, references)
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

  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        Receipts
      </ThemedText>
      {links.map((link, i) => (
        <Pressable
          key={`${link.url}-${i}`}
          onPress={() => void openLink(link.url)}
          style={styles.linkRow}>
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
      <View style={{ gap: Spacing.two }}>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          This policy syncs from your campaign site. Edit it there and it updates on the next
          sync - or edit it here to take it over, after which the site no longer updates it.
        </ThemedText>
        <View style={{ flexDirection: 'row' }}>
          <Button
            title="Edit here and take over"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/edit-policy',
                params: { candidateId: policy.candidateUid, policyId: policy.id },
              })
            }
          />
        </View>
      </View>
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
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
