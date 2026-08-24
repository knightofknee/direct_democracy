import * as crypto from 'crypto';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

import { parsePlatformHtml } from './platform';
import {
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
 * App Check enforcement for callables. The console's "Enforce" toggle only
 * covers Firestore/RTDB/Storage; callable functions enforce here in code.
 * Skipped in the emulator, where no attestation exists.
 */
const APP_CHECK = { enforceAppCheck: !process.env.FUNCTIONS_EMULATOR };

// Didit secrets must be BOUND to the functions that use them - v2 functions
// only receive declared secrets. Set via `firebase functions:secrets:set`.
const DIDIT_API_KEY = defineSecret('DIDIT_API_KEY');
const DIDIT_WORKFLOW_ID = defineSecret('DIDIT_WORKFLOW_ID');
const DIDIT_WEBHOOK_SECRET = defineSecret('DIDIT_WEBHOOK_SECRET');

// Cost guardrail: Didit bills per module that runs in a session (Approved and
// Declined both bill; a session whose link is never opened bills nothing), and
// the first 500 checks each calendar month are free. Until users are charged
// for verification, cap monthly spend by reserving a slot per session start
// and giving the slot back if the session expires unopened. Usage lives in
// `verificationUsage/{YYYY-MM}` with per-session reservations in
// `verificationSessions/{sessionId}` - no security rule matches either path,
// so only the Admin SDK can touch them. The ledger keeps the free-tier line
// so a future paid tier can start charging at check 501 instead of capping.
const VERIFICATION_FREE_TIER = 500;
const VERIFICATION_MONTHLY_CAP = 700;

/** Current month key in Chicago time, e.g. "2026-08". */
function verificationMonthKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).slice(0, 7);
}

/**
 * Settle a session's reserved slot in the monthly ledger, exactly once per
 * session (webhook deliveries can repeat). Expired sessions were never
 * opened, so nothing billed and the slot is returned; Approved, Declined,
 * and Abandoned sessions all ran billable modules and keep their slot.
 */
async function settleVerificationSlot(sessionId: string, status: string): Promise<void> {
  const sessionRef = db.doc(`verificationSessions/${sessionId}`);
  await db
    .runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists || snap.data()!.settled) return;
      const monthRef = db.doc(`verificationUsage/${snap.data()!.monthKey}`);
      tx.update(sessionRef, { settled: true, finalStatus: status });
      const counters: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (status === 'Expired') {
        counters.sessions = FieldValue.increment(-1);
        counters.expired = FieldValue.increment(1);
      } else if (status === 'Approved') {
        counters.approved = FieldValue.increment(1);
      } else if (status === 'Declined') {
        counters.declined = FieldValue.increment(1);
      } else {
        counters.abandoned = FieldValue.increment(1);
      }
      tx.set(monthRef, counters, { merge: true });
    })
    .catch((err) => console.error(`Failed to settle verification slot ${sessionId}:`, err));
}

/**
 * The only identity data direct democracy ever stores. Didit (the
 * third-party verifier) sees the documents; we see the verdict.
 */
interface VerificationResult {
  verified: true;
  wardId: number;
}

async function applyVerification(uid: string, result: VerificationResult): Promise<void> {
  await db.doc(`users/${uid}`).update({
    verified: result.verified,
    wardId: result.wardId,
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
  /** Voter's ward at cast time; scopes ward-item slices to residents. */
  wardId?: number | null;
}

function slicesOf(ballot: BallotDoc): VoterSlices {
  return { verified: !!ballot.verified };
}

/**
 * Slices for an item that belongs to an area. On ward-scoped items the
 * verified slice counts only residents of that ward; "verified" always means
 * "verified for this item's area". Citywide items count every verified user.
 */
function areaSlicesOf(
  ballot: BallotDoc,
  item: { scope?: string; wardId?: number | null }
): VoterSlices {
  const inArea = item.scope !== 'ward' || ballot.wardId === item.wardId;
  return { verified: !!ballot.verified && inArea };
}

type StatKey = 'concerns' | 'comments' | 'votes' | 'judgments' | 'credits';

/**
 * Exactly-once delivery.
 *
 * Firestore can redeliver a trigger event (retries, at-least-once delivery),
 * and every counter below applies a before/after delta rather than
 * recomputing - so a redelivery would double-count a vote, a comment, or a
 * question. Each event id is claimed inside the same transaction that writes
 * its delta, so the delta lands exactly once however many times the event
 * arrives.
 *
 * Markers live in `processedEvents/{eventId}`. No rule matches that path, so
 * clients can never read or write them (Firestore denies unmatched paths).
 * They carry `expiresAt` for a TTL policy - enable it once per project so old
 * markers sweep themselves:
 *
 *   gcloud firestore fields ttls update expiresAt \
 *     --collection-group=processedEvents --enable-ttl
 */
const EVENT_MARKER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** False means this event already landed - skip the whole body. */
async function claimEvent(
  tx: FirebaseFirestore.Transaction,
  eventId: string | undefined
): Promise<boolean> {
  // No id to dedupe on: counting once too often beats never counting at all.
  if (!eventId) return true;
  const snap = await tx.get(db.doc(`processedEvents/${eventId}`));
  return !snap.exists;
}

/** Records the claim. Must follow every read in the transaction. */
function markEvent(tx: FirebaseFirestore.Transaction, eventId: string | undefined): void {
  if (!eventId) return;
  tx.set(db.doc(`processedEvents/${eventId}`), {
    expiresAt: new Date(Date.now() + EVENT_MARKER_TTL_MS),
  });
}

/**
 * Reads a profile for a participation-counter change, or null when there's
 * nothing to count (no author, no change, or an account already deleted).
 * Firestore wants every read before any write, so stat reads are hoisted up
 * next to the parent-document read.
 */
async function readStat(
  tx: FirebaseFirestore.Transaction,
  uid: string | undefined | null,
  delta: number
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  if (!uid || delta === 0) return null;
  const snap = await tx.get(db.doc(`users/${uid}`));
  return snap.exists ? snap : null;
}

/** Applies a stat delta, clamped so a counter can never go negative. */
function writeStat(
  tx: FirebaseFirestore.Transaction,
  snap: FirebaseFirestore.DocumentSnapshot | null,
  stat: StatKey,
  delta: number
): void {
  if (!snap) return;
  const stats = (snap.data()?.stats ?? {}) as Partial<Record<StatKey, number>>;
  tx.update(snap.ref, { [`stats.${stat}`]: Math.max(0, (stats[stat] ?? 0) + delta) });
}

/** Counter delta for a ballot/judgment write: +1 cast, -1 retracted, 0 changed. */
function ballotStatDelta(before: unknown, after: unknown): number {
  if (!before && after) return 1;
  if (before && !after) return -1;
  return 0;
}

/** A counter's next value, clamped at zero. */
function step(current: unknown, delta: number): number {
  return Math.max(0, (typeof current === 'number' ? current : 0) + delta);
}

export const onConcernCreated = onDocumentCreated('concerns/{concernId}', async (event) => {
  const authorUid = event.data?.data()?.authorUid;
  await db.runTransaction(async (tx) => {
    if (!(await claimEvent(tx, event.id))) return;
    const stat = await readStat(tx, authorUid, 1);
    writeStat(tx, stat, 'concerns', 1);
    markEvent(tx, event.id);
  });
});

export const onConcernVoteWrite = onDocumentWritten(
  'concerns/{concernId}/votes/{voterUid}',
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null;
    const after = event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null;
    const concernRef = db.doc(`concerns/${event.params.concernId}`);
    // A brand-new ballot (not a changed one) counts toward vote milestones;
    // retracting one walks the stat back so cast-retract-cast can't farm it.
    const statDelta = ballotStatDelta(before, after);

    await db.runTransaction(async (tx) => {
      if (!(await claimEvent(tx, event.id))) return;
      const snap = await tx.get(concernRef);
      const stat = await readStat(tx, event.params.voterUid, statDelta);

      // The concern may already be gone (withdrawal cascades to its ballots);
      // the voter's own counter still has to come back down.
      if (snap.exists) {
        const concern = snap.data()!;
        let tallies = concern.tallies as DualTally;
        if (before) tallies = removeBallot(tallies, before.value, areaSlicesOf(before, concern));
        if (after) tallies = addBallot(tallies, after.value, areaSlicesOf(after, concern));
        tx.update(concernRef, {
          tallies,
          score: weightedScore(tallies.all, PRIORITY_WEIGHTS),
          scoreVerified: weightedScore(tallies.verified, PRIORITY_WEIGHTS),
        });
      }
      writeStat(tx, stat, 'votes', statDelta);
      markEvent(tx, event.id);
    });
  }
);

export const onPollVoteWrite = onDocumentWritten(
  'polls/{pollId}/votes/{voterUid}',
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null;
    const after = event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null;
    const pollRef = db.doc(`polls/${event.params.pollId}`);
    const statDelta = ballotStatDelta(before, after);

    await db.runTransaction(async (tx) => {
      if (!(await claimEvent(tx, event.id))) return;
      const snap = await tx.get(pollRef);
      const stat = await readStat(tx, event.params.voterUid, statDelta);

      if (snap.exists) {
        const poll = snap.data()!;
        const validKeys = new Set(((poll.options ?? []) as { key: string }[]).map((o) => o.key));
        // Rules can't introspect the ballot against the option list, so the
        // trigger is the integrity gate: dedupe, drop unknown keys, and allow
        // multiple keys only on approval polls. Deterministic, so a ballot
        // sanitizes identically when it's later changed or removed. A ballot
        // with nothing valid left counts nowhere - not even toward totals.
        const sanitize = (value: VoteValue): string[] => {
          const keys = [...new Set(Array.isArray(value) ? value : [value])].filter((k) =>
            validKeys.has(k)
          );
          return poll.type === 'approval' ? keys : keys.slice(0, 1);
        };

        let tallies = poll.tallies as DualTally;
        const beforeKeys = before ? sanitize(before.value) : [];
        const afterKeys = after ? sanitize(after.value) : [];
        if (before && beforeKeys.length) {
          tallies = removeBallot(tallies, beforeKeys, slicesOf(before));
        }
        if (after && afterKeys.length) tallies = addBallot(tallies, afterKeys, slicesOf(after));
        tx.update(pollRef, { tallies });
      }
      writeStat(tx, stat, 'votes', statDelta);
      markEvent(tx, event.id);
    });
  }
);

// ── Notifications ────────────────────────────────────────────────────────
// In-app notification docs at users/{uid}/notifications/{id}, written only
// here (rules let owners read/mark-read/delete, never create). Doc ids
// derive from the trigger event id, so a retried trigger overwrites its own
// notification instead of duplicating it.

function excerpt(text: unknown, max = 140): string {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

async function sendNotification(
  uid: string | null | undefined,
  eventKey: string,
  data: { type: string; title: string; body: string; link: string },
  actorUid?: string | null
) {
  // Never notify someone about their own action.
  if (!uid || uid === actorUid) return;
  const id = `n-${eventKey.replace(/[^A-Za-z0-9_-]/g, '').slice(-80)}`;
  await db.doc(`users/${uid}/notifications/${id}`).set({
    ...data,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * One trigger body for both directions of a comment's life, shared by every
 * commentable parent (concerns, platform policies).
 */
async function applyCommentDelta(
  eventId: string | undefined,
  parentPath: string,
  authorUid: string | undefined,
  delta: 1 | -1
) {
  const parentRef = db.doc(parentPath);
  await db.runTransaction(async (tx) => {
    if (!(await claimEvent(tx, eventId))) return;
    const snap = await tx.get(parentRef);
    const stat = await readStat(tx, authorUid, delta);
    // The parent may already be gone (withdrawal cascades to its comments).
    if (snap.exists) {
      tx.update(parentRef, { commentCount: step(snap.data()?.commentCount, delta) });
    }
    writeStat(tx, stat, 'comments', delta);
    markEvent(tx, eventId);
  });
}

/**
 * Who hears about a new comment: the parent's owner, plus the thread root's
 * author when the comment is a reply (deduped, never the commenter).
 */
async function notifyNewComment(
  eventId: string | undefined,
  parentPath: string,
  comment: FirebaseFirestore.DocumentData | undefined,
  parent: {
    ownerField: 'authorUid' | 'candidateUid';
    link: string;
    ownerTitle: (p: FirebaseFirestore.DocumentData, authorName: string) => string;
  }
) {
  if (!eventId || !comment) return;
  const parentSnap = await db.doc(parentPath).get();
  if (!parentSnap.exists) return;
  const p = parentSnap.data()!;
  const authorName = (comment.authorName as string) ?? 'Someone';

  const targets = new Map<string, string>();
  targets.set(p[parent.ownerField] as string, parent.ownerTitle(p, authorName));
  if (comment.threadId) {
    const root = await db.doc(`${parentPath}/comments/${comment.threadId}`).get();
    const rootAuthor = root.data()?.authorUid as string | undefined;
    if (rootAuthor && !targets.has(rootAuthor)) {
      targets.set(rootAuthor, `${authorName} replied to your comment`);
    }
  }

  let n = 0;
  for (const [uid, title] of targets) {
    await sendNotification(
      uid,
      `${eventId}-c${n++}`,
      { type: 'comment', title, body: excerpt(comment.body), link: parent.link },
      comment.authorUid as string
    );
  }
}

export const onCommentCreated = onDocumentCreated(
  'concerns/{concernId}/comments/{commentId}',
  async (event) => {
    await applyCommentDelta(
      event.id,
      `concerns/${event.params.concernId}`,
      event.data?.data()?.authorUid,
      1
    );
    await notifyNewComment(event.id, `concerns/${event.params.concernId}`, event.data?.data(), {
      ownerField: 'authorUid',
      link: `/concern/${event.params.concernId}`,
      ownerTitle: (_p, name) => `${name} commented on your concern`,
    });
  }
);

export const onCommentDeleted = onDocumentDeleted(
  'concerns/{concernId}/comments/{commentId}',
  async (event) => {
    await applyCommentDelta(
      event.id,
      `concerns/${event.params.concernId}`,
      event.data?.data()?.authorUid,
      -1
    );
    // A deleted comment takes its rating ballots with it (safe on redelivery).
    await db.recursiveDelete(
      db.doc(`concerns/${event.params.concernId}/comments/${event.params.commentId}`)
    );
  }
);

/**
 * Comment ratings: up minus down, folded into hidden score fields on the
 * comment. Ratings are placement-only - never displayed - so there is no
 * DualTally here, just the two ordering scores (all voters / verified voters).
 */
async function applyCommentVote(
  eventId: string | undefined,
  commentPath: string,
  voterUid: string,
  before: BallotDoc | null,
  after: BallotDoc | null
) {
  const weight = (ballot: BallotDoc | null): number =>
    ballot ? (ballot.value === 'up' ? 1 : ballot.value === 'down' ? -1 : 0) : 0;
  const delta = weight(after) - weight(before);
  const deltaVerified =
    (after?.verified ? weight(after) : 0) - (before?.verified ? weight(before) : 0);
  const statDelta = ballotStatDelta(before, after);
  if (delta === 0 && deltaVerified === 0 && statDelta === 0) return;

  const commentRef = db.doc(commentPath);
  await db.runTransaction(async (tx) => {
    if (!(await claimEvent(tx, eventId))) return;
    const snap = await tx.get(commentRef);
    const stat = await readStat(tx, voterUid, statDelta);
    // The comment may already be gone (deletion cascades to its ballots);
    // the voter's own counter still has to settle. Scores may go negative.
    if (snap.exists) {
      const c = snap.data()!;
      tx.update(commentRef, {
        score: (typeof c.score === 'number' ? c.score : 0) + delta,
        scoreVerified:
          (typeof c.scoreVerified === 'number' ? c.scoreVerified : 0) + deltaVerified,
      });
    }
    writeStat(tx, stat, 'votes', statDelta);
    markEvent(tx, eventId);
  });
}

export const onCommentVoteWrite = onDocumentWritten(
  'concerns/{concernId}/comments/{commentId}/votes/{voterUid}',
  async (event) =>
    applyCommentVote(
      event.id,
      `concerns/${event.params.concernId}/comments/${event.params.commentId}`,
      event.params.voterUid,
      event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null,
      event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null
    )
);

export const onPolicyCommentVoteWrite = onDocumentWritten(
  'candidates/{candidateUid}/policies/{policyId}/comments/{commentId}/votes/{voterUid}',
  async (event) =>
    applyCommentVote(
      event.id,
      `candidates/${event.params.candidateUid}/policies/${event.params.policyId}/comments/${event.params.commentId}`,
      event.params.voterUid,
      event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null,
      event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null
    )
);

/** A withdrawn concern takes its ballots and comments with it. */
export const onConcernDeleted = onDocumentDeleted('concerns/{concernId}', async (event) => {
  const authorUid = event.data?.data()?.authorUid;
  await db.runTransaction(async (tx) => {
    if (!(await claimEvent(tx, event.id))) return;
    const stat = await readStat(tx, authorUid, -1);
    writeStat(tx, stat, 'concerns', -1);
    markEvent(tx, event.id);
  });
  // Re-deleting already-deleted documents is a no-op, so the cascade is safe
  // to repeat on redelivery and stays outside the once-guard (a transaction
  // can't carry a recursive delete anyway).
  await db.recursiveDelete(db.doc(`concerns/${event.params.concernId}`));
});

// ── The more perfect platform (candidate policies) ──────────────────────

/** Stance votes on a platform policy - a straight support/oppose dual tally. */
export const onPolicyVoteWrite = onDocumentWritten(
  'candidates/{candidateUid}/policies/{policyId}/votes/{voterUid}',
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null;
    const after = event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null;
    const policyRef = db.doc(
      `candidates/${event.params.candidateUid}/policies/${event.params.policyId}`
    );
    const statDelta = ballotStatDelta(before, after);

    await db.runTransaction(async (tx) => {
      if (!(await claimEvent(tx, event.id))) return;
      const snap = await tx.get(policyRef);
      const stat = await readStat(tx, event.params.voterUid, statDelta);

      if (snap.exists) {
        // Rules pin the value to one of the two stances, but the trigger is
        // still the integrity gate: anything else counts nowhere.
        const sanitize = (value: VoteValue): string[] =>
          (Array.isArray(value) ? value.slice(0, 1) : [value]).filter(
            (k) => k === 'support' || k === 'oppose'
          );

        let tallies = snap.data()!.tallies as DualTally;
        const beforeKeys = before ? sanitize(before.value) : [];
        const afterKeys = after ? sanitize(after.value) : [];
        if (before && beforeKeys.length) {
          tallies = removeBallot(tallies, beforeKeys, slicesOf(before));
        }
        if (after && afterKeys.length) tallies = addBallot(tallies, afterKeys, slicesOf(after));
        tx.update(policyRef, { tallies });
      }
      writeStat(tx, stat, 'votes', statDelta);
      markEvent(tx, event.id);
    });
  }
);

export const onPolicyCommentCreated = onDocumentCreated(
  'candidates/{candidateUid}/policies/{policyId}/comments/{commentId}',
  async (event) => {
    const policyPath = `candidates/${event.params.candidateUid}/policies/${event.params.policyId}`;
    await applyCommentDelta(event.id, policyPath, event.data?.data()?.authorUid, 1);
    await notifyNewComment(event.id, policyPath, event.data?.data(), {
      ownerField: 'candidateUid',
      link: `/candidate/${event.params.candidateUid}/${event.params.policyId}`,
      ownerTitle: (p, name) => `${name} commented on "${excerpt(p.title, 60)}"`,
    });
  }
);

export const onPolicyCommentDeleted = onDocumentDeleted(
  'candidates/{candidateUid}/policies/{policyId}/comments/{commentId}',
  async (event) => {
    await applyCommentDelta(
      event.id,
      `candidates/${event.params.candidateUid}/policies/${event.params.policyId}`,
      event.data?.data()?.authorUid,
      -1
    );
    // A deleted comment takes its rating ballots with it (safe on redelivery).
    await db.recursiveDelete(
      db.doc(
        `candidates/${event.params.candidateUid}/policies/${event.params.policyId}/comments/${event.params.commentId}`
      )
    );
  }
);

/**
 * Writing credits: a candidate marking (or retracting) a comment as one that
 * changed their policy moves the author's lifetime credit count. The delta is
 * derived from the credited flag's transitions, so deleting a credited
 * comment walks the count back too. The event id is namespaced because
 * onPolicyCommentCreated/Deleted claim ids on this same document path.
 */
export const onPolicyCommentCredited = onDocumentWritten(
  'candidates/{candidateUid}/policies/{policyId}/comments/{commentId}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const delta = (after?.credited ? 1 : 0) - (before?.credited ? 1 : 0);
    if (delta === 0) return;
    const authorUid = (after ?? before)?.authorUid as string | undefined;

    await db.runTransaction(async (tx) => {
      if (!(await claimEvent(tx, event.id ? `credit-${event.id}` : undefined))) return;
      const stat = await readStat(tx, authorUid, delta);
      writeStat(tx, stat, 'credits', delta);
      markEvent(tx, event.id ? `credit-${event.id}` : undefined);
    });

    // A writing credit is the platform's highest compliment - tell the author.
    if (delta === 1 && event.id) {
      const candidate = await db.doc(`candidates/${event.params.candidateUid}`).get();
      await sendNotification(
        authorUid,
        `${event.id}-credit`,
        {
          type: 'credit',
          title: `${candidate.data()?.name ?? 'The candidate'} credited your comment`,
          body: 'Your argument changed the platform. It now carries a writing credit.',
          link: `/candidate/${event.params.candidateUid}/${event.params.policyId}`,
        },
        event.params.candidateUid
      );
    }
  }
);

/**
 * Keeps the candidate's live policy count honest (created/archived/deleted),
 * and cascades a deleted policy to its votes and comments.
 */
export const onPolicyWrite = onDocumentWritten(
  'candidates/{candidateUid}/policies/{policyId}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const liveDelta = (after && !after.archived ? 1 : 0) - (before && !before.archived ? 1 : 0);

    if (liveDelta !== 0) {
      const candidateRef = db.doc(`candidates/${event.params.candidateUid}`);
      await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id))) return;
        const snap = await tx.get(candidateRef);
        if (snap.exists) {
          tx.update(candidateRef, { policyCount: step(snap.data()?.policyCount, liveDelta) });
        }
        markEvent(tx, event.id);
      });
    }

    // A withdrawn or taken-down policy takes its ballots and comments with
    // it. Safe to repeat on redelivery - re-deleting is a no-op.
    if (!after) {
      await db.recursiveDelete(
        db.doc(`candidates/${event.params.candidateUid}/policies/${event.params.policyId}`)
      );
    }
  }
);

/**
 * A question can vanish two ways: the asker withdraws it while unanswered, or
 * the admin takes down an abusive thread at any stage. Rebalance every
 * counter the question contributed to and sweep its judgments.
 */
export const onQuestionDeleted = onDocumentDeleted(
  'officials/{officialUid}/questions/{questionId}',
  async (event) => {
    const q = event.data?.data();
    const officialRef = db.doc(`officials/${event.params.officialUid}`);

    await db.runTransaction(async (tx) => {
      if (!(await claimEvent(tx, event.id))) return;
      const snap = await tx.get(officialRef);
      if (snap.exists) {
        const o = snap.data()!;
        const next: Record<string, number> = { questionsAsked: step(o.questionsAsked, -1) };
        if (q?.response) next.questionsResponded = step(o.questionsResponded, -1);
        if (q?.status === 'answered') next.questionsAnswered = step(o.questionsAnswered, -1);
        if (q?.status === 'dodged') next.questionsDodged = step(o.questionsDodged, -1);
        tx.update(officialRef, next);
      }
      markEvent(tx, event.id);
    });

    await db.recursiveDelete(
      db.doc(`officials/${event.params.officialUid}/questions/${event.params.questionId}`)
    );
  }
);

/**
 * Approval ballots - the "how well liked" axis of an official's grade.
 * Aggregates the standard dual tally (all / verified) plus a constituents-only count
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
      if (!(await claimEvent(tx, event.id))) return;
      const snap = await tx.get(officialRef);
      if (!snap.exists) return;
      const official = snap.data()!;
      let tallies = (official.approvalTallies as DualTally) ?? {
        all: {},
        verified: {},
        totalAll: 0,
        totalVerified: 0,
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
      markEvent(tx, event.id);
    });
  }
);

/** Move one of an official's AMA counters by a clamped delta, exactly once. */
async function bumpOfficialCounter(
  eventId: string | undefined,
  officialUid: string,
  field: 'questionsAsked' | 'questionsResponded',
  delta: number
) {
  const officialRef = db.doc(`officials/${officialUid}`);
  await db.runTransaction(async (tx) => {
    if (!(await claimEvent(tx, eventId))) return;
    const snap = await tx.get(officialRef);
    if (snap.exists) tx.update(officialRef, { [field]: step(snap.data()?.[field], delta) });
    markEvent(tx, eventId);
  });
}

export const onQuestionCreated = onDocumentCreated(
  'officials/{officialUid}/questions/{questionId}',
  async (event) => {
    await bumpOfficialCounter(event.id, event.params.officialUid, 'questionsAsked', 1);
    const q = event.data?.data();
    await sendNotification(
      event.params.officialUid,
      `${event.id}-asked`,
      {
        type: 'question',
        title: 'New question in your AMA',
        body: excerpt(q?.body),
        link: `/official/${event.params.officialUid}`,
      },
      q?.authorUid as string
    );
  }
);

/** The official posting their response moves questionsResponded. */
export const onQuestionResponded = onDocumentWritten(
  'officials/{officialUid}/questions/{questionId}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (!after || before?.response || !after.response) return;
    await bumpOfficialCounter(event.id, event.params.officialUid, 'questionsResponded', 1);
    const official = await db.doc(`officials/${event.params.officialUid}`).get();
    await sendNotification(
      after.authorUid as string,
      `${event.id}-responded`,
      {
        type: 'response',
        title: `${official.data()?.name ?? 'The official'} responded to your question`,
        body: excerpt(after.response),
        link: `/official/${event.params.officialUid}`,
      },
      event.params.officialUid
    );
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
    const statDelta = ballotStatDelta(before, after);
    // Captured out of the transaction so the verdict can be delivered as
    // notifications after it commits.
    let verdict: { next: string; authorUid?: string; body?: string } | null = null;

    await db.runTransaction(async (tx) => {
      if (!(await claimEvent(tx, event.id))) return;
      const snap = await tx.get(questionRef);
      const stat = await readStat(tx, event.params.judgeUid, statDelta);
      // Everything is computed (and every document read) before the first
      // write, because Firestore rejects a transaction that reads after
      // writing. The question may be gone - an admin takedown of the thread -
      // in which case only the judge's own counter still has to settle.
      const q = snap.exists ? snap.data()! : null;
      let counts: Record<string, unknown> | null = null;
      let officialSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      let prevStatus = '';
      let nextStatus = '';

      if (q) {
        let yes = q.answeredYes ?? 0;
        let no = q.answeredNo ?? 0;
        let yesVerified = q.answeredYesVerified ?? 0;
        let noVerified = q.answeredNoVerified ?? 0;
        if (before) {
          before.answered ? (yes -= 1) : (no -= 1);
          if (before.verified) before.answered ? (yesVerified -= 1) : (noVerified -= 1);
        }
        if (after) {
          after.answered ? (yes += 1) : (no += 1);
          if (after.verified) after.answered ? (yesVerified += 1) : (noVerified += 1);
        }
        yes = Math.max(0, yes);
        no = Math.max(0, no);
        yesVerified = Math.max(0, yesVerified);
        noVerified = Math.max(0, noVerified);

        // Only verified users decide the verdict - unverified judgments are
        // displayed but can't flip the status, so a stack of throwaway
        // accounts can't brand an official a dodger (or launder a real dodge).
        // A response counts as answered until verified dodge votes outnumber
        // verified answered votes - no quorum, the verdict is live.
        prevStatus = q.status as string;
        nextStatus = !q.response
          ? prevStatus
          : noVerified > yesVerified
            ? 'dodged'
            : yesVerified > 0
              ? 'answered'
              : 'underReview';

        counts = {
          answeredYes: yes,
          answeredNo: no,
          answeredYesVerified: yesVerified,
          answeredNoVerified: noVerified,
          status: nextStatus,
        };
        // The official's answered/dodged counters move with the status flip.
        if (prevStatus !== nextStatus) {
          officialSnap = await tx.get(officialRef);
          if (nextStatus === 'answered' || nextStatus === 'dodged') {
            verdict = {
              next: nextStatus,
              authorUid: q.authorUid as string | undefined,
              body: excerpt(q.body),
            };
          }
        }
      }

      // ── every read is done; writes only from here ──
      if (counts) tx.update(questionRef, counts);

      if (officialSnap?.exists) {
        const o = officialSnap.data()!;
        const next: Record<string, number> = {};
        if (prevStatus === 'answered') next.questionsAnswered = step(o.questionsAnswered, -1);
        if (prevStatus === 'dodged') next.questionsDodged = step(o.questionsDodged, -1);
        if (nextStatus === 'answered') next.questionsAnswered = step(o.questionsAnswered, 1);
        if (nextStatus === 'dodged') next.questionsDodged = step(o.questionsDodged, 1);
        if (Object.keys(next).length) tx.update(officialRef, next);
      }

      writeStat(tx, stat, 'judgments', statDelta);
      markEvent(tx, event.id);
    });

    // Deliver the community's verdict to both sides of the exchange.
    if (verdict && event.id) {
      const v = verdict as { next: string; authorUid?: string; body?: string };
      const answered = v.next === 'answered';
      const link = `/official/${event.params.officialUid}`;
      await sendNotification(v.authorUid, `${event.id}-v-author`, {
        type: 'verdict',
        title: answered
          ? 'The community marked your question answered'
          : 'The community judged the response a dodge',
        body: v.body ?? '',
        link,
      });
      await sendNotification(event.params.officialUid, `${event.id}-v-official`, {
        type: 'verdict',
        title: answered
          ? 'Your response was judged a straight answer'
          : 'Your response was judged a dodge',
        body: v.body ?? '',
        link,
      });
    }
  }
);

/**
 * Full account deletion (App Store 5.1.1(v)). Removes the auth user, the
 * profile (identity, ward, stats), the block list, and retracts the user's
 * standing approvals of officials (the onApprovalWrite trigger walks the
 * tallies back). Content stays on the record but is re-attributed to
 * "[deleted]" so no display name outlives its account; cast ballots stay
 * counted.
 *
 * Officials are admin-provisioned and must be off-boarded by the operator so
 * their public record isn't self-erasable.
 */
export const deleteAccount = onCall(APP_CHECK, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  const uid = request.auth.uid;
  const profile = await db.doc(`users/${uid}`).get();
  if (profile.exists && ['official', 'candidate'].includes(profile.data()!.role)) {
    throw new HttpsError(
      'failed-precondition',
      'Official and candidate accounts are removed by the platform operator.'
    );
  }

  // Retract standing approvals: these are ongoing positions, not
  // point-in-time votes, and must not outlive the account.
  const officials = await db.collection('officials').listDocuments();
  await Promise.all(officials.map((o) => o.collection('approvals').doc(uid).delete()));

  // Strip the pseudonym off everything the account posted.
  const authored = await Promise.all([
    db.collection('concerns').where('authorUid', '==', uid).get(),
    db.collectionGroup('comments').where('authorUid', '==', uid).get(),
    db.collectionGroup('questions').where('authorUid', '==', uid).get(),
  ]);
  const docs = authored.flatMap((snap) => snap.docs);
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 500)) {
      batch.update(d.ref, { authorName: '[deleted]' });
    }
    await batch.commit();
  }

  // Free the verified-identity claim so the person can verify again if they
  // ever return with a new account.
  const identityClaimId = profile.exists ? profile.data()!.identityClaimId : null;
  if (identityClaimId) {
    await db.doc(`identityClaims/${identityClaimId}`).delete().catch(() => {});
  }

  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth().deleteUser(uid);
  return { ok: true };
});

// ── Platform sync ────────────────────────────────────────────────────────
// Candidates with an operator-provisioned sourceUrl get their platform
// scraped from their own campaign site, so the site stays the single source
// of truth and nobody hand-enters policies twice. Synced policies are keyed
// by a slug of their title: edits on the site update the same document in
// place, so votes and comments survive; policies that vanish from the site
// are archived (never deleted) for the same reason.

async function syncCandidatePlatform(
  candidateUid: string,
  sourceUrl: string
): Promise<{ synced: number; archived: number }> {
  const resp = await fetch(sourceUrl, { headers: { accept: 'text/html' } });
  if (!resp.ok) throw new Error(`Fetching ${sourceUrl} failed: ${resp.status}`);
  // parsePlatformHtml throws on an unrecognized layout rather than returning
  // nothing - a site redesign must fail the sync, not archive the platform.
  const parsed = parsePlatformHtml(await resp.text());

  const policiesRef = db.collection(`candidates/${candidateUid}/policies`);
  const existing = await policiesRef.get();
  const byId = new Map(existing.docs.map((d) => [d.id, d]));

  const batch = db.batch();
  const seen = new Set<string>();
  for (const p of parsed) {
    const current = byId.get(p.slug);
    // An in-app policy already owns this id - never let the site hijack it.
    if (current && current.data().source !== 'site') {
      console.warn(`Sync skipped "${p.title}": id ${p.slug} is an in-app policy.`);
      continue;
    }
    seen.add(p.slug);
    const fields = {
      section: p.section,
      title: p.title,
      body: p.body,
      links: p.links,
      order: p.order,
      archived: false,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (current) {
      batch.update(current.ref, fields);
    } else {
      batch.set(policiesRef.doc(p.slug), {
        ...fields,
        candidateUid,
        source: 'site',
        tallies: { all: {}, verified: {}, totalAll: 0, totalVerified: 0 },
        commentCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  let archived = 0;
  for (const doc of existing.docs) {
    if (doc.data().source === 'site' && !seen.has(doc.id) && !doc.data().archived) {
      batch.update(doc.ref, { archived: true, updatedAt: FieldValue.serverTimestamp() });
      archived += 1;
    }
  }

  batch.update(db.doc(`candidates/${candidateUid}`), {
    lastSyncedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  console.log(`Synced ${seen.size} policies (${archived} archived) for ${candidateUid}.`);
  return { synced: seen.size, archived };
}

// ── Account claims ───────────────────────────────────────────────────────
// Officials and candidates are provisioned as passwordless placeholder
// accounts keyed to their published email. "Claimed" means someone proved
// control of that inbox: a password reset, magic link, or SSO sign-in all
// attach a provider to the account, and every one of those paths requires
// receiving mail at (or owning) the address. providerData is therefore the
// claim signal; rules separately require email_verified on the auth token
// before any politician action, so an unconfirmed sign-in can do nothing.

async function refreshClaimFor(uid: string): Promise<boolean> {
  const user = await getAuth().getUser(uid).catch(() => null);
  const claimed = !!user && user.providerData.length > 0;
  for (const col of ['officials', 'candidates']) {
    const ref = db.doc(`${col}/${uid}`);
    const snap = await ref.get();
    if (snap.exists && snap.data()!.claimed !== claimed) {
      await ref.update({ claimed });
    }
  }
  return claimed;
}

/** Nightly recheck of who has claimed their public profile. */
export const sweepClaims = onSchedule(
  { schedule: '30 6 * * *', timeZone: 'America/Chicago' },
  async () => {
    for (const col of ['officials', 'candidates']) {
      const snap = await db.collection(col).get();
      for (const d of snap.docs) {
        try {
          await refreshClaimFor(d.id);
        } catch (err) {
          console.error(`Claim check failed for ${col}/${d.id}:`, err);
        }
      }
    }
  }
);

/** Instant claim check, called by the app when a politician signs in. */
export const refreshClaim = onCall(APP_CHECK, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  return { claimed: await refreshClaimFor(request.auth.uid) };
});

/** Nightly sweep of every candidate whose platform lives on their own site. */
export const syncPlatforms = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'America/Chicago' },
  async () => {
    const candidates = await db.collection('candidates').where('sourceUrl', '!=', null).get();
    for (const c of candidates.docs) {
      try {
        await syncCandidatePlatform(c.id, c.data().sourceUrl as string);
      } catch (err) {
        console.error(`Platform sync failed for ${c.id}:`, err);
      }
    }
  }
);

/** "Sync now" for a candidate who just updated their campaign site. */
export const syncMyPlatform = onCall(APP_CHECK, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  const snap = await db.doc(`candidates/${request.auth.uid}`).get();
  const sourceUrl = snap.exists ? (snap.data()!.sourceUrl as string | null) : null;
  if (!sourceUrl) {
    throw new HttpsError(
      'failed-precondition',
      'No campaign site is linked to this candidate profile.'
    );
  }
  try {
    return await syncCandidatePlatform(request.auth.uid, sourceUrl);
  } catch (err) {
    console.error(`Platform sync failed for ${request.auth.uid}:`, err);
    throw new HttpsError('internal', 'Could not read the campaign site. Try again shortly.');
  }
});

/**
 * DEV ONLY - simulates a passing identity verification when running against the
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
  // 51 is the hidden test ward (TEST_WARD in the app) - allowed here so
  // emulator test accounts can live outside the real 50 wards.
  if (!Number.isInteger(wardId) || wardId < WARD_MIN || wardId > WARD_MAX + 1) {
    throw new HttpsError('invalid-argument', `wardId must be ${WARD_MIN}–${WARD_MAX + 1}.`);
  }
  await applyVerification(request.auth.uid, { verified: true, wardId });
  return { ok: true };
});

/**
 * Returns a hosted Didit verification session URL for the signed-in user.
 * The uid rides along as vendor_data so the webhook can match the result
 * back. Required function secrets:
 *   DIDIT_API_KEY      - dashboard -> Settings -> API keys
 *   DIDIT_WORKFLOW_ID  - the ID-verification workflow to run
 */
export const createVerificationSession = onCall(
  { ...APP_CHECK, secrets: [DIDIT_API_KEY, DIDIT_WORKFLOW_ID] },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  const apiKey = DIDIT_API_KEY.value();
  const workflowId = DIDIT_WORKFLOW_ID.value();
  if (!apiKey || !workflowId) {
    throw new HttpsError('failed-precondition', 'Identity verification is not configured yet.');
  }

  // Reserve a slot under the monthly cap before spending money with Didit.
  const monthKey = verificationMonthKey();
  const monthRef = db.doc(`verificationUsage/${monthKey}`);
  const sessionNumber = await db.runTransaction(async (tx) => {
    const snap = await tx.get(monthRef);
    const sessions = (snap.data()?.sessions as number | undefined) ?? 0;
    if (sessions >= VERIFICATION_MONTHLY_CAP) return null;
    tx.set(
      monthRef,
      { sessions: sessions + 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return sessions + 1;
  });
  if (sessionNumber === null) {
    throw new HttpsError(
      'resource-exhausted',
      'Verification is at capacity for this month. Please try again after the 1st.'
    );
  }
  if (sessionNumber > VERIFICATION_FREE_TIER) {
    console.warn(
      `Verification session ${sessionNumber}/${VERIFICATION_MONTHLY_CAP} this month is past the ${VERIFICATION_FREE_TIER}-session free tier and bills us.`
    );
  }

  let url: string | undefined;
  try {
    const resp = await fetch('https://verification.didit.me/v2/session/', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: workflowId, vendor_data: request.auth.uid }),
    });
    if (!resp.ok) {
      console.error('Didit session creation failed:', resp.status, await resp.text());
      throw new HttpsError('internal', 'Could not start verification. Try again shortly.');
    }
    const session = (await resp.json()) as {
      session_id?: string;
      url?: string;
      session_url?: string;
    };
    url = session.url ?? session.session_url;
    if (!url) {
      console.error('Didit session response had no url field:', JSON.stringify(session).slice(0, 300));
      throw new HttpsError('internal', 'Could not start verification. Try again shortly.');
    }
    // Record the reservation so the webhook can settle this session's slot
    // (return it if the link expires unopened, keep it if modules billed).
    if (session.session_id) {
      await db.doc(`verificationSessions/${session.session_id}`).set({
        uid: request.auth.uid,
        monthKey,
        settled: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      console.warn('Didit session response had no session_id - slot cannot be released on expiry.');
    }
  } catch (err) {
    // No session was actually started, so give the slot back.
    await monthRef
      .set({ sessions: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      .catch(() => {});
    if (err instanceof HttpsError) throw err;
    console.error('Didit session creation threw:', err);
    throw new HttpsError('internal', 'Could not start verification. Try again shortly.');
  }
  return { inquiryUrl: url };
  }
);

/**
 * Didit webhook - the only writer of `verified` in production.
 *
 * Configure in Didit: dashboard -> Webhooks, pointed at this function's URL;
 * store the shown secret as DIDIT_WEBHOOK_SECRET. Signature scheme per
 * https://docs.didit.me/integration/webhooks: HMAC-SHA256 over the raw body
 * in X-Signature, with X-Timestamp freshness (300s).
 *
 * One verified human, one verified account: the document identity (issuing
 * state + document number + birth date) is hashed and claimed in
 * `identityClaims/{hash}` (no security rule matches that path, so clients
 * can never touch it). A document that already verified a different uid is
 * refused. deleteAccount releases the claim.
 *
 * Ward derivation from the verified address is future work; until then
 * production verification grants city-level verified (no ward).
 */
export const diditWebhook = onRequest({ secrets: [DIDIT_WEBHOOK_SECRET] }, async (req, res) => {
  const secret = DIDIT_WEBHOOK_SECRET.value();
  if (!secret) {
    res.status(500).send('Webhook secret not configured.');
    return;
  }

  const signature = req.header('X-Signature') ?? '';
  const timestamp = req.header('X-Timestamp') ?? '';
  if (!signature || !timestamp) {
    res.status(400).send('Missing signature.');
    return;
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    res.status(401).send('Stale timestamp.');
    return;
  }
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    res.status(401).send('Bad signature.');
    return;
  }

  const body = req.body ?? {};
  const uid: string | null = body.vendor_data ?? null;
  const status: string | undefined = body.status;
  const sessionId: string | null = body.session_id ?? null;

  // Terminal statuses settle the monthly cost ledger exactly once per
  // session; non-terminal ones (Not Started / In Progress / In Review /
  // Resubmitted) leave the reservation pending.
  if (sessionId && status && ['Approved', 'Declined', 'Abandoned', 'Expired'].includes(status)) {
    await settleVerificationSlot(sessionId, status);
  }

  // Only a final Approved decision mints verified=true. Everything else
  // (Declined / In Review / Abandoned / Expired / progress events) is
  // acknowledged and ignored.
  if (!uid || status !== 'Approved') {
    res.status(200).send('Not an approval.');
    return;
  }

  // Hash the document identity for the one-human-one-account claim.
  const idv = body.decision?.id_verifications?.[0] ?? {};
  const docKey =
    idv.document_number && idv.issuing_state
      ? crypto
          .createHash('sha256')
          .update(`${idv.issuing_state}:${idv.document_number}:${idv.date_of_birth ?? ''}`)
          .digest('hex')
      : null;
  if (docKey) {
    const claimed = await db.runTransaction(async (tx) => {
      const mapRef = db.doc(`identityClaims/${docKey}`);
      const existing = await tx.get(mapRef);
      if (existing.exists && existing.data()!.uid !== uid) return false;
      tx.set(mapRef, { uid, updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) {
      console.warn('Duplicate identity: document already verified another uid.');
      res.status(200).send('Identity already verified on another account.');
      return;
    }
  } else {
    console.warn('Approved session carried no document identity - dedup not enforced.');
  }

  try {
    await db.doc(`users/${uid}`).update({
      verified: true,
      identityClaimId: docKey,
    });
  } catch {
    // The account may have been deleted between session and webhook. A 200
    // stops Didit from retrying a verification that can never land.
    console.warn(`Approved session for missing user ${uid} - profile not found.`);
    res.status(200).send('No such user.');
    return;
  }

  res.status(200).send('OK');
});
