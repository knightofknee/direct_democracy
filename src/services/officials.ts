import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { pct } from '@/lib/format';
import type { ApprovalValue, Official, UserProfile } from '@/lib/types';
import { computeScore, type OfficialScore } from '@/services/ama';

/**
 * The grading system. Two axes, equally weighted:
 *
 *  1. APPROVAL — how well liked. A standing approve/disapprove ballot any
 *     user can set or change at any time, tallied through the usual three
 *     lenses plus a constituents-only slice (verified residents of the
 *     official's own ward; for citywide offices, any verified resident).
 *     The graded number is constituent approval — being liked by people you
 *     don't represent doesn't move your grade.
 *
 *  2. ANSWER SCORE — how well they actually answer their constituency.
 *     Community-judged AMA performance (see computeScore in services/ama.ts):
 *     answered questions earn credit, dodged and ignored ones cost it.
 *
 * Each axis needs a minimum sample before it grades (no F for an official
 * with one grumpy neighbor); until then the axis shows as ungraded and the
 * overall grade rests on whichever axis has data.
 */

export const APPROVAL_MIN_BALLOTS = 5;
/** The answer axis also needs a real sample before it grades. */
export const ANSWERS_MIN_QUESTIONS = 3;

export interface ApprovalRating {
  /** 0–100 approval among constituents, or null below the ballot minimum. */
  constituentPct: number | null;
  constituentBallots: number;
  /** 0–100 approval across all users (shown, never graded). */
  allPct: number | null;
  allBallots: number;
  verifiedPct: number | null;
  verifiedBallots: number;
}

export function computeApproval(official: Official): ApprovalRating {
  const t = official.approvalTallies;
  const c = official.approvalConstituents ?? { approve: 0, disapprove: 0 };
  const constituentBallots = c.approve + c.disapprove;
  const allBallots = t?.totalAll ?? 0;
  const verifiedBallots = t?.totalVerified ?? 0;
  return {
    constituentPct:
      constituentBallots >= APPROVAL_MIN_BALLOTS ? pct(c.approve, constituentBallots) : null,
    constituentBallots,
    allPct: allBallots > 0 ? pct(t?.all['approve'] ?? 0, allBallots) : null,
    allBallots,
    verifiedPct: verifiedBallots > 0 ? pct(t?.verified['approve'] ?? 0, verifiedBallots) : null,
    verifiedBallots,
  };
}

export interface OfficialGrade {
  /** 0–100 blended score, or null when neither axis has data. */
  overall: number | null;
  letter: string;
  approval: ApprovalRating;
  answers: OfficialScore;
  /** False until the answer axis has enough questions to grade fairly. */
  answersGraded: boolean;
}

export function letterFor(score: number | null): string {
  if (score == null) return '—';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function computeGrade(official: Official): OfficialGrade {
  const approval = computeApproval(official);
  const answers = computeScore(official);

  const axes: number[] = [];
  if (approval.constituentPct != null) axes.push(approval.constituentPct);
  // One ignored question shouldn't tank a grade — the axis needs a sample.
  const answersGraded = answers.score != null && answers.asked >= ANSWERS_MIN_QUESTIONS;
  if (answersGraded && answers.score != null) axes.push(answers.score);
  const overall = axes.length
    ? Math.round(axes.reduce((a, b) => a + b, 0) / axes.length)
    : null;

  return { overall, letter: letterFor(overall), approval, answers, answersGraded };
}

/** Set or change a standing approval ballot. */
export async function setApproval(
  profile: UserProfile,
  officialUid: string,
  value: ApprovalValue
): Promise<void> {
  if (profile.uid === officialUid) throw new Error('Officials cannot rate themselves.');
  await setDoc(doc(db, 'officials', officialUid, 'approvals', profile.uid), {
    value,
    verified: profile.verified,
    registeredVoter: profile.registeredVoter,
    wardId: profile.wardId,
    createdAt: serverTimestamp(),
  });
}

/** Withdraw an approval ballot entirely. */
export async function clearApproval(profile: UserProfile, officialUid: string): Promise<void> {
  await deleteDoc(doc(db, 'officials', officialUid, 'approvals', profile.uid));
}

/**
 * Officials update their own public card. The portrait is a link to an image
 * hosted elsewhere (https only) — direct democracy never stores the file.
 */
export async function updateOfficialCard(
  profile: UserProfile,
  input: { bio: string; photoUrl: string }
): Promise<void> {
  if (profile.role !== 'official') throw new Error('Only officials can edit an official card.');
  const photoUrl = input.photoUrl.trim();
  if (photoUrl && !photoUrl.startsWith('https://')) {
    throw new Error('Photo link must be an https:// URL.');
  }
  await updateDoc(doc(db, 'officials', profile.uid), {
    bio: input.bio.trim(),
    photoUrl: photoUrl || null,
  });
}
