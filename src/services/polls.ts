import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { emptyTally } from '@/lib/tally';
import {
  SCALE5_OPTIONS,
  type Poll,
  type PollOption,
  type PollType,
  type Scope,
  type UserProfile,
  type VoteValue,
} from '@/lib/types';

/** Officials and candidates only (enforced again by security rules). */
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
  if (profile.role !== 'official' && profile.role !== 'candidate') {
    throw new Error('Only officials and candidates can create polls.');
  }

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
 * Cast (or change) a poll vote. Ward-scoped polls are verified-residents-only
 * (also enforced by rules). The client writes only its own ballot - the
 * onPollVoteWrite Cloud Function aggregates the tallies.
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

  await setDoc(doc(db, 'polls', poll.id, 'votes', profile.uid), {
    uid: profile.uid,
    value,
    verified: profile.verified,
    createdAt: serverTimestamp(),
  });
}

export async function closePoll(profile: UserProfile, poll: Poll): Promise<void> {
  if (profile.uid !== poll.authorUid) throw new Error('Only the poll author can close it.');
  await updateDoc(doc(db, 'polls', poll.id), { open: false });
}
