import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { Pressable, StyleSheet, View } from 'react-native';

import { ShareButton } from '@/components/share-button';
import { HeaderActions } from '@/components/help-button';
import { CommentsSection } from '@/components/comments';
import { ContentActions } from '@/components/content-actions';
import { CopyLinkButton } from '@/components/copy-link';
import { PolicyBody } from '@/components/policy-body';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { host, timeAgo } from '@/lib/format';
import { usePageSummary } from '@/lib/page-help';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/open-link';
import type { Candidate, Comment, Policy } from '@/lib/types';
import {
  addPolicyComment,
  deletePolicyComment,
  setCommentCredit,
  voteOnPolicyComment,
} from '@/services/candidates';

/** One plank of a platform: the full text, the receipts, the feedback. */
export default function PolicyScreen() {
  const { id, policyId } = useLocalSearchParams<{ id: string; policyId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const t = useT();

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

  usePageSummary('candidate/[id]/[policyId]', [
    policy &&
      (candidate
        ? t('“{title}”, from the platform of {name}.').replace('{title}', policy.title).replace('{name}', candidate.name)
        : `“${policy.title}”`),
    policy && policy.links.length > 0 && t('Sources listed: {n}.').replace('{n}', String(policy.links.length)),
    comments.length > 0
      ? t('Comments: {n}, newest {ago}.')
          .replace('{n}', String(comments.length))
          .replace('{ago}', timeAgo(comments[0].createdAt))
      : t('No comments yet.'),
  ]);

  if (!policy) {
    return (
      <Screen>
        {loading ? null : <EmptyState icon="alert-circle-outline" message={t('Policy not found.')} />}
      </Screen>
    );
  }

  // Directory entries are people, not policies: readable and linkable, but
  // not commentable or reportable - the debate belongs on real platforms.
  const isDirectory = !!candidate?.directory;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderActions>
              <ShareButton path={`/candidate/${policy.candidateUid}/${policy.id}`} title={policy.title} />
            </HeaderActions>
          ),
        }}
      />
      <View style={{ gap: Spacing.two }}>
        <View style={styles.metaRow}>
          {policy.section ? <Chip label={policy.section} /> : null}
          {policy.archived && <Chip label={t('Hidden')} tone="warning" icon="eye-off" />}
          <View style={{ flex: 1 }} />
          {candidate && !isDirectory && (
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
              {isDirectory
                ? t('Declared candidate · no platform published to import')
                : `${t('From the platform of {name}').replace('{name}', candidate.name)} · ${t(candidate.office)}`}
            </ThemedText>
          </Pressable>
        )}
        {policy.source === 'site' && candidate?.sourceUrl ? (
          // Imported wholesale from the campaign site; the label goes away
          // the moment the candidate edits the policy in the app (takeover).
          <View style={styles.linkRow}>
            <Pressable
              onPress={() => void openLink(candidate.sourceUrl!)}
              style={[styles.linkRow, { flex: 1 }]}
              accessibilityRole="link">
              <Ionicons name="globe-outline" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, fontSize: 12, flex: 1 }}>
                {t('Imported from {host}').replace('{host}', host(candidate.sourceUrl))}
              </ThemedText>
            </Pressable>
            <CopyLinkButton url={candidate.sourceUrl} label={t('Copy platform source link')} />
          </View>
        ) : null}
        <PolicyBody body={policy.body} />
      </View>

      {policy.links.length > 0 && (
        <Receipts links={policy.links} title={isDirectory ? t('Links') : t('Receipts')} />
      )}


      {/* Until the candidate doc has loaded we cannot know whether this is a
          directory entry - render no comment surface rather than risk one. */}
      {!candidate || isDirectory ? null : (
        <>
          <SectionHeader title={`${t('Comments')} (${policy.commentCount})`} />
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
        </>
      )}
    </Screen>
  );
}

/** The cited sources backing the policy (or the plain links, for directory entries). */
function Receipts({ links, title }: { links: Policy['links']; title: string }) {
  const theme = useTheme();
  const t = useT();

  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        {title}
      </ThemedText>
      {links.map((link, i) => (
        <View key={`${link.url}-${i}`} style={styles.linkRow}>
          <Pressable onPress={() => void openLink(link.url)} style={[styles.linkRow, { flex: 1 }]}>
            <Ionicons name="link-outline" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, flex: 1 }} numberOfLines={2}>
              {link.label}
            </ThemedText>
          </Pressable>
          <CopyLinkButton url={link.url} label={`${t('Copy link:')} ${link.label}`} />
        </View>
      ))}
    </Card>
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
