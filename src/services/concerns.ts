import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { emptyTally } from '@/lib/tally';
import {
  CONCERN_PRIORITIES,
  type CommentReply,
  type CommentVoteValue,
  type ConcernPriority,
  type Scope,
  type UserProfile,
} from '@/lib/types';
import { tr } from '@/lib/i18n';

export const MAX_REFERENCES = 10;

/**
 * Trim the reference list, drop unused trailing blanks, and demand https on
 * the rest. A blank in the MIDDLE is an error rather than a silent drop -
 * removing it would renumber every *N citation after it. Shared by concern
 * references and comment sources.
 */
export function cleanReferences(references: string[]): string[] {
  const refs = references.map((r) => r.trim());
  while (refs.length && refs[refs.length - 1] === '') refs.pop();
  refs.forEach((r, i) => {
    if (!r) throw new Error(tr('Reference {n} is blank - fill it in or remove it.').replace('{n}', String(i + 1)));
    if (!r.startsWith('https://')) throw new Error(tr('Reference {n} must be an https:// link.').replace('{n}', String(i + 1)));
    if (r.length > 500) throw new Error(tr('Reference {n} is too long (500 characters max).').replace('{n}', String(i + 1)));
  });
  if (refs.length > MAX_REFERENCES) {
    throw new Error(tr('At most {n} references per concern.').replace('{n}', String(MAX_REFERENCES)));
  }
  return refs;
}

export async function createConcern(
  profile: UserProfile,
  input: { title: string; body: string; scope: Scope; wardId?: number | null; references?: string[] }
): Promise<string> {
  // Any ward, not just home (2026-09-27); onConcernCreated holds each post
  // to the ward posting limits.
  const wardId = input.scope === 'ward' ? (input.wardId ?? profile.wardId) : null;
  if (input.scope === 'ward' && wardId == null) {
    throw new Error(tr('Pick the ward this concern belongs to.'));
  }
  const ref = await addDoc(collection(db, 'concerns'), {
    title: input.title.trim(),
    body: input.body.trim(),
    references: cleanReferences(input.references ?? []),
    scope: input.scope,
    wardId,
    authorUid: profile.uid,
    authorName: profile.displayName,
    authorVerified: profile.verified,
    tallies: emptyTally(),
    score: 0,
    scoreVerified: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Cast (or change) a priority vote. The client writes only its own ballot
 * document - the tallies and board scores are aggregated server-side by the
 * onConcernVoteWrite Cloud Function, so no client can touch the totals.
 */
export async function voteConcernPriority(
  profile: UserProfile,
  concernId: string,
  priority: ConcernPriority
): Promise<void> {
  if (!CONCERN_PRIORITIES.includes(priority)) throw new Error(tr('Invalid priority.'));
  await setDoc(doc(db, 'concerns', concernId, 'votes', profile.uid), {
    uid: profile.uid,
    value: priority,
    verified: profile.verified,
    wardId: profile.wardId,
    createdAt: serverTimestamp(),
  });
}

/** Take back a priority vote (tap it again); the trigger drops it from the tally. */
export async function retractConcernVote(profile: UserProfile, concernId: string): Promise<void> {
  await deleteDoc(doc(db, 'concerns', concernId, 'votes', profile.uid));
}

/** Withdraw a concern entirely; the onConcernDeleted trigger cleans up. */
export async function deleteConcern(
  profile: UserProfile,
  concern: { id: string; authorUid: string }
): Promise<void> {
  if (profile.uid !== concern.authorUid) throw new Error(tr('Only the author can delete a concern.'));
  await deleteDoc(doc(db, 'concerns', concern.id));
}

/**
 * Rate a comment up or down (null retracts). Placement-only: the trigger
 * folds ballots into the comment's hidden ordering score.
 */
export async function voteOnComment(
  profile: UserProfile,
  concernId: string,
  commentId: string,
  value: CommentVoteValue | null
): Promise<void> {
  const ref = doc(db, 'concerns', concernId, 'comments', commentId, 'votes', profile.uid);
  if (value === null) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    uid: profile.uid,
    value,
    verified: profile.verified,
    createdAt: serverTimestamp(),
  });
}

/** Remove one of your own comments; onCommentDeleted keeps the count honest. */
export async function deleteComment(
  profile: UserProfile,
  concernId: string,
  comment: { id: string; authorUid: string }
): Promise<void> {
  if (profile.uid !== comment.authorUid) throw new Error(tr('Only the author can delete a comment.'));
  await deleteDoc(doc(db, 'concerns', concernId, 'comments', comment.id));
}

/** Comment counts are likewise maintained by the onCommentCreated trigger. */
export async function addComment(
  profile: UserProfile,
  concernId: string,
  body: string,
  reply?: CommentReply | null,
  references?: string[]
): Promise<void> {
  await addDoc(collection(db, 'concerns', concernId, 'comments'), {
    authorUid: profile.uid,
    authorName: profile.displayName,
    authorVerified: profile.verified,
    body: body.trim(),
    references: cleanReferences(references ?? []),
    threadId: reply?.threadId ?? null,
    replyToName: reply?.replyToName ?? null,
    replyToUid: reply?.replyToUid ?? null,
    createdAt: serverTimestamp(),
  });
}
