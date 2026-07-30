import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  ANSWER_JUDGMENT_QUORUM,
  type AmaQuestion,
  type QuestionStatus,
  type UserProfile,
} from '@/lib/types';

/**
 * AMAs are ongoing, per-official. Anyone signed in can ask. The official
 * posts one response per question; the community then judges whether it
 * actually answered the question. There is no upvoting or downvoting a
 * politician's response — only "did this answer it?" — and dodging (or
 * ignoring) questions drags the official's score down.
 */

export async function askQuestion(
  profile: UserProfile,
  officialUid: string,
  body: string
): Promise<void> {
  const officialRef = doc(db, 'officials', officialUid);
  const questionRef = doc(collection(db, 'officials', officialUid, 'questions'));

  await runTransaction(db, async (tx) => {
    const officialSnap = await tx.get(officialRef);
    if (!officialSnap.exists()) throw new Error('Official not found.');
    tx.set(questionRef, {
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
      createdAt: serverTimestamp(),
    });
    tx.update(officialRef, { questionsAsked: increment(1) });
  });
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
  const officialRef = doc(db, 'officials', question.officialUid);
  const questionRef = doc(db, 'officials', question.officialUid, 'questions', question.id);

  await runTransaction(db, async (tx) => {
    const qSnap = await tx.get(questionRef);
    if (!qSnap.exists()) throw new Error('Question not found.');
    if (qSnap.data().response) throw new Error('This question already has a response.');
    tx.update(questionRef, {
      response: response.trim(),
      respondedAt: serverTimestamp(),
      status: 'underReview' satisfies QuestionStatus,
    });
    tx.update(officialRef, { questionsResponded: increment(1) });
  });
}

/**
 * Community judgment on a response: did it answer the question? One judgment
 * per user, changeable. Once a quorum is reached, the question's status (and
 * the official's answered/dodged counters) follow the majority.
 */
export async function judgeResponse(
  profile: UserProfile,
  question: AmaQuestion,
  answered: boolean
): Promise<void> {
  if (profile.uid === question.officialUid) {
    throw new Error('Officials cannot judge their own responses.');
  }
  const officialRef = doc(db, 'officials', question.officialUid);
  const questionRef = doc(db, 'officials', question.officialUid, 'questions', question.id);
  const judgmentRef = doc(
    db, 'officials', question.officialUid, 'questions', question.id, 'judgments', profile.uid
  );

  await runTransaction(db, async (tx) => {
    const [qSnap, jSnap] = await Promise.all([tx.get(questionRef), tx.get(judgmentRef)]);
    if (!qSnap.exists()) throw new Error('Question not found.');
    const q = qSnap.data() as AmaQuestion;
    if (!q.response) throw new Error('No response to judge yet.');

    let yes = q.answeredYes;
    let no = q.answeredNo;
    const prev = jSnap.exists() ? (jSnap.data().answered as boolean) : null;
    if (prev === answered) return; // unchanged
    if (prev === true) yes -= 1;
    if (prev === false) no -= 1;
    if (answered) yes += 1;
    else no += 1;

    const prevStatus = q.status;
    const nextStatus: QuestionStatus =
      yes + no >= ANSWER_JUDGMENT_QUORUM ? (yes > no ? 'answered' : 'dodged') : 'underReview';

    tx.set(judgmentRef, { answered, createdAt: serverTimestamp() });
    tx.update(questionRef, { answeredYes: yes, answeredNo: no, status: nextStatus });

    // Keep the official's community-judged counters in sync with status flips.
    if (prevStatus !== nextStatus) {
      const delta: Record<string, ReturnType<typeof increment>> = {};
      if (prevStatus === 'answered') delta.questionsAnswered = increment(-1);
      if (prevStatus === 'dodged') delta.questionsDodged = increment(-1);
      if (nextStatus === 'answered') delta.questionsAnswered = increment(1);
      if (nextStatus === 'dodged') delta.questionsDodged = increment(1);
      if (Object.keys(delta).length) tx.update(officialRef, delta);
    }
  });
}

export interface OfficialScore {
  /** 0–100, or null when there's nothing to grade yet. */
  score: number | null;
  grade: string;
  responded: number;
  answered: number;
  dodged: number;
  ignored: number;
  asked: number;
}

/**
 * The accountability score. Answered questions earn full credit, a response
 * the community hasn't judged yet earns half, dodges and silence earn nothing.
 */
export function computeScore(o: {
  questionsAsked: number;
  questionsResponded: number;
  questionsAnswered: number;
  questionsDodged: number;
}): OfficialScore {
  const asked = o.questionsAsked ?? 0;
  const responded = o.questionsResponded ?? 0;
  const answered = o.questionsAnswered ?? 0;
  const dodged = o.questionsDodged ?? 0;
  const ignored = Math.max(0, asked - responded);
  const underReview = Math.max(0, responded - answered - dodged);

  if (asked === 0) return { score: null, grade: '—', responded, answered, dodged, ignored, asked };

  const score = Math.round(((answered + underReview * 0.5) / asked) * 100);
  const grade =
    score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return { score, grade, responded, answered, dodged, ignored, asked };
}
