import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { emptyTally } from '@/lib/tally';
import {
  CONCERN_PRIORITIES,
  type CommentReply,
  type ConcernPriority,
  type Scope,
  type UserProfile,
} from '@/lib/types';

export async function createConcern(
  profile: UserProfile,
  input: { title: string; body: string; scope: Scope }
): Promise<string> {
  const wardId = input.scope === 'ward' ? profile.wardId : null;
  if (input.scope === 'ward' && wardId == null) {
    throw new Error('Ward concerns require a verified ward.');
  }
  const ref = await addDoc(collection(db, 'concerns'), {
    title: input.title.trim(),
    body: input.body.trim(),
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
  if (!CONCERN_PRIORITIES.includes(priority)) throw new Error('Invalid priority.');
  await setDoc(doc(db, 'concerns', concernId, 'votes', profile.uid), {
    uid: profile.uid,
    value: priority,
    verified: profile.verified,
    wardId: profile.wardId,
    createdAt: serverTimestamp(),
  });
}

/**
 * Authors may fix a concern only before anyone votes or comments - after
 * that, edits would change what people already voted on (rules enforce it).
 */
export async function updateConcern(
  profile: UserProfile,
  concern: { id: string; authorUid: string },
  input: { title: string; body: string }
): Promise<void> {
  if (profile.uid !== concern.authorUid) throw new Error('Only the author can edit a concern.');
  await updateDoc(doc(db, 'concerns', concern.id), {
    title: input.title.trim(),
    body: input.body.trim(),
  });
}

/** Withdraw a concern entirely; the onConcernDeleted trigger cleans up. */
export async function deleteConcern(
  profile: UserProfile,
  concern: { id: string; authorUid: string }
): Promise<void> {
  if (profile.uid !== concern.authorUid) throw new Error('Only the author can delete a concern.');
  await deleteDoc(doc(db, 'concerns', concern.id));
}

/** Remove one of your own comments; onCommentDeleted keeps the count honest. */
export async function deleteComment(
  profile: UserProfile,
  concernId: string,
  comment: { id: string; authorUid: string }
): Promise<void> {
  if (profile.uid !== comment.authorUid) throw new Error('Only the author can delete a comment.');
  await deleteDoc(doc(db, 'concerns', concernId, 'comments', comment.id));
}

/** Comment counts are likewise maintained by the onCommentCreated trigger. */
export async function addComment(
  profile: UserProfile,
  concernId: string,
  body: string,
  reply?: CommentReply | null
): Promise<void> {
  await addDoc(collection(db, 'concerns', concernId, 'comments'), {
    authorUid: profile.uid,
    authorName: profile.displayName,
    authorVerified: profile.verified,
    body: body.trim(),
    threadId: reply?.threadId ?? null,
    replyToName: reply?.replyToName ?? null,
    createdAt: serverTimestamp(),
  });
}
