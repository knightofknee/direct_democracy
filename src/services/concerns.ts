import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { emptyTally } from '@/lib/tally';
import {
  CONCERN_PRIORITIES,
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
 * document — the tallies and board scores are aggregated server-side by the
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
    registeredVoter: profile.registeredVoter,
    createdAt: serverTimestamp(),
  });
}

/** Comment counts are likewise maintained by the onCommentCreated trigger. */
export async function addComment(
  profile: UserProfile,
  concernId: string,
  body: string
): Promise<void> {
  await addDoc(collection(db, 'concerns', concernId, 'comments'), {
    authorUid: profile.uid,
    authorName: profile.displayName,
    authorVerified: profile.verified,
    body: body.trim(),
    createdAt: serverTimestamp(),
  });
}
