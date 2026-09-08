import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { CommentVoteValue, ElectionQuestion, UserProfile } from '@/lib/types';

/**
 * The election AMA: one question, every candidate on the record. Anyone
 * signed in can ask; any candidate can answer at any time. One answer per
 * candidate per question - the answer doc id IS the candidate's uid, so a
 * second post can only revise the first, and rules pin the id to the
 * writer's auth uid. Posted answers are public record: revisable, never
 * deletable by the candidate (deletion would cascade the ratings away and
 * let a re-post shed its downvotes).
 *
 * Clients only write their own documents. answerCount and the answers'
 * hidden placement scores are aggregated by Cloud Functions triggers.
 */

export async function askElectionQuestion(profile: UserProfile, body: string): Promise<string> {
  const ref = await addDoc(collection(db, 'electionQuestions'), {
    authorUid: profile.uid,
    authorName: profile.displayName,
    authorVerified: profile.verified,
    body: body.trim(),
    answerCount: 0,
    upvotes: 0,
    upvotesVerified: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Join an election question ("I want this answered too") or leave it. One
 * voice per person; the trigger recounts the question's upvote fields, which
 * order the AMA list so the questions people care about lead.
 */
export async function setElectionQuestionUpvote(
  profile: UserProfile,
  questionId: string,
  up: boolean
): Promise<void> {
  const ref = doc(db, 'electionQuestions', questionId, 'votes', profile.uid);
  if (!up) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    uid: profile.uid,
    verified: profile.verified,
    createdAt: serverTimestamp(),
  });
}

/**
 * The asker may withdraw a question only while no candidate has answered -
 * answered questions are part of the candidates' public record.
 */
export async function deleteElectionQuestion(
  profile: UserProfile,
  question: ElectionQuestion
): Promise<void> {
  if (profile.uid !== question.authorUid) {
    throw new Error('Only the asker can withdraw a question.');
  }
  if (question.answerCount > 0) {
    throw new Error('Questions with answers are part of the public record.');
  }
  await deleteDoc(doc(db, 'electionQuestions', question.id));
}

/** Post or revise this candidate's one answer to a question. */
export async function answerElectionQuestion(
  profile: UserProfile,
  questionId: string,
  body: string,
  isRevision: boolean
): Promise<void> {
  if (profile.role !== 'candidate') throw new Error('Only candidates can answer here.');
  await setDoc(
    doc(db, 'electionQuestions', questionId, 'answers', profile.uid),
    {
      candidateUid: profile.uid,
      candidateName: profile.displayName,
      body: body.trim(),
      updatedAt: serverTimestamp(),
      ...(isRevision ? {} : { score: 0, scoreVerified: 0, createdAt: serverTimestamp() }),
    },
    { merge: isRevision }
  );
}

/**
 * Rate an answer up or down (null retracts). Placement-only: the trigger
 * folds ratings into hidden score fields that order the answer list.
 */
export async function voteElectionAnswer(
  profile: UserProfile,
  questionId: string,
  candidateUid: string,
  value: CommentVoteValue | null
): Promise<void> {
  const ref = doc(db, 'electionQuestions', questionId, 'answers', candidateUid, 'votes', profile.uid);
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
