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
import type { AmaQuestion, QuestionStatus, UserProfile } from '@/lib/types';

/**
 * AMAs are ongoing, per-official. Anyone signed in can ask. The official
 * posts one response per question; the community then judges whether it
 * actually answered the question. There is no upvoting or downvoting a
 * politician's response - only "did this answer it?" - and dodging (or
 * ignoring) questions drags the official's score down.
 *
 * Clients only write their own documents here. All counters (questionsAsked,
 * questionsResponded, answered/dodged, judgment totals, status flips) are
 * aggregated by Cloud Functions triggers.
 */

export async function askQuestion(
  profile: UserProfile,
  officialUid: string,
  body: string
): Promise<void> {
  await addDoc(collection(db, 'officials', officialUid, 'questions'), {
    officialUid,
    authorUid: profile.uid,
    authorName: profile.displayName,
    authorVerified: profile.verified,
    body: body.trim(),
    status: 'awaitingResponse' satisfies QuestionStatus,
    response: null,
    respondedAt: null,
    answeredYes: 0,
    answeredNo: 0,
    answeredYesVerified: 0,
    answeredNoVerified: 0,
    createdAt: serverTimestamp(),
  });
}

/**
 * The asker may withdraw a question only while it's unanswered - an answered
 * (or dodged) question is part of the official's public record.
 */
export async function deleteQuestion(profile: UserProfile, question: AmaQuestion): Promise<void> {
  if (profile.uid !== question.authorUid) throw new Error('Only the asker can withdraw a question.');
  if (question.status !== 'awaitingResponse') {
    throw new Error('Questions with a response are part of the public record.');
  }
  await deleteDoc(doc(db, 'officials', question.officialUid, 'questions', question.id));
}

/** The official (only) posts a response; the question moves to community review. */
export async function respondToQuestion(
  profile: UserProfile,
  question: AmaQuestion,
  response: string
): Promise<void> {
  if (profile.uid !== question.officialUid) {
    throw new Error('Only the official can respond to their AMA questions.');
  }
  if (question.response) throw new Error('This question already has a response.');
  await updateDoc(doc(db, 'officials', question.officialUid, 'questions', question.id), {
    response: response.trim(),
    respondedAt: serverTimestamp(),
    status: 'underReview' satisfies QuestionStatus,
  });
}

/**
 * Community judgment on a response: did it answer the question? One judgment
 * per user, changeable. The onJudgmentWrite trigger recomputes the counts,
 * flips the question's status at quorum, and moves the official's counters.
 */
export async function judgeResponse(
  profile: UserProfile,
  question: AmaQuestion,
  answered: boolean
): Promise<void> {
  if (profile.uid === question.officialUid) {
    throw new Error('Officials cannot judge their own responses.');
  }
  if (!question.response) throw new Error('No response to judge yet.');
  await setDoc(
    doc(db, 'officials', question.officialUid, 'questions', question.id, 'judgments', profile.uid),
    { answered, verified: profile.verified, createdAt: serverTimestamp() }
  );
}

export interface OfficialScore {
  /** 0–100, or null when there's nothing to grade yet. */
  score: number | null;
  grade: string;
  responded: number;
  /** Every response counts as answered until the community judges it a dodge. */
  answered: number;
  dodged: number;
  ignored: number;
  /** Unanswered questions still inside the grace week - not yet ignored. */
  pending: number;
  asked: number;
}

/**
 * Letter bands for every 0-100 score in the app. Graded on a politician's
 * curve, not a classroom's: majority approval or answering most questions is
 * strong performance in the real world, so the bands sit well below the
 * school scale (where 2 of 3 questions answered would read as a D).
 */
export function letterFor(score: number | null): string {
  if (score == null) return '-';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

/**
 * The accountability score. A response is answered until the community
 * judges it a dodge; dodges and silence earn nothing. `pending` (unanswered
 * questions still inside the grace week, per the official doc's
 * trigger-written questionsPending counter) is held out entirely: it neither
 * counts as ignored nor drags the score.
 */
export function computeScore(
  o: {
    questionsAsked: number;
    questionsResponded: number;
    questionsAnswered: number;
    questionsDodged: number;
  },
  pending = 0
): OfficialScore {
  const asked = o.questionsAsked ?? 0;
  const responded = o.questionsResponded ?? 0;
  const dodged = o.questionsDodged ?? 0;
  const answered = Math.max(0, responded - dodged);
  const held = Math.min(Math.max(0, pending), Math.max(0, asked - responded));
  const ignored = Math.max(0, asked - responded - held);
  const graded = asked - held;

  if (graded <= 0) {
    return { score: null, grade: '-', responded, answered, dodged, ignored, pending: held, asked };
  }

  const score = Math.round((answered / graded) * 100);
  return { score, grade: letterFor(score), responded, answered, dodged, ignored, pending: held, asked };
}
