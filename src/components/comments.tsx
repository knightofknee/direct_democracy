import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { doc } from 'firebase/firestore';

import { ContentActions } from '@/components/content-actions';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import type { Comment, CommentReply, CommentSort, CommentVoteValue } from '@/lib/types';

const SORTS: { key: CommentSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'best', label: 'Best' },
];

/**
 * The comments section, threaded. Every top-level comment starts a thread;
 * replies to anything in that thread - including replies to replies - land in
 * the same thread, flat and chronological with "replying to X" context. The
 * back-and-forth is unlimited; only the indentation is capped at one level so
 * a fifth rebuttal is as readable as the first.
 */
export function CommentsSection({
  comments,
  opUid,
  opChipLabel = 'candidate',
  contentPathFor,
  onSubmit,
  onDelete,
  onCredit,
  onVote,
}: {
  /** Live comment list, newest first (as the screens already query it). */
  comments: Comment[];
  /** Author uid marked as the OP (e.g. the candidate on their own platform). */
  opUid?: string;
  opChipLabel?: string;
  /** Firestore path of a comment - feeds the report/block affordance. */
  contentPathFor: (comment: Comment) => string;
  onSubmit: (body: string, reply: CommentReply | null) => Promise<void>;
  onDelete: (comment: Comment) => Promise<void>;
  /** Present on policy pages: the OP awarding/retracting a writing credit. */
  onCredit?: (comment: Comment, credited: boolean) => Promise<void>;
  /** Rate a comment up/down (null retracts) - powers the "best" sort. */
  onVote: (comment: Comment, value: CommentVoteValue | null) => Promise<void>;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const { isBlocked } = useBlocks();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ threadId: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sort, setSort] = useState<CommentSort>('newest');

  const visible = comments.filter((c) => !isBlocked(c.authorUid));

  const threads = useMemo(() => {
    const roots = visible.filter((c) => !c.threadId);
    const byThread = new Map<string, Comment[]>();
    for (const c of visible) {
      if (c.threadId) {
        const list = byThread.get(c.threadId);
        if (list) list.push(c);
        else byThread.set(c.threadId, [c]);
      }
    }
    // The list arrives newest-first; a conversation reads oldest-first.
    for (const list of byThread.values()) list.reverse();

    // Thread order stays neutral (newest first) - the candidate's attention
    // must not decide which comments are seen. Their reply only wins the tie
    // INSIDE its own thread: OP replies lead the replies, others follow in
    // conversation order ("replying to X" keeps the exchange readable).
    const orderReplies = (list: Comment[]) =>
      opUid == null
        ? list
        : [...list.filter((r) => r.authorUid === opUid), ...list.filter((r) => r.authorUid !== opUid)];

    const result: { root: Comment | null; replies: Comment[] }[] = roots.map((root) => ({
      root,
      replies: orderReplies(byThread.get(root.id) ?? []),
    }));
    // Replies whose root was removed still belong to the record.
    const rootIds = new Set(roots.map((r) => r.id));
    for (const [threadId, replies] of byThread) {
      if (!rootIds.has(threadId)) result.push({ root: null, replies: orderReplies(replies) });
    }

    // Sorting orders whole threads by their root; the conversation inside a
    // thread never reorders. "Best" ranks by the hidden rating score (worst
    // sinks to the bottom - there is deliberately no worst-first sort), with
    // recency breaking ties via the stable sort over the newest-first list.
    if (sort === 'oldest') result.reverse();
    if (sort === 'best') {
      result.sort((a, b) => (b.root?.score ?? 0) - (a.root?.score ?? 0));
    }
    return result;
  }, [visible, opUid, sort]);

  const startReply = (comment: Comment) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    // Replying to a reply joins its thread, answering that specific person.
    setReplyTo({ threadId: comment.threadId ?? comment.id, name: comment.authorName });
  };

  const submit = async () => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    try {
      await onSubmit(body, replyTo ? { threadId: replyTo.threadId, replyToName: replyTo.name } : null);
      setText('');
      setReplyTo(null);
    } catch (e) {
      notifyError('Comment failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {profile ? (
        <Card>
          {replyTo && (
            <View style={styles.replyBanner}>
              <Ionicons name="return-down-forward" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, fontSize: 12, flex: 1 }}>
                Replying to {replyTo.name}
              </ThemedText>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityLabel="Cancel reply">
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          )}
          <Field
            placeholder={replyTo ? `Answer ${replyTo.name}…` : 'Add to the discussion…'}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Button
            title={replyTo ? 'Post reply' : 'Post comment'}
            onPress={submit}
            disabled={!text.trim()}
            loading={saving}
          />
        </Card>
      ) : (
        <Button title="Sign in to comment" variant="secondary" onPress={() => router.push('/sign-in')} />
      )}

      {threads.length > 0 && (
        <View style={styles.sortRow}>
          {SORTS.map((s) => {
            const selected = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                hitSlop={4}
                style={[
                  styles.sortChip,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{
                    fontSize: 12,
                    color: selected ? theme.primary : theme.textSecondary,
                    fontWeight: selected ? '700' : '500',
                  }}>
                  {s.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      {threads.length === 0 ? (
        <EmptyState icon="chatbubble-ellipses-outline" message="No comments yet." />
      ) : (
        threads.map(({ root, replies }) => (
          <View key={root?.id ?? replies[0].threadId ?? replies[0].id} style={{ gap: Spacing.two }}>
            {root ? (
              <CommentRow
                comment={root}
                opUid={opUid}
                opChipLabel={opChipLabel}
                contentPathFor={contentPathFor}
                onDelete={onDelete}
                onReply={startReply}
                onCredit={onCredit}
                onVote={onVote}
              />
            ) : (
              <Card>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  Comment removed
                </ThemedText>
              </Card>
            )}
            {replies.length > 0 && (
              <View style={[styles.replyGroup, { borderLeftColor: theme.border }]}>
                {replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    rootAuthorName={root?.authorName}
                    opUid={opUid}
                    opChipLabel={opChipLabel}
                    contentPathFor={contentPathFor}
                    onDelete={onDelete}
                    onReply={startReply}
                    onCredit={onCredit}
                    onVote={onVote}
                  />
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </>
  );
}

function CommentRow({
  comment,
  rootAuthorName,
  opUid,
  opChipLabel,
  contentPathFor,
  onDelete,
  onReply,
  onCredit,
  onVote,
}: {
  comment: Comment;
  /** Set on replies - suppresses the "replying to" line when it's the root author. */
  rootAuthorName?: string;
  opUid?: string;
  opChipLabel?: string;
  contentPathFor: (comment: Comment) => string;
  onDelete: (comment: Comment) => Promise<void>;
  onReply: (comment: Comment) => void;
  onCredit?: (comment: Comment, credited: boolean) => Promise<void>;
  onVote: (comment: Comment, value: CommentVoteValue | null) => Promise<void>;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [voting, setVoting] = useState(false);
  const isMine = profile?.uid === comment.authorUid;
  const isOp = opUid != null && comment.authorUid === opUid;
  const canCredit = onCredit != null && profile?.uid === opUid && !isOp;

  // My rating on this comment - drives the arrow highlight and retraction.
  const { data: myVote } = useLiveDoc<{ value: CommentVoteValue }>(
    () => (profile ? doc(db, `${contentPathFor(comment)}/votes/${profile.uid}`) : null),
    [comment.id, profile?.uid]
  );

  const vote = async (value: CommentVoteValue) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    setVoting(true);
    try {
      // Tapping the active arrow retracts the rating.
      await onVote(comment, myVote?.value === value ? null : value);
    } catch (e) {
      notifyError('Vote failed', e);
    } finally {
      setVoting(false);
    }
  };

  const credit = async () => {
    if (!onCredit) return;
    setCrediting(true);
    try {
      await onCredit(comment, !comment.credited);
    } catch (e) {
      notifyError('Could not update credit', e);
    } finally {
      setCrediting(false);
    }
  };
  // "replying to X" only earns its line when it isn't obvious from position.
  const replyContext =
    comment.replyToName && comment.replyToName !== rootAuthorName ? comment.replyToName : null;

  const remove = async () => {
    try {
      await onDelete(comment);
    } catch (e) {
      notifyError('Could not delete comment', e);
    }
  };

  return (
    <Card style={isOp ? { borderColor: theme.primary, borderWidth: 1 } : undefined}>
      <View style={styles.metaRow}>
        <ThemedText type="smallBold">{comment.authorName}</ThemedText>
        {isOp && <Chip label={opChipLabel ?? 'candidate'} tone="primary" icon="ribbon" />}
        {comment.credited && <Chip label="writing credit" tone="success" icon="pencil" />}
        {comment.authorVerified && <VerifiedBadge compact />}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {timeAgo(comment.createdAt)}
        </ThemedText>
        <View style={{ flex: 1 }} />
        <ContentActions
          contentPath={contentPathFor(comment)}
          contentType="comment"
          excerpt={comment.body}
          authorUid={comment.authorUid}
          authorName={comment.authorName}
        />
      </View>
      {replyContext && (
        <View style={styles.replyContext}>
          <Ionicons name="return-down-forward" size={12} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
            replying to {replyContext}
          </ThemedText>
        </View>
      )}
      <ThemedText type="small">{comment.body}</ThemedText>
      {/* Frequent actions live on the RIGHT, votes in the outermost thumb
          corner; each target is padded to ~38pt so up/down can't be
          fat-fingered. Remove (rare, own comments) stays quiet on the left. */}
      <View style={styles.actionsRow}>
        {isMine &&
          (confirmRemove ? (
            <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
              <Button title="Yes, remove" variant="danger" onPress={remove} />
              <Button title="Keep" variant="ghost" onPress={() => setConfirmRemove(false)} />
            </View>
          ) : (
            <Pressable onPress={() => setConfirmRemove(true)} hitSlop={8} style={styles.action}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                Remove
              </ThemedText>
            </Pressable>
          ))}
        <View style={{ flex: 1 }} />
        {canCredit && (
          <Pressable onPress={credit} hitSlop={4} disabled={crediting} style={styles.action}>
            <Ionicons name="pencil" size={14} color={theme.verified} />
            <ThemedText type="small" style={{ fontSize: 12, color: theme.verified, fontWeight: '600' }}>
              {comment.credited ? 'Retract credit' : 'Credit'}
            </ThemedText>
          </Pressable>
        )}
        <Pressable onPress={() => onReply(comment)} hitSlop={4} style={styles.action}>
          <Ionicons name="arrow-undo-outline" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>
            Reply
          </ThemedText>
        </Pressable>
        {/* Ratings are placement-only: arrows, no counts. */}
        <Pressable
          onPress={() => vote('up')}
          disabled={voting}
          hitSlop={4}
          accessibilityLabel="Rate up"
          style={styles.action}>
          <Ionicons
            name={myVote?.value === 'up' ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
            size={22}
            color={myVote?.value === 'up' ? theme.primary : theme.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={() => vote('down')}
          disabled={voting}
          hitSlop={4}
          accessibilityLabel="Rate down"
          style={styles.action}>
          <Ionicons
            name={myVote?.value === 'down' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
            size={22}
            color={myVote?.value === 'down' ? theme.danger : theme.textSecondary}
          />
        </Pressable>
      </View>
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
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  replyGroup: {
    marginLeft: Spacing.three,
    paddingLeft: Spacing.two,
    borderLeftWidth: 2,
    gap: Spacing.two,
  },
  replyContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  // Padded so every action clears ~38pt of touch target on its own.
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sortRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  sortChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
});
