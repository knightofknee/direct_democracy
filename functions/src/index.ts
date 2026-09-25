import * as crypto from 'crypto';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

import { parsePlatformUrl } from './platform';

/** Fetch one page of a campaign site; a real UA gets past bot-filtering CDNs. */
async function fetchPageHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    },
  });
  if (!resp.ok) throw new Error(`Fetching ${url} failed: ${resp.status}`);
  return resp.text();
}
import {
  PRIORITY_WEIGHTS,
  addBallot,
  removeBallot,
  weightedScore,
  type DualTally,
  type VoterSlices,
  type VoteValue,
} from './tally';
import {
  FREE_CHECKS_PER_MONTH,
  PurchaseRejected,
  accountTokenFor,
  creditForProduct,
  productFor,
  verifyApplePurchase,
  verifyGooglePurchase,
  type CreditType,
  type VerifiedPurchase,
} from './payments';
import { decisionAddresses, resolveWard, wardLabelEn, type WardResult } from './ward';

initializeApp();
const db = getFirestore();

const WARD_MIN = 1;
const WARD_MAX = 50;

/**
 * Unanswered questions younger than a week are pending (not yet graded);
 * older ones grade as ignored. The official doc's questionsPending counter is
 * the single source of that split: triggers move it as questions arrive and
 * get answered, and sweepPendingQuestions recounts nightly so questions age
 * out of pending. Clients read the counter and never compute the boundary.
 */
const PENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** True while a question still counts as pending rather than ignored. */
function withinPendingWindow(createdAt: unknown): boolean {
  const millis = (createdAt as Timestamp | null | undefined)?.toMillis?.();
  // A missing timestamp means the serverTimestamp hasn't landed - brand new.
  return millis == null || Date.now() - millis < PENDING_WINDOW_MS;
}

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
// Key for the one-way identity code (see identityCode). Kept only in Secret
// Manager, so a copy of the database alone can't be matched against guessed
// ID numbers.
const IDENTITY_HASH_KEY = defineSecret('IDENTITY_HASH_KEY');

/** Didit sessions still undecided after this long are erased anyway. */
const DIDIT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The one-human-one-account code for an ID document: a keyed hash of the
 * issuing state and document number, nothing else (no birth date, no name).
 * Null when the key or either field is missing.
 */
function identityCode(issuingState: unknown, documentNumber: unknown): string | null {
  const key = IDENTITY_HASH_KEY.value();
  const norm = (v: unknown) => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : '');
  const state = norm(issuingState);
  const number = norm(documentNumber);
  if (!key || !state || !number) return null;
  return crypto.createHmac('sha256', key).update(`${state}:${number}`).digest('hex');
}

/**
 * Erase a session from Didit, face data and all ("privacy_erasure"), once
 * the app has kept what it keeps. Marks `verificationSessions/{id}.erased`;
 * a failure is left for the nightly sweep to retry.
 */
async function eraseDiditSession(sessionId: string): Promise<boolean> {
  const apiKey = DIDIT_API_KEY.value();
  if (!apiKey) return false;
  try {
    const resp = await fetch(
      `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/delete/`,
      {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletion_instruction: 'privacy_erasure', instruction_id: `dd-${sessionId}` }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    // 404: already gone.
    if (!resp.ok && resp.status !== 404) {
      console.warn(`Didit erase of ${sessionId} failed: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
      return false;
    }
    await db
      .doc(`verificationSessions/${sessionId}`)
      .set({ erased: true, erasedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (err) {
    console.warn(`Didit erase of ${sessionId} threw:`, err);
    return false;
  }
}

// Who pays: Didit bills per module that runs in a session (Approved and
// Declined both bill; a session whose link is never opened bills nothing), and
// its first 500 ID checks each calendar month are free. Every session start
// counts in `verificationUsage/{YYYY-MM}` (Chicago time) with its record in
// `verificationSessions/{sessionId}`; an unopened link that expires is given
// back. Inside the free 500 a main-workflow session is free; past them, and
// for every bill move, the session spends a purchased credit (payments.ts).
// No security rule matches any of these paths, so only the Admin SDK can
// touch them.

/**
 * Moving: a verified citizen can verify again at a new address from Settings,
 * once per 90 days (mirror of REVERIFY_COOLDOWN_DAYS in src/lib/verification.ts).
 * The clock (`users/{uid}.reverifyAt`, Admin SDK only) is stamped when the
 * session starts, since that is when Didit can start billing, and handed back
 * if the link expires unopened. A move runs one of two workflows, the
 * person's choice in Settings: `id` (the main workflow; the address comes
 * off the ID) or `address` (DIDIT_ADDRESS_WORKFLOW_ID in functions/.env: the
 * same ID checks plus a utility bill or bank statement, for someone whose ID
 * still shows the old address; its name must match the ID's, and the webhook
 * reads its address first). Both share the one 90-day window.
 */
const REVERIFY_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

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
      const session = snap.data()!;
      // A re-verification link that expired unopened cost nothing, so it
      // doesn't use up the person's 90 days either.
      const userRef =
        status === 'Expired' && session.kind === 'reverify' ? db.doc(`users/${session.uid}`) : null;
      const user = userRef ? await tx.get(userRef) : null;
      // A paid session that expired unopened cost nothing, so its credit
      // goes back for the next attempt.
      const creditsRef =
        status === 'Expired' && session.creditType ? db.doc(`verificationCredits/${session.uid}`) : null;
      const credits = creditsRef ? await tx.get(creditsRef) : null;
      const monthRef = db.doc(`verificationUsage/${session.monthKey}`);
      tx.update(sessionRef, { settled: true, finalStatus: status });
      if (creditsRef) {
        const type = session.creditType as CreditType;
        tx.set(
          creditsRef,
          { [type]: ((credits?.data()?.[type] as number | undefined) ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      const stamped = user?.data()?.reverifyAt as Timestamp | undefined;
      if (userRef && stamped && session.reverifyAt && stamped.isEqual(session.reverifyAt)) {
        tx.update(userRef, { reverifyAt: session.prevReverifyAt ?? FieldValue.delete() });
      }
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

/**
 * Every notification carries English and Spanish. The language setting lives
 * only on the device, so the app picks titleEs/bodyEs for Spanish readers
 * (falling back to English). People's own words (a question, a comment, a
 * response) are quoted as written in both.
 */
async function sendNotification(
  uid: string | null | undefined,
  eventKey: string,
  data: {
    type: string;
    title: string;
    titleEs: string;
    body: string;
    bodyEs: string;
    link: string;
  },
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
    ownerTitle: (
      p: FirebaseFirestore.DocumentData,
      authorName: string
    ) => { en: string; es: string };
  }
) {
  if (!eventId || !comment) return;
  const parentSnap = await db.doc(parentPath).get();
  if (!parentSnap.exists) return;
  const p = parentSnap.data()!;
  const authorName = (comment.authorName as string) ?? 'Someone';

  const targets = new Map<string, { en: string; es: string }>();
  targets.set(p[parent.ownerField] as string, parent.ownerTitle(p, authorName));
  if (comment.threadId) {
    const root = await db.doc(`${parentPath}/comments/${comment.threadId}`).get();
    const rootAuthor = root.data()?.authorUid as string | undefined;
    if (rootAuthor && !targets.has(rootAuthor)) {
      targets.set(rootAuthor, {
        en: `${authorName} replied to your comment`,
        es: `${authorName} respondió a tu comentario`,
      });
    }
  }

  let n = 0;
  for (const [uid, title] of targets) {
    await sendNotification(
      uid,
      `${eventId}-c${n++}`,
      {
        type: 'comment',
        title: title.en,
        titleEs: title.es,
        body: excerpt(comment.body),
        bodyEs: excerpt(comment.body),
        link: parent.link,
      },
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
      ownerTitle: (_p, name) => ({
        en: `${name} commented on your concern`,
        es: `${name} comentó en tu preocupación`,
      }),
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

// ── Election AMA (one question, every candidate) ────────────────────────
// electionQuestions/{qid}/answers/{candidateUid}: one answer per candidate
// (the doc id enforces it). answerCount and the answers' hidden placement
// scores are trigger-only; ratings share applyCommentVote with comments.

export const onElectionAnswerWrite = onDocumentWritten(
  'electionQuestions/{questionId}/answers/{candidateUid}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;

    // Recount rather than delta: out-of-order delivery of a create/delete
    // pair can strand a delta-based counter (the -1 clamps at 0, the late +1
    // sticks), and a recount is idempotent so it needs no once-guard. The
    // field can then never drift from the truth for longer than one write.
    const questionRef = db.doc(`electionQuestions/${event.params.questionId}`);
    if ((before == null) !== (after == null)) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(questionRef);
        if (!snap.exists) return;
        const answers = await tx.get(questionRef.collection('answers'));
        if (snap.data()?.answerCount !== answers.size) {
          tx.update(questionRef, { answerCount: answers.size });
        }
      });
    }

    // A first answer is news to the asker.
    if (!before && after) {
      const question = (await questionRef.get()).data();
      await sendNotification(
        question?.authorUid,
        `election-answer-${event.params.questionId}-${event.params.candidateUid}`,
        {
          type: 'electionAnswer',
          title: `${after.candidateName} answered your question`,
          titleEs: `${after.candidateName} respondió tu pregunta`,
          body: excerpt(after.body),
          bodyEs: excerpt(after.body),
          link: `/election-question/${event.params.questionId}`,
        },
        event.params.candidateUid
      );
    }

    // A withdrawn answer takes its ratings with it (no-op on redelivery).
    if (before && !after) {
      await db.recursiveDelete(
        db.doc(
          `electionQuestions/${event.params.questionId}/answers/${event.params.candidateUid}`
        )
      );
    }
  }
);

export const onElectionAnswerVoteWrite = onDocumentWritten(
  'electionQuestions/{questionId}/answers/{candidateUid}/votes/{voterUid}',
  async (event) =>
    applyCommentVote(
      event.id,
      `electionQuestions/${event.params.questionId}/answers/${event.params.candidateUid}`,
      event.params.voterUid,
      event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null,
      event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null
    )
);

/**
 * An election-question upvote ("I want this answered too") landed or was
 * retracted: recount the question's upvote fields from its votes
 * subcollection. The counts order the election AMA list, so the questions
 * people join lead the page; no candidate grading hangs off them.
 */
export const onElectionQuestionUpvoteWrite = onDocumentWritten(
  'electionQuestions/{questionId}/votes/{voterUid}',
  async (event) => {
    const questionRef = db.doc(`electionQuestions/${event.params.questionId}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(questionRef);
      if (!snap.exists) return;
      const votes = await tx.get(questionRef.collection('votes'));
      const upvotes = votes.size;
      const upvotesVerified = votes.docs.filter((v) => v.data().verified === true).length;
      const q = snap.data()!;
      if (q.upvotes !== upvotes || q.upvotesVerified !== upvotesVerified) {
        tx.update(questionRef, { upvotes, upvotesVerified });
      }
    });
  }
);

/** A withdrawn question takes its answers (and their ratings) with it. */
export const onElectionQuestionDeleted = onDocumentDeleted(
  'electionQuestions/{questionId}',
  async (event) => {
    await db.recursiveDelete(db.doc(`electionQuestions/${event.params.questionId}`));
  }
);

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
      ownerTitle: (p, name) => ({
        en: `${name} commented on "${excerpt(p.title, 60)}"`,
        es: `${name} comentó en "${excerpt(p.title, 60)}"`,
      }),
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
          titleEs: `${candidate.data()?.name ?? 'El candidato'} dio crédito de autoría a tu comentario`,
          body: 'Your argument changed the platform. It now carries a writing credit.',
          bodyEs: 'Tu argumento cambió la plataforma. Ahora lleva un crédito de autoría.',
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
        if (q?.status === 'awaitingResponse' && withinPendingWindow(q?.createdAt)) {
          next.questionsPending = step(o.questionsPending, -1);
        }
        tx.update(officialRef, next);
      }
      markEvent(tx, event.id);
    });

    await db.recursiveDelete(
      db.doc(`officials/${event.params.officialUid}/questions/${event.params.questionId}`)
    );
    await recountAnswerWeights(event.params.officialUid);
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

/** Move an official's AMA counters by clamped deltas, exactly once per event. */
async function bumpOfficialCounters(
  eventId: string | undefined,
  officialUid: string,
  deltas: Partial<Record<'questionsAsked' | 'questionsResponded' | 'questionsPending', number>>
) {
  const officialRef = db.doc(`officials/${officialUid}`);
  await db.runTransaction(async (tx) => {
    if (!(await claimEvent(tx, eventId))) return;
    const snap = await tx.get(officialRef);
    if (snap.exists) {
      const next: Record<string, number> = {};
      for (const [field, delta] of Object.entries(deltas)) {
        next[field] = step(snap.data()?.[field], delta as number);
      }
      tx.update(officialRef, next);
    }
    markEvent(tx, eventId);
  });
}

/**
 * Recount the official's upvote-weighted answer buckets from scratch. Each
 * question weighs 1 + its verified upvotes (the same only-verified-moves-
 * the-needle rule as verdicts), bucketed by its current state: responses not
 * judged dodges earn credit, dodges and aged-out silence cost, questions
 * inside the grace window are held out. A full recount per event instead of
 * incremental bucket surgery: questions per official are few, upvotes land
 * after (and independent of) every status change, and a recount is
 * idempotent, so the buckets can never drift for longer than one write. The
 * client folds ignored back into pending for unclaimed officials.
 */
async function recountAnswerWeights(officialUid: string): Promise<void> {
  const officialRef = db.doc(`officials/${officialUid}`);
  const questions = await db.collection(`officials/${officialUid}/questions`).get();
  const weights = { credit: 0, dodged: 0, ignored: 0, pending: 0 };
  for (const q of questions.docs) {
    const d = q.data();
    const w = 1 + Math.max(0, (d.upvotesVerified as number) ?? 0);
    if (d.status === 'dodged') weights.dodged += w;
    else if (d.response) weights.credit += w;
    else if (withinPendingWindow(d.createdAt)) weights.pending += w;
    else weights.ignored += w;
  }
  // The official may be gone (account deletion mid-event); nothing to grade.
  await officialRef.update({ answerWeights: weights }).catch(() => {});
}

/**
 * Officials get one alert per question when it reaches their upvote
 * threshold (a per-official setting on their card; this is the fallback for
 * officials who never set one). Silence on a popular question is what the
 * weighted grade punishes hardest, so it must never be ignorance.
 */
const DEFAULT_UPVOTE_ALERT_THRESHOLD = 10;

/**
 * A question upvote ("I want this answered too") landed or was retracted:
 * recount the question's upvote fields from its votes subcollection (recount
 * over delta for the same idempotency reasons as onElectionAnswerWrite),
 * re-weight the official's answer grade, and alert the official when an
 * unanswered question crosses their threshold.
 */
export const onQuestionUpvoteWrite = onDocumentWritten(
  'officials/{officialUid}/questions/{questionId}/votes/{voterUid}',
  async (event) => {
    const questionRef = db.doc(
      `officials/${event.params.officialUid}/questions/${event.params.questionId}`
    );
    // Captured from the last (committed) transaction attempt.
    let counted: { prev: number; next: number; unanswered: boolean; body: string } | null = null;
    await db.runTransaction(async (tx) => {
      counted = null;
      const snap = await tx.get(questionRef);
      if (!snap.exists) return;
      const votes = await tx.get(questionRef.collection('votes'));
      const upvotes = votes.size;
      const upvotesVerified = votes.docs.filter((v) => v.data().verified === true).length;
      const q = snap.data()!;
      counted = {
        prev: (q.upvotes as number) ?? 0,
        next: upvotes,
        unanswered: q.status === 'awaitingResponse',
        body: (q.body as string) ?? '',
      };
      if (q.upvotes !== upvotes || q.upvotesVerified !== upvotesVerified) {
        tx.update(questionRef, { upvotes, upvotesVerified });
      }
    });
    await recountAnswerWeights(event.params.officialUid);

    // One alert per question per threshold value: the eventKey dedupes, so
    // vote churn around the line can't re-nag, while a raised threshold can
    // fire once more when the question reaches the new bar.
    const c = counted as { prev: number; next: number; unanswered: boolean; body: string } | null;
    if (!c || !c.unanswered || c.next <= c.prev) return;
    const official = await db.doc(`officials/${event.params.officialUid}`).get();
    if (!official.exists) return;
    const threshold =
      (official.data()!.upvoteAlertThreshold as number | undefined) ??
      DEFAULT_UPVOTE_ALERT_THRESHOLD;
    if (c.prev < threshold && c.next >= threshold) {
      await sendNotification(
        event.params.officialUid,
        `upvotes-${event.params.questionId}-${threshold}`,
        {
          type: 'question',
          title: `${c.next} people want this answered`,
          titleEs: `${c.next} personas quieren que se responda esto`,
          body: excerpt(c.body),
          bodyEs: excerpt(c.body),
          link: `/official/${event.params.officialUid}?q=${event.params.questionId}`,
        }
      );
    }
  }
);

export const onQuestionCreated = onDocumentCreated(
  'officials/{officialUid}/questions/{questionId}',
  async (event) => {
    await bumpOfficialCounters(event.id, event.params.officialUid, {
      questionsAsked: 1,
      questionsPending: 1,
    });
    await recountAnswerWeights(event.params.officialUid);
    const q = event.data?.data();
    await sendNotification(
      event.params.officialUid,
      `${event.id}-asked`,
      {
        type: 'question',
        title: 'New question in your AMA',
        titleEs: 'Nueva pregunta en tu AMA',
        body: excerpt(q?.body),
        bodyEs: excerpt(q?.body),
        link: `/official/${event.params.officialUid}?q=${event.params.questionId}`,
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
    await bumpOfficialCounters(event.id, event.params.officialUid, {
      questionsResponded: 1,
      // Answering a question the sweep already aged into "ignored" doesn't
      // touch pending - it was no longer counted there.
      ...(withinPendingWindow(after.createdAt) ? { questionsPending: -1 } : {}),
    });
    await recountAnswerWeights(event.params.officialUid);
    const official = await db.doc(`officials/${event.params.officialUid}`).get();
    await sendNotification(
      after.authorUid as string,
      `${event.id}-responded`,
      {
        type: 'response',
        title: `${official.data()?.name ?? 'The official'} responded to your question`,
        titleEs: `${official.data()?.name ?? 'El oficial'} respondió a tu pregunta`,
        body: excerpt(after.response),
        bodyEs: excerpt(after.response),
        link: `/official/${event.params.officialUid}?q=${event.params.questionId}`,
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
        // Status flips deliberately do NOT notify anyone: a verdict is a
        // community vote, and notifications are reserved for things a person
        // can respond to (questions, responses, replies), not vote outcomes.
        if (prevStatus !== nextStatus) {
          officialSnap = await tx.get(officialRef);
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
    // A verdict flip moves the question between weight buckets.
    await recountAnswerWeights(event.params.officialUid);
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
  // Unspent verification credits go with the account (the purchase records
  // in verificationPurchases stay, as the store's ledger does).
  await db.doc(`verificationCredits/${uid}`).delete().catch(() => {});

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
  // parsePlatformUrl follows hub pages to their per-policy subpages and
  // throws on an unrecognized layout rather than returning nothing - a site
  // redesign must fail the sync, not archive the platform.
  const parsed = await parsePlatformUrl(sourceUrl, fetchPageHtml);

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

/**
 * Nightly recount of every official's pending-question counter. Triggers keep
 * questionsPending in step as questions arrive and get answered; only this
 * sweep moves a question from pending to ignored as it crosses the week line
 * (and it self-heals any counter drift while it's at it).
 */
export const sweepPendingQuestions = onSchedule(
  { schedule: '15 6 * * *', timeZone: 'America/Chicago' },
  async () => {
    const officials = await db.collection('officials').get();
    for (const o of officials.docs) {
      try {
        if ((o.data().questionsAsked ?? 0) === 0 && (o.data().questionsPending ?? 0) === 0) continue;
        const open = await db
          .collection(`officials/${o.id}/questions`)
          .where('status', '==', 'awaitingResponse')
          .get();
        const pending = open.docs.filter((q) => withinPendingWindow(q.data().createdAt)).length;
        if ((o.data().questionsPending ?? 0) !== pending) {
          await o.ref.update({ questionsPending: pending });
        }
        // Questions crossing the week line also move between weight buckets,
        // and this recount backfills answerWeights for officials provisioned
        // before weighting existed.
        await recountAnswerWeights(o.id);
      } catch (err) {
        console.error(`Pending sweep failed for ${o.id}:`, err);
      }
    }
  }
);

/**
 * Voting milestones for the deadline reminders. Mirror of VOTING_MILESTONES
 * in src/constants/elections.ts (the app package and this one don't share
 * code); keep both in sync when the Board of Elections changes a date.
 */
const VOTING_MILESTONES: {
  date: string;
  title: string;
  titleEs: string;
  body: string;
  bodyEs: string;
}[] = [
  {
    date: '2026-10-01',
    title: 'Early voting starts',
    titleEs: 'La votación anticipada empieza',
    body: 'Any Chicago voter can vote early at 137 S. State St. starting today. Ward sites open October 19.',
    bodyEs: 'Desde hoy, cualquier votante de Chicago puede votar por anticipado en 137 S. State St. Los sitios de los distritos abren el 19 de octubre.',
  },
  {
    date: '2026-10-06',
    title: 'Last day to register by mail',
    titleEs: 'Último día para registrarte por correo',
    body: 'Mail registrations must be postmarked today. Online registration stays open through October 18, and in-person registration runs through election day with two forms of ID.',
    bodyEs: 'El registro por correo debe llevar matasellos de hoy. El registro en línea sigue abierto hasta el 18 de octubre, y el registro en persona sigue hasta el día de la elección con dos formas de identificación.',
  },
  {
    date: '2026-10-18',
    title: 'Last day to register online',
    titleEs: 'Último día para registrarte en línea',
    body: 'Online registration closes today (needs an Illinois license or state ID). After this, register in person at any early voting site or polling place with two forms of ID.',
    bodyEs: 'El registro en línea cierra hoy (requiere una licencia o identificación estatal de Illinois). Después, regístrate en persona en cualquier sitio de votación anticipada o lugar de votación con dos formas de identificación.',
  },
  {
    date: '2026-10-19',
    title: 'Early voting opens in every ward',
    titleEs: 'La votación anticipada abre en cada distrito',
    body: 'One early voting site per ward opens today, and any Chicago voter can use any site.',
    bodyEs: 'Hoy abre un sitio de votación anticipada en cada distrito, y cualquier votante de Chicago puede usar cualquier sitio.',
  },
  {
    date: '2026-10-29',
    title: 'Last day to apply for a mail ballot',
    titleEs: 'Último día para pedir una boleta por correo',
    body: 'Mail ballot applications close today. Return your ballot by mail or at any secured drop box; it must be postmarked by November 3.',
    bodyEs: 'Las solicitudes de boleta por correo cierran hoy. Devuelve tu boleta por correo o en cualquier buzón seguro; debe llevar matasellos a más tardar el 3 de noviembre.',
  },
  {
    date: '2026-11-03',
    title: 'General election day',
    titleEs: 'Día de la elección general',
    body: 'Polls are open 6 am to 7 pm at your precinct or any vote center in the city. Same-day registration is available with two forms of ID.',
    bodyEs: 'Las urnas abren de 6 am a 7 pm en tu precinto o en cualquier centro de votación de la ciudad. Puedes registrarte el mismo día con dos formas de identificación.',
  },
  {
    date: '2027-02-23',
    title: 'Municipal election day',
    titleEs: 'Día de la elección municipal',
    body: 'Mayor, city clerk, city treasurer, your alderman, and your police district council are on the ballot. Polls are open 6 am to 7 pm.',
    bodyEs: 'En la boleta están la alcaldía, la secretaría y la tesorería de la ciudad, tu concejal y tu consejo de distrito policial. Las urnas abren de 6 am a 7 pm.',
  },
];

/** Whole days from today (Chicago) to an ISO date. */
function daysUntilChicago(iso: string): number {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const [ty, tm, td] = today.split('-').map(Number);
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/**
 * Deadline reminders for everyone: the day before and the day of each voting
 * milestone, every account gets a notification in its inbox (the same quiet
 * inbox as replies and answers; nothing pushes). One write per user per
 * milestone-day, idempotent by id, so a re-run can't double up.
 */
export const sendDeadlineReminders = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'America/Chicago' },
  async () => {
    const due = VOTING_MILESTONES.map((m) => ({ ...m, days: daysUntilChicago(m.date) })).filter(
      (m) => m.days === 0 || m.days === 1
    );
    if (due.length === 0) return;
    const users = await db.collection('users').select().get();
    for (const m of due) {
      const title = m.days === 0 ? `Today: ${m.title.toLowerCase()}` : `Tomorrow: ${m.title.toLowerCase()}`;
      const titleEs =
        m.days === 0 ? `Hoy: ${m.titleEs.toLowerCase()}` : `Mañana: ${m.titleEs.toLowerCase()}`;
      for (const u of users.docs) {
        try {
          await sendNotification(u.id, `deadline-${m.date}-${m.days}`, {
            type: 'deadline',
            title,
            titleEs,
            body: m.body,
            bodyEs: m.bodyEs,
            link: '/election',
          });
        } catch (err) {
          console.error(`Deadline reminder failed for ${u.id}:`, err);
        }
      }
    }
  }
);

/** Nightly sweep of every candidate whose platform lives on their own site. */
/**
 * Nightly: erase Didit sessions the webhook couldn't (a failed delete), and
 * any session still undecided after DIDIT_SESSION_MAX_AGE_MS, so no ID or
 * face data sits at Didit indefinitely.
 */
export const eraseDiditSessions = onSchedule(
  { schedule: '30 3 * * *', timeZone: 'America/Chicago', secrets: [DIDIT_API_KEY] },
  async () => {
    const pending = await db.collection('verificationSessions').where('erased', '==', false).get();
    const cutoff = Date.now() - DIDIT_SESSION_MAX_AGE_MS;
    let erased = 0;
    for (const d of pending.docs) {
      const s = d.data();
      const created = (s.createdAt as Timestamp | undefined)?.toMillis?.() ?? 0;
      if (s.settled || created < cutoff) {
        if (await eraseDiditSession(d.id)) erased += 1;
      }
    }
    console.log(`Erased ${erased} of ${pending.size} unerased Didit sessions.`);
  }
);

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
  // Same moving rules as production, so the emulator exercises them.
  const reverify = await claimReverify(request.auth.uid);
  const oldWard = reverify?.wardId ?? null;
  await applyVerification(request.auth.uid, { verified: true, wardId });
  if (reverify && oldWard !== wardId) await leaveWard(request.auth.uid, oldWard);
  return { ok: true };
});

/**
 * Start a re-verification for an already-verified citizen: enforce the
 * 90-day window and stamp the clock, in one transaction so two quick taps
 * can't both pass. Null when the person isn't verified yet (a first
 * verification, which has no window).
 */
async function claimReverify(
  uid: string
): Promise<{ at: Timestamp; prev: Timestamp | null; wardId: number | null } | null> {
  const userRef = db.doc(`users/${uid}`);
  return db.runTransaction(async (tx) => {
    const u = (await tx.get(userRef)).data();
    if (!u?.verified) return null;
    if (u.role !== 'citizen') {
      throw new HttpsError(
        'failed-precondition',
        'Official and candidate accounts keep the ward they were set up with.'
      );
    }
    const prev = (u.reverifyAt as Timestamp | undefined) ?? null;
    if (prev && Date.now() - prev.toMillis() < REVERIFY_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', 'You can verify a new address once every 3 months.');
    }
    const at = Timestamp.now();
    tx.update(userRef, { reverifyAt: at });
    return { at, prev, wardId: (u.wardId as number | null | undefined) ?? null };
  });
}

/** Undo a re-verification stamp when no session was actually started. */
async function releaseReverify(uid: string, claim: { prev: Timestamp | null }) {
  await db
    .doc(`users/${uid}`)
    .update({ reverifyAt: claim.prev ?? FieldValue.delete() })
    .catch((err) => console.error(`Could not release reverify clock for ${uid}:`, err));
}

/**
 * Someone verified at a new address in another ward: their standing
 * approval of the old ward's alderman was a constituent's and no longer is,
 * so it's withdrawn (onApprovalWrite rebalances the grade). Citywide
 * officials keep theirs. Everything else they cast stays as recorded.
 */
async function leaveWard(uid: string, oldWard: number | null) {
  if (oldWard == null) return;
  const officials = await db.collection('officials').where('wardId', '==', oldWard).get();
  for (const o of officials.docs) {
    await o.ref.collection('approvals').doc(uid).delete();
  }
}

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
  const uid = request.auth.uid;
  const apiKey = DIDIT_API_KEY.value();
  const mainWorkflowId = DIDIT_WORKFLOW_ID.value();
  if (!apiKey || !mainWorkflowId) {
    throw new HttpsError('failed-precondition', 'Identity verification is not configured yet.');
  }

  // A verified citizen starting a session is re-verifying at a new address.
  const reverify = await claimReverify(uid);
  const withBill = reverify != null && request.data?.method === 'address';
  const workflowId = withBill ? process.env.DIDIT_ADDRESS_WORKFLOW_ID : mainWorkflowId;
  if (!workflowId) {
    await releaseReverify(uid, reverify!);
    throw new HttpsError('failed-precondition', 'Verifying with a bill or statement is not set up yet.');
  }

  // One transaction decides who pays and counts the session: free inside
  // Didit's monthly 500 for the main workflow, otherwise one purchased
  // credit of the right kind. No credit means the app has to sell one first.
  const creditType: CreditType = withBill ? 'bill' : 'id';
  const monthKey = verificationMonthKey();
  const monthRef = db.doc(`verificationUsage/${monthKey}`);
  const creditsRef = db.doc(`verificationCredits/${uid}`);
  let spent: CreditType | null;
  try {
    spent = await db.runTransaction(async (tx) => {
      const month = await tx.get(monthRef);
      const credits = await tx.get(creditsRef);
      const checks = (month.data()?.sessions as number | undefined) ?? 0;
      let spend: CreditType | null = null;
      if (creditType === 'bill' || checks >= FREE_CHECKS_PER_MONTH) {
        const have = (credits.data()?.[creditType] as number | undefined) ?? 0;
        if (have < 1) {
          throw new HttpsError(
            'failed-precondition',
            'Verification needs a payment first. Update the app to pay for it.',
            { paymentRequired: true, productId: productFor(creditType, checks) }
          );
        }
        tx.set(
          creditsRef,
          { [creditType]: have - 1, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        spend = creditType;
      }
      tx.set(
        monthRef,
        { sessions: checks + 1, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return spend;
    });
  } catch (err) {
    if (reverify) await releaseReverify(uid, reverify);
    throw err;
  }

  let url: string | undefined;
  try {
    const resp = await fetch('https://verification.didit.me/v2/session/', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: workflowId, vendor_data: uid }),
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
        uid,
        monthKey,
        settled: false,
        erased: false,
        createdAt: FieldValue.serverTimestamp(),
        ...(reverify
          ? { kind: 'reverify', reverifyAt: reverify.at, prevReverifyAt: reverify.prev }
          : {}),
        ...(spent ? { creditType: spent } : {}),
      });
    } else {
      console.warn('Didit session response had no session_id - slot cannot be released on expiry.');
    }
  } catch (err) {
    // No session was actually started, so give the slot, the credit, and
    // the moving window back.
    if (reverify) await releaseReverify(uid, reverify);
    if (spent) await refundCredit(uid, spent);
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

/** Give back a credit a session spent, when the session never started. */
async function refundCredit(uid: string, type: CreditType) {
  await db
    .doc(`verificationCredits/${uid}`)
    .set({ [type]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch((err) => console.error(`Could not refund a ${type} credit to ${uid}:`, err));
}

/**
 * What starting a verification will cost this person right now, shown before
 * they start: free, covered by a credit they already bought, or the store
 * product to buy (the price comes from the store). Also hands the app the
 * account token every purchase must carry.
 */
export const getVerificationQuote = onCall(APP_CHECK, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = request.auth.uid;
  const user = (await db.doc(`users/${uid}`).get()).data();
  const moving = user?.verified === true;
  const creditType: CreditType = moving && request.data?.method === 'address' ? 'bill' : 'id';
  const [month, credits] = await Promise.all([
    db.doc(`verificationUsage/${verificationMonthKey()}`).get(),
    db.doc(`verificationCredits/${uid}`).get(),
  ]);
  const checks = (month.data()?.sessions as number | undefined) ?? 0;
  const free = creditType === 'id' && checks < FREE_CHECKS_PER_MONTH;
  return {
    free,
    creditType,
    credits: (credits.data()?.[creditType] as number | undefined) ?? 0,
    productId: free ? null : productFor(creditType, checks),
    accountToken: accountTokenFor(uid),
  };
});

/**
 * Turn a store purchase into a verification credit, after checking it with
 * the store. Idempotent: the same transaction redeemed again (an app restart
 * replaying an unfinished purchase) returns the balance without adding to it.
 */
export const redeemVerificationPurchase = onCall(APP_CHECK, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = request.auth.uid;
  const platform = request.data?.platform;
  const productId = request.data?.productId;
  const token = request.data?.token;
  if (typeof productId !== 'string' || typeof token !== 'string' || !token) {
    throw new HttpsError('invalid-argument', 'Missing purchase details.');
  }

  let purchase: VerifiedPurchase;
  try {
    if (platform === 'ios') {
      purchase = await verifyApplePurchase(token, uid);
    } else if (platform === 'android') {
      purchase = await verifyGooglePurchase(productId, token, uid);
    } else if (platform === 'emulator' && process.env.FUNCTIONS_EMULATOR) {
      purchase = { store: 'emulator', transactionId: token, productId, sandbox: true };
    } else {
      throw new HttpsError('invalid-argument', 'Unknown store.');
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (err instanceof PurchaseRejected) throw new HttpsError('permission-denied', err.message);
    console.error(`Purchase check failed for ${uid}:`, err);
    throw new HttpsError('unavailable', 'Could not confirm the purchase with the store. Try again shortly.');
  }

  const type = creditForProduct(purchase.productId);
  if (!type) throw new HttpsError('invalid-argument', `Unknown product ${purchase.productId}.`);
  const recordRef = db.doc(`verificationPurchases/${purchase.store}-${purchase.transactionId}`);
  const creditsRef = db.doc(`verificationCredits/${uid}`);
  const credits = await db.runTransaction(async (tx) => {
    const record = await tx.get(recordRef);
    const current = await tx.get(creditsRef);
    const have = (current.data()?.[type] as number | undefined) ?? 0;
    if (record.exists) {
      if (record.data()!.uid !== uid) {
        throw new HttpsError('permission-denied', 'This purchase was already used by another account.');
      }
      return have;
    }
    tx.create(recordRef, {
      uid,
      store: purchase.store,
      transactionId: purchase.transactionId,
      productId: purchase.productId,
      creditType: type,
      sandbox: purchase.sandbox,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(creditsRef, { [type]: have + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return have + 1;
  });
  return { creditType: type, credits };
});

/**
 * Didit webhook - the only writer of `verified` in production.
 *
 * Configure in Didit: dashboard -> Webhooks, pointed at this function's URL;
 * store the shown secret as DIDIT_WEBHOOK_SECRET. Signature scheme per
 * https://docs.didit.me/integration/webhooks: HMAC-SHA256 over the raw body
 * in X-Signature, with X-Timestamp freshness (300s).
 *
 * One verified human, one verified account: the document's issuing state
 * and number become a keyed one-way code (identityCode) claimed in
 * `identityClaims/{code}` (no security rule matches that path, so clients
 * can never touch it). A document that already verified a different uid is
 * refused. deleteAccount releases the claim.
 *
 * Nothing stays at Didit: once a final result is handled, the session is
 * erased there, face data included (eraseDiditSession); the nightly sweep
 * retries failures and erases sessions left undecided for a week.
 *
 * Verified always comes with a ward: the address Didit read (proof of
 * address first, then the ID) is matched to a Chicago ward (see ward.ts).
 * An address outside Chicago, or none we can read, verifies nothing; the
 * person gets a notification saying why and how to try again, and their
 * identity is not claimed, so a second attempt with a current ID can pass.
 * Someone already verified is moving (Settings): a new ward replaces the old
 * one, and no ward found leaves them exactly as they were.
 */
export const diditWebhook = onRequest(
  { secrets: [DIDIT_WEBHOOK_SECRET, DIDIT_API_KEY, IDENTITY_HASH_KEY] },
  async (req, res) => {
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
  const terminal =
    sessionId != null && status != null && ['Approved', 'Declined', 'Abandoned', 'Expired'].includes(status);
  if (terminal) await settleVerificationSlot(sessionId!, status!);
  // Once a final result is handled, everything the app keeps is written, so
  // Didit's copy of the session (ID images, selfie, extracted fields) is
  // erased. A 500 keeps it so Didit can deliver again.
  const reply = async (code: number, message: string) => {
    if (code === 200 && terminal) await eraseDiditSession(sessionId!);
    res.status(code).send(message);
  };

  // Only a final Approved decision mints verified=true. Everything else
  // (Declined / In Review / Abandoned / Expired / progress events) is
  // acknowledged and ignored.
  if (!uid || status !== 'Approved') {
    await reply(200, 'Not an approval.');
    return;
  }

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    // The account may have been deleted between session and webhook. A 200
    // stops Didit from retrying a verification that can never land.
    console.warn(`Approved session for missing user ${uid} - profile not found.`);
    await reply(200, 'No such user.');
    return;
  }
  // Didit can deliver the same approval more than once; the first delivery
  // that reaches a result records it, and the rest are acknowledged only.
  const sessionRef = sessionId ? db.doc(`verificationSessions/${sessionId}`) : null;
  if (sessionRef && (await sessionRef.get()).data()?.outcome) {
    await reply(200, 'Already applied.');
    return;
  }
  const recordOutcome = async (outcome: string) => {
    if (sessionRef) await sessionRef.set({ outcome }, { merge: true });
  };
  const current = userSnap.data()!;
  // Already verified: this is someone verifying a new address (Settings).
  const moving = current.verified === true;
  const oldWard = (current.wardId as number | null | undefined) ?? null;

  // The decision normally rides on the webhook; fetch it when the address
  // isn't there.
  let decision = body.decision;
  if (decisionAddresses(decision).length === 0 && sessionId) {
    decision = (await fetchDiditDecision(sessionId)) ?? decision;
  }

  let ward: WardResult;
  try {
    ward = await resolveWard(decisionAddresses(decision));
  } catch (err) {
    // The geocoder failed, not the person. A 500 has Didit deliver again.
    console.error(`Ward lookup failed for session ${sessionId}:`, err);
    await reply(500, 'Ward lookup unavailable, retry.');
    return;
  }
  const noteKey = `verify-${sessionId ?? uid}`;

  if (ward.kind !== 'ward') {
    const outside = ward.kind === 'outside';
    console.warn(
      `Approved session ${sessionId} placed in no ward: ${outside ? 'address outside Chicago' : 'no locatable address'}.`
    );
    await recordOutcome(outside ? 'outside-chicago' : 'no-address');
    // Someone already verified keeps what they had; a first verification
    // grants nothing without a ward.
    const note = moving
      ? {
          title: outside
            ? 'The address we read is outside Chicago'
            : 'We couldn’t read an address from your ID',
          titleEs: outside
            ? 'La dirección que leímos está fuera de Chicago'
            : 'No pudimos leer una dirección en tu identificación',
          body:
            oldWard != null
              ? `Your verification and your ward (the ${wardLabelEn(oldWard)}) stay as they were.`
              : 'Your verification stays as it was.',
          bodyEs:
            oldWard != null
              ? `Tu verificación y tu distrito (Distrito ${oldWard}) siguen igual.`
              : 'Tu verificación sigue igual.',
        }
      : outside
        ? {
            title: 'Your ID shows an address outside Chicago',
            titleEs: 'Tu identificación muestra una dirección fuera de Chicago',
            body: 'Verified status is for Chicago residents. If you live in Chicago now, verify again with an ID that shows your current address.',
            bodyEs:
              'La verificación es para residentes de Chicago. Si ahora vives en Chicago, verifícate de nuevo con una identificación que muestre tu dirección actual.',
          }
        : {
            title: 'We couldn’t read a Chicago address from your ID',
            titleEs: 'No pudimos leer una dirección de Chicago en tu identificación',
            body: 'Verification places you in your ward, so it needs your home address. Verify again with an ID that shows it, like an Illinois driver’s license or state ID.',
            bodyEs:
              'La verificación te ubica en tu distrito, así que necesita tu domicilio. Verifícate de nuevo con una identificación que lo muestre, como una licencia de conducir o identificación estatal de Illinois.',
          };
    await sendNotification(uid, noteKey, {
      type: 'verification',
      ...note,
      link: moving ? '/settings' : '/verify',
    });
    await reply(200, 'Approved, but not a Chicago ward address.');
    return;
  }

  // The one-human-one-account code for this document.
  const idv = decision?.id_verifications?.[0] ?? {};
  const docKey = identityCode(idv.issuing_state, idv.document_number);
  const oldClaim = (current.identityClaimId as string | null | undefined) ?? null;
  if (docKey) {
    const claimed = await db.runTransaction(async (tx) => {
      const mapRef = db.doc(`identityClaims/${docKey}`);
      const oldRef = oldClaim && oldClaim !== docKey ? db.doc(`identityClaims/${oldClaim}`) : null;
      const existing = await tx.get(mapRef);
      const old = oldRef ? await tx.get(oldRef) : null;
      if (existing.exists && existing.data()!.uid !== uid) return false;
      tx.set(mapRef, { uid, updatedAt: FieldValue.serverTimestamp() });
      // A new document (a renewed license) replaces the old claim, so the
      // old one doesn't stay locked to this account forever.
      if (oldRef && old?.data()?.uid === uid) tx.delete(oldRef);
      return true;
    });
    if (!claimed) {
      console.warn('Duplicate identity: document already verified another uid.');
      await recordOutcome('duplicate-identity');
      await reply(200, 'Identity already verified on another account.');
      return;
    }
  } else {
    console.warn('Approved session carried no document identity - dedup not enforced.');
  }

  await userRef.update({
    verified: true,
    wardId: ward.wardId,
    identityClaimId: docKey ?? oldClaim,
  });
  await recordOutcome(moving ? 'moved' : 'verified');

  // A first verification shows up live in the app. Someone who moved left
  // the app for Didit, so tell them where they landed.
  if (moving) {
    const changed = oldWard !== ward.wardId;
    if (changed) await leaveWard(uid, oldWard);
    await sendNotification(uid, noteKey, {
      type: 'verification',
      title: changed
        ? `Your ward is now the ${wardLabelEn(ward.wardId)}`
        : `Your address is still in the ${wardLabelEn(ward.wardId)}`,
      titleEs: changed
        ? `Ahora eres del Distrito ${ward.wardId}`
        : `Tu dirección sigue en el Distrito ${ward.wardId}`,
      body: changed
        ? oldWard != null
          ? `Moved from the ${wardLabelEn(oldWard)}.`
          : ''
        : 'The address we read is in the same ward as before, so nothing changed. If you moved, your ID may still show your old address.',
      bodyEs: changed
        ? oldWard != null
          ? `Antes: Distrito ${oldWard}.`
          : ''
        : 'La dirección que leímos está en el mismo distrito que antes, así que nada cambió. Si te mudaste, tu identificación quizá todavía muestra tu dirección anterior.',
      link: '/settings',
    });
  }

  await reply(200, 'OK');
  }
);

/**
 * A session's full decision from Didit's API, for the rare webhook that
 * arrives without the address on it. Null on any failure.
 */
async function fetchDiditDecision(sessionId: string): Promise<unknown | null> {
  const apiKey = DIDIT_API_KEY.value();
  if (!apiKey) return null;
  try {
    const resp = await fetch(
      `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`,
      { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(10_000) }
    );
    if (!resp.ok) {
      console.warn(`Didit decision fetch for ${sessionId} failed: ${resp.status}`);
      return null;
    }
    return await resp.json();
  } catch (err) {
    console.warn(`Didit decision fetch for ${sessionId} threw:`, err);
    return null;
  }
}
