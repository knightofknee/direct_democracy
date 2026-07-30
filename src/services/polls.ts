import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { applyVote, emptyTally, removeBallot } from '@/lib/tally';
import {
  SCALE5_OPTIONS,
  type DualTally,
  type Poll,
  type PollOption,
  type PollType,
  type Scope,
  type UserProfile,
  type VoteValue,
} from '@/lib/types';

/** Officials only (enforced again by security rules). */
export async function createPoll(
  profile: UserProfile,
  input: {
    question: string;
    detail: string;
    type: PollType;
    options: PollOption[]; // ignored for yesNo / scale5
    scope: Scope;
    wardId: number | null;
  }
): Promise<string> {
  if (profile.role !== 'official') throw new Error('Only officials can create polls.');

  const options: PollOption[] =
    input.type === 'yesNo'
      ? [
          { key: 'yes', label: 'Yes' },
          { key: 'no', label: 'No' },
        ]
      : input.type === 'scale5'
        ? SCALE5_OPTIONS.map((o) => ({ key: o.key, label: o.label }))
        : input.options;

  if (options.length < 2) throw new Error('A poll needs at least two options.');

  const ref = await addDoc(collection(db, 'polls'), {
    question: input.question.trim(),
    detail: input.detail.trim(),
    type: input.type,
    options,
    scope: input.scope,
    wardId: input.scope === 'ward' ? input.wardId : null,
    authorUid: profile.uid,
    authorName: profile.displayName,
    open: true,
    tallies: emptyTally(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Cast (or change) a poll vote. Ward-scoped polls are verified-residents-only;
 * citywide polls accept everyone, with the verified slice shown alongside.
 */
export async function votePoll(
  profile: UserProfile,
  poll: Poll,
  value: VoteValue
): Promise<void> {
  if (!poll.open) throw new Error('This poll is closed.');
  if (poll.scope === 'ward') {
    if (!profile.verified) throw new Error('Verify your identity to vote on ward polls.');
    if (profile.wardId !== poll.wardId) throw new Error('This poll is for residents of its ward.');
  }
  const valid = new Set(poll.options.map((o) => o.key));
  for (const key of Array.isArray(value) ? value : [value]) {
    if (!valid.has(key)) throw new Error('Invalid option.');
  }
  if (Array.isArray(value) && value.length === 0) throw new Error('Select at least one option.');

  const pollRef = doc(db, 'polls', poll.id);
  const voteRef = doc(db, 'polls', poll.id, 'votes', profile.uid);

  await runTransaction(db, async (tx) => {
    const [pollSnap, voteSnap] = await Promise.all([tx.get(pollRef), tx.get(voteRef)]);
    if (!pollSnap.exists()) throw new Error('Poll not found.');

    let tallies = pollSnap.data().tallies as DualTally;
    const prev = voteSnap.exists() ? (voteSnap.data().value as VoteValue) : null;
    const prevSlices = voteSnap.exists()
      ? { verified: !!voteSnap.data().verified, registeredVoter: !!voteSnap.data().registeredVoter }
      : null;

    if (prev !== null && prevSlices) {
      tallies = removeBallot(tallies, prev, prevSlices);
    }
    tallies = applyVote(tallies, null, value, {
      verified: profile.verified,
      registeredVoter: profile.registeredVoter,
    });

    tx.set(voteRef, {
      uid: profile.uid,
      value,
      verified: profile.verified,
      registeredVoter: profile.registeredVoter,
      createdAt: serverTimestamp(),
    });
    tx.update(pollRef, { tallies });
  });
}

export async function closePoll(profile: UserProfile, poll: Poll): Promise<void> {
  if (profile.uid !== poll.authorUid) throw new Error('Only the poll author can close it.');
  const pollRef = doc(db, 'polls', poll.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(pollRef);
    if (!snap.exists()) throw new Error('Poll not found.');
    tx.update(pollRef, { open: false });
  });
}
