import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ContentActions } from '@/components/content-actions';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Field, VerifiedBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBlocks } from '@/hooks/use-blocks';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import type { Comment, CommentReply } from '@/lib/types';

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
}) {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const { isBlocked } = useBlocks();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ threadId: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

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

    const result: { root: Comment | null; replies: Comment[] }[] = roots.map((root) => ({
      root,
      replies: byThread.get(root.id) ?? [],
    }));
    // Replies whose root was removed still belong to the record.
    const rootIds = new Set(roots.map((r) => r.id));
    for (const [threadId, replies] of byThread) {
      if (!rootIds.has(threadId)) result.push({ root: null, replies });
    }
    return result;
  }, [visible]);

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
}: {
  comment: Comment;
  /** Set on replies - suppresses the "replying to" line when it's the root author. */
  rootAuthorName?: string;
  opUid?: string;
  opChipLabel?: string;
  contentPathFor: (comment: Comment) => string;
  onDelete: (comment: Comment) => Promise<void>;
  onReply: (comment: Comment) => void;
}) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isMine = profile?.uid === comment.authorUid;
  const isOp = opUid != null && comment.authorUid === opUid;
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
    <Card>
      <View style={styles.metaRow}>
        <ThemedText type="smallBold">{comment.authorName}</ThemedText>
        {isOp && <Chip label={opChipLabel ?? 'candidate'} tone="primary" icon="ribbon" />}
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
      <View style={styles.actionsRow}>
        <Pressable onPress={() => onReply(comment)} hitSlop={8} style={styles.replyButton}>
          <Ionicons name="arrow-undo-outline" size={13} color={theme.primary} />
          <ThemedText type="small" style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>
            Reply
          </ThemedText>
        </Pressable>
        <View style={{ flex: 1 }} />
        {isMine &&
          (confirmRemove ? (
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button title="Yes, remove" variant="danger" onPress={remove} />
              <Button title="Keep" variant="ghost" onPress={() => setConfirmRemove(false)} />
            </View>
          ) : (
            <Pressable onPress={() => setConfirmRemove(true)} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                Remove
              </ThemedText>
            </Pressable>
          ))}
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
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
