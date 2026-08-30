import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/lib/firebase';
import { emptyTally } from '@/lib/tally';
import { cleanReferences } from '@/services/concerns';
import {
  POLICY_STANCES,
  type CommentReply,
  type CommentVoteValue,
  type Policy,
  type PolicyLink,
  type PolicyStance,
  type UserProfile,
} from '@/lib/types';

/**
 * The more perfect platform, client-side. Candidates write their own card and
 * their in-app policies; everyone writes only their own ballot/comment docs.
 * Synced policies (source 'site') are written by the platform-sync Cloud
 * Function until the candidate edits one here - editing takes it over
 * (source flips to 'app') and the site stops updating it. Tallies and
 * counters stay trigger-only (rules enforce all of this).
 */

/** Candidates update their own public card. */
export async function updateCandidateCard(
  profile: UserProfile,
  input: { bio: string; photoUrl: string; websiteUrl: string }
): Promise<void> {
  if (profile.role !== 'candidate') throw new Error('Only candidates can edit a candidate card.');
  const photoUrl = input.photoUrl.trim();
  const websiteUrl = input.websiteUrl.trim();
  if (photoUrl && !photoUrl.startsWith('https://')) {
    throw new Error('Photo link must be an https:// URL.');
  }
  if (websiteUrl && !websiteUrl.startsWith('https://')) {
    throw new Error('Website link must be an https:// URL.');
  }
  await updateDoc(doc(db, 'candidates', profile.uid), {
    bio: input.bio.trim(),
    photoUrl: photoUrl || null,
    websiteUrl: websiteUrl || null,
  });
}

/** Add an in-app policy to the candidate's own platform. */
export async function createPolicy(
  profile: UserProfile,
  input: { section: string; title: string; body: string; links: PolicyLink[]; order: number }
): Promise<string> {
  if (profile.role !== 'candidate') throw new Error('Only candidates can add policies.');
  const ref = await addDoc(collection(db, 'candidates', profile.uid, 'policies'), {
    candidateUid: profile.uid,
    section: input.section.trim(),
    title: input.title.trim(),
    body: input.body.trim(),
    links: input.links,
    order: input.order,
    source: 'app',
    archived: false,
    tallies: emptyTally(),
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Edit a policy. Editing a synced policy takes it over: source flips to
 * 'app', the "imported" label disappears, and the nightly site sync leaves
 * it alone from then on (votes and comments carry through untouched).
 */
export async function updatePolicy(
  profile: UserProfile,
  policy: Policy,
  input: { section: string; title: string; body: string; links: PolicyLink[] }
): Promise<void> {
  if (profile.uid !== policy.candidateUid) throw new Error('Only the candidate can edit a policy.');
  await updateDoc(doc(db, 'candidates', policy.candidateUid, 'policies', policy.id), {
    section: input.section.trim(),
    title: input.title.trim(),
    body: input.body.trim(),
    links: input.links,
    source: 'app',
    updatedAt: serverTimestamp(),
  });
}

/** Hide or restore an in-app policy without losing its votes and comments. */
export async function setPolicyArchived(
  profile: UserProfile,
  policy: Policy,
  archived: boolean
): Promise<void> {
  if (profile.uid !== policy.candidateUid) throw new Error('Only the candidate can edit a policy.');
  if (policy.source !== 'app') {
    throw new Error('This policy still syncs from the campaign site - edit it first to take it over.');
  }
  await updateDoc(doc(db, 'candidates', policy.candidateUid, 'policies', policy.id), {
    archived,
    updatedAt: serverTimestamp(),
  });
}

/** Withdraw an in-app policy; the onPolicyWrite trigger cleans up. */
export async function deletePolicy(profile: UserProfile, policy: Policy): Promise<void> {
  if (profile.uid !== policy.candidateUid) {
    throw new Error('Only the candidate can delete a policy.');
  }
  if (policy.source !== 'app') {
    throw new Error('This policy still syncs from the campaign site - edit it first to take it over.');
  }
  await deleteDoc(doc(db, 'candidates', policy.candidateUid, 'policies', policy.id));
}

/**
 * Cast (or change) a stance on a policy. The client writes only its own
 * ballot document - onPolicyVoteWrite aggregates the dual tally.
 */
export async function votePolicy(
  profile: UserProfile,
  candidateUid: string,
  policyId: string,
  stance: PolicyStance
): Promise<void> {
  if (!POLICY_STANCES.includes(stance)) throw new Error('Invalid stance.');
  await setDoc(doc(db, 'candidates', candidateUid, 'policies', policyId, 'votes', profile.uid), {
    uid: profile.uid,
    value: stance,
    verified: profile.verified,
    wardId: profile.wardId,
    createdAt: serverTimestamp(),
  });
}

/** Comment counts are maintained by the onPolicyCommentCreated trigger. */
export async function addPolicyComment(
  profile: UserProfile,
  candidateUid: string,
  policyId: string,
  body: string,
  reply?: CommentReply | null,
  references?: string[]
): Promise<void> {
  await addDoc(collection(db, 'candidates', candidateUid, 'policies', policyId, 'comments'), {
    authorUid: profile.uid,
    authorName: profile.displayName,
    authorVerified: profile.verified,
    body: body.trim(),
    references: cleanReferences(references ?? []),
    threadId: reply?.threadId ?? null,
    replyToName: reply?.replyToName ?? null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Award (or retract) a writing credit: the candidate's public acknowledgment
 * that this comment changed their policy. Recognition only - the author's
 * lifetime count is aggregated by the onPolicyCommentCredited trigger.
 */
export async function setCommentCredit(
  profile: UserProfile,
  candidateUid: string,
  policyId: string,
  comment: { id: string; authorUid: string },
  credited: boolean
): Promise<void> {
  if (profile.uid !== candidateUid) {
    throw new Error('Only the candidate can award writing credits on their platform.');
  }
  if (comment.authorUid === candidateUid) {
    throw new Error('You cannot credit your own comment.');
  }
  await updateDoc(
    doc(db, 'candidates', candidateUid, 'policies', policyId, 'comments', comment.id),
    { credited, creditedAt: serverTimestamp() }
  );
}

/**
 * Rate a policy comment up or down (null retracts). Placement-only: the
 * trigger folds ballots into the comment's hidden ordering score.
 */
export async function voteOnPolicyComment(
  profile: UserProfile,
  candidateUid: string,
  policyId: string,
  commentId: string,
  value: CommentVoteValue | null
): Promise<void> {
  const ref = doc(
    db,
    'candidates',
    candidateUid,
    'policies',
    policyId,
    'comments',
    commentId,
    'votes',
    profile.uid
  );
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

/** Remove one of your own comments; onPolicyCommentDeleted keeps the count honest. */
export async function deletePolicyComment(
  profile: UserProfile,
  candidateUid: string,
  policyId: string,
  comment: { id: string; authorUid: string }
): Promise<void> {
  if (profile.uid !== comment.authorUid) throw new Error('Only the author can delete a comment.');
  await deleteDoc(
    doc(db, 'candidates', candidateUid, 'policies', policyId, 'comments', comment.id)
  );
}

/**
 * Ask the server to re-scrape the caller's campaign site right now (the
 * nightly job does the same automatically).
 */
export async function syncMyPlatform(): Promise<{ synced: number; archived: number }> {
  const call = httpsCallable<Record<string, never>, { synced: number; archived: number }>(
    functions,
    'syncMyPlatform'
  );
  const result = await call({});
  return result.data;
}
