import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { applyVote, emptyTally, removeBallot, weightedScore } from '@/lib/tally';
import {
  PRIORITY_WEIGHTS,
  type Concern,
  type ConcernPriority,
  type DualTally,
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
 * Cast (or change) a priority vote on a concern. Dual tallies and both rank
 * scores are updated in one transaction so the big board never drifts.
 */
export async function voteConcernPriority(
  profile: UserProfile,
  concernId: string,
  priority: ConcernPriority
): Promise<void> {
  const concernRef = doc(db, 'concerns', concernId);
  const voteRef = doc(db, 'concerns', concernId, 'votes', profile.uid);

  await runTransaction(db, async (tx) => {
    const [concernSnap, voteSnap] = await Promise.all([tx.get(concernRef), tx.get(voteRef)]);
    if (!concernSnap.exists()) throw new Error('Concern not found.');

    const previous = voteSnap.exists() ? (voteSnap.data().value as ConcernPriority) : null;
    // Slices are decided by the snapshot stored on the previous ballot, so a
    // voter who verified after voting doesn't corrupt the decrement.
    const prevSlices = voteSnap.exists()
      ? { verified: !!voteSnap.data().verified, registeredVoter: !!voteSnap.data().registeredVoter }
      : { verified: profile.verified, registeredVoter: profile.registeredVoter };

    let tallies = concernSnap.data().tallies as DualTally;
    // Remove the old ballot entirely (under its stored slices), then re-add
    // the new one under the voter's current slices.
    if (previous !== null) {
      tallies = removeBallot(tallies, previous, prevSlices);
    }
    tallies = applyVote(tallies, null, priority, {
      verified: profile.verified,
      registeredVoter: profile.registeredVoter,
    });

    tx.set(voteRef, {
      uid: profile.uid,
      value: priority,
      verified: profile.verified,
      registeredVoter: profile.registeredVoter,
      createdAt: serverTimestamp(),
    });
    tx.update(concernRef, {
      tallies,
      score: weightedScore(tallies.all, PRIORITY_WEIGHTS),
      scoreVerified: weightedScore(tallies.verified, PRIORITY_WEIGHTS),
    });
  });
}

export async function addComment(
  profile: UserProfile,
  concernId: string,
  body: string
): Promise<void> {
  const concernRef = doc(db, 'concerns', concernId);
  const commentRef = doc(collection(db, 'concerns', concernId, 'comments'));

  await runTransaction(db, async (tx) => {
    const concernSnap = await tx.get(concernRef);
    if (!concernSnap.exists()) throw new Error('Concern not found.');
    tx.set(commentRef, {
      authorUid: profile.uid,
      authorName: profile.displayName,
      authorVerified: profile.verified,
      body: body.trim(),
      createdAt: serverTimestamp(),
    });
    tx.update(concernRef, {
      commentCount: ((concernSnap.data() as Concern).commentCount ?? 0) + 1,
    });
  });
}
