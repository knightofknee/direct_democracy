import * as crypto from 'crypto';

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';

import {
  ANSWER_JUDGMENT_QUORUM,
  PRIORITY_WEIGHTS,
  addBallot,
  removeBallot,
  weightedScore,
  type DualTally,
  type VoterSlices,
  type VoteValue,
} from './tally';

initializeApp();
const db = getFirestore();

const WARD_MIN = 1;
const WARD_MAX = 50;

/**
 * The only identity data direct democracy ever stores. Persona (the
 * third-party verifier) sees the documents; we see the verdict.
 */
interface VerificationResult {
  verified: true;
  wardId: number;
  registeredVoter: boolean;
}

async function applyVerification(uid: string, result: VerificationResult): Promise<void> {
  await db.doc(`users/${uid}`).update({
    verified: result.verified,
    wardId: result.wardId,
    registeredVoter: result.registeredVoter,
  });
}

// ── Tally aggregation ───────────────────────────────────────────────────
// Clients may only write their own ballot/judgment/comment documents; every
// aggregate number in the app is computed here, so no client can inflate a
// tally. Each trigger diffs the before/after of one person's document and
// applies that delta to the parent in a transaction.

interface BallotDoc {
  value: VoteValue;
  verified: boolean;
  registeredVoter: boolean;
}

function slicesOf(ballot: BallotDoc): VoterSlices {
  return { verified: !!ballot.verified, registeredVoter: !!ballot.registeredVoter };
}

/** Bump a personal participation counter (celebration milestones read these). */
async function bumpStat(uid: string, stat: 'concerns' | 'comments' | 'votes' | 'judgments') {
  await db
    .doc(`users/${uid}`)
    .update({ [`stats.${stat}`]: FieldValue.increment(1) })
    .catch(() => {}); // user doc may be gone (account deletion) — never fail the trigger
}

export const onConcernCreated = onDocumentCreated('concerns/{concernId}', async (event) => {
  const authorUid = event.data?.data()?.authorUid;
  if (authorUid) await bumpStat(authorUid, 'concerns');
});

export const onConcernVoteWrite = onDocumentWritten(
  'concerns/{concernId}/votes/{voterUid}',
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null;
    const after = event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null;
    const concernRef = db.doc(`concerns/${event.params.concernId}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(concernRef);
      if (!snap.exists) return;
      let tallies = snap.data()!.tallies as DualTally;
      if (before) tallies = removeBallot(tallies, before.value, slicesOf(before));
      if (after) tallies = addBallot(tallies, after.value, slicesOf(after));
      tx.update(concernRef, {
        tallies,
        score: weightedScore(tallies.all, PRIORITY_WEIGHTS),
        scoreVerified: weightedScore(tallies.verified, PRIORITY_WEIGHTS),
      });
    });

    // A brand-new ballot (not a changed one) counts toward vote milestones.
    if (!before && after) await bumpStat(event.params.voterUid, 'votes');
  }
);

export const onPollVoteWrite = onDocumentWritten(
  'polls/{pollId}/votes/{voterUid}',
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null;
    const after = event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null;
    const pollRef = db.doc(`polls/${event.params.pollId}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(pollRef);
      if (!snap.exists) return;
      let tallies = snap.data()!.tallies as DualTally;
      if (before) tallies = removeBallot(tallies, before.value, slicesOf(before));
      if (after) tallies = addBallot(tallies, after.value, slicesOf(after));
      tx.update(pollRef, { tallies });
    });

    if (!before && after) await bumpStat(event.params.voterUid, 'votes');
  }
);

export const onCommentCreated = onDocumentCreated(
  'concerns/{concernId}/comments/{commentId}',
  async (event) => {
    await db
      .doc(`concerns/${event.params.concernId}`)
      .update({ commentCount: FieldValue.increment(1) });
    const authorUid = event.data?.data()?.authorUid;
    if (authorUid) await bumpStat(authorUid, 'comments');
  }
);

/**
 * Approval ballots — the "how well liked" axis of an official's grade.
 * Aggregates the standard three-lens tally plus a constituents-only count
 * (ballots from verified residents of the official's own ward; for citywide
 * offices every verified resident is a constituent).
 */
export const onApprovalWrite = onDocumentWritten(
  'officials/{officialUid}/approvals/{voterUid}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const officialRef = db.doc(`officials/${event.params.officialUid}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(officialRef);
      if (!snap.exists) return;
      const official = snap.data()!;
      let tallies = (official.approvalTallies as DualTally) ?? {
        all: {},
        verified: {},
        registered: {},
        totalAll: 0,
        totalVerified: 0,
        totalRegistered: 0,
      };
      const constituents = { ...(official.approvalConstituents ?? { approve: 0, disapprove: 0 }) };

      const isConstituent = (ballot: FirebaseFirestore.DocumentData) =>
        !!ballot.verified && (official.wardId == null || ballot.wardId === official.wardId);
      const constKey = (v: string) => (v === 'approve' ? 'approve' : 'disapprove') as
        | 'approve'
        | 'disapprove';

      if (before) {
        tallies = removeBallot(tallies, before.value as VoteValue, slicesOf(before as BallotDoc));
        if (isConstituent(before)) {
          constituents[constKey(before.value)] = Math.max(0, constituents[constKey(before.value)] - 1);
        }
      }
      if (after) {
        tallies = addBallot(tallies, after.value as VoteValue, slicesOf(after as BallotDoc));
        if (isConstituent(after)) {
          constituents[constKey(after.value)] += 1;
        }
      }

      tx.update(officialRef, { approvalTallies: tallies, approvalConstituents: constituents });
    });
  }
);

export const onQuestionCreated = onDocumentCreated(
  'officials/{officialUid}/questions/{questionId}',
  async (event) => {
    await db
      .doc(`officials/${event.params.officialUid}`)
      .update({ questionsAsked: FieldValue.increment(1) });
  }
);

/** The official posting their response moves questionsResponded. */
export const onQuestionResponded = onDocumentWritten(
  'officials/{officialUid}/questions/{questionId}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (!after || before?.response || !after.response) return;
    await db
      .doc(`officials/${event.params.officialUid}`)
      .update({ questionsResponded: FieldValue.increment(1) });
  }
);

/**
 * Community judgment ("did this answer it?") aggregation: recompute the
 * question's yes/no counts and status, and keep the official's
 * answered/dodged counters in step with status flips.
 */
export const onJudgmentWrite = onDocumentWritten(
  'officials/{officialUid}/questions/{questionId}/judgments/{judgeUid}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const questionRef = db.doc(
      `officials/${event.params.officialUid}/questions/${event.params.questionId}`
    );
    const officialRef = db.doc(`officials/${event.params.officialUid}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(questionRef);
      if (!snap.exists) return;
      const q = snap.data()!;

      let yes = q.answeredYes ?? 0;
      let no = q.answeredNo ?? 0;
      if (before) before.answered ? (yes -= 1) : (no -= 1);
      if (after) after.answered ? (yes += 1) : (no += 1);
      yes = Math.max(0, yes);
      no = Math.max(0, no);

      const prevStatus = q.status as string;
      const nextStatus = !q.response
        ? prevStatus
        : yes + no >= ANSWER_JUDGMENT_QUORUM
          ? yes > no
            ? 'answered'
            : 'dodged'
          : 'underReview';

      tx.update(questionRef, { answeredYes: yes, answeredNo: no, status: nextStatus });

      if (prevStatus !== nextStatus) {
        const delta: Record<string, FirebaseFirestore.FieldValue> = {};
        if (prevStatus === 'answered') delta.questionsAnswered = FieldValue.increment(-1);
        if (prevStatus === 'dodged') delta.questionsDodged = FieldValue.increment(-1);
        if (nextStatus === 'answered') delta.questionsAnswered = FieldValue.increment(1);
        if (nextStatus === 'dodged') delta.questionsDodged = FieldValue.increment(1);
        if (Object.keys(delta).length) tx.update(officialRef, delta);
      }
    });

    if (!before && after) await bumpStat(event.params.judgeUid, 'judgments');
  }
);

/**
 * DEV ONLY — simulates a passing Persona inquiry when running against the
 * Emulator Suite. Never deployed behavior: throws outside the emulator.
 */
export const devVerify = onCall(async (request) => {
  if (!process.env.FUNCTIONS_EMULATOR) {
    throw new HttpsError('failed-precondition', 'devVerify is emulator-only.');
  }
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  const wardId = Number(request.data?.wardId);
  if (!Number.isInteger(wardId) || wardId < WARD_MIN || wardId > WARD_MAX) {
    throw new HttpsError('invalid-argument', `wardId must be ${WARD_MIN}–${WARD_MAX}.`);
  }
  await applyVerification(request.auth.uid, {
    verified: true,
    wardId,
    registeredVoter: !!request.data?.registeredVoter,
  });
  return { ok: true };
});

/**
 * Returns a hosted Persona inquiry URL for the signed-in user. The user's uid
 * rides along as reference-id so the webhook can match the result back.
 *
 * Required environment configuration (set as function secrets/params):
 *   PERSONA_TEMPLATE_ID    — inquiry template (govt ID + address collection)
 *   PERSONA_ENVIRONMENT_ID — Persona environment
 */
export const createVerificationSession = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  const templateId = process.env.PERSONA_TEMPLATE_ID;
  const environmentId = process.env.PERSONA_ENVIRONMENT_ID;
  if (!templateId || !environmentId) {
    throw new HttpsError('failed-precondition', 'Persona is not configured yet.');
  }
  const url =
    `https://withpersona.com/verify` +
    `?inquiry-template-id=${encodeURIComponent(templateId)}` +
    `&environment-id=${encodeURIComponent(environmentId)}` +
    `&reference-id=${encodeURIComponent(request.auth.uid)}`;
  return { inquiryUrl: url };
});

/**
 * Persona webhook — the only writer of `verified` in production.
 *
 * Configure in Persona: event `inquiry.completed`, pointed at this function's
 * URL, with a shared secret stored as PERSONA_WEBHOOK_SECRET.
 *
 * Ward derivation: the inquiry template should attach the resident's ward as
 * a custom field (`ward_id`), e.g. via an address-to-ward lookup step. Until
 * that lookup exists, inquiries without a ward are recorded as verified with
 * no ward (city-level verified, no ward tab).
 */
export const personaWebhook = onRequest(async (req, res) => {
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).send('Webhook secret not configured.');
    return;
  }

  // Persona signs webhooks: Persona-Signature: t=<ts>,v1=<hmac>
  const signature = req.header('Persona-Signature') ?? '';
  const parts = Object.fromEntries(
    signature.split(',').map((kv) => kv.trim().split('=') as [string, string])
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) {
    res.status(400).send('Missing signature.');
    return;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${req.rawBody.toString()}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(v1);
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    res.status(401).send('Bad signature.');
    return;
  }

  const payload = req.body?.data;
  const eventName = payload?.attributes?.name;
  if (eventName !== 'inquiry.completed') {
    res.status(200).send('Ignored.');
    return;
  }

  const inquiry = payload?.attributes?.payload?.data;
  const status = inquiry?.attributes?.status;
  const uid = inquiry?.attributes?.['reference-id'];
  if (!uid || status !== 'completed') {
    res.status(200).send('Not a completed inquiry.');
    return;
  }

  const fields = inquiry?.attributes?.fields ?? {};
  const wardRaw = Number(fields['ward_id']?.value);
  const wardId = Number.isInteger(wardRaw) && wardRaw >= WARD_MIN && wardRaw <= WARD_MAX ? wardRaw : null;
  const registeredVoter = fields['registered_voter']?.value === true;

  await db.doc(`users/${uid}`).update({
    verified: true,
    wardId,
    registeredVoter,
  });

  res.status(200).send('OK');
});
