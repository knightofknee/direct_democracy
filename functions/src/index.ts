import * as crypto from 'crypto';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
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
/** A campaign page this size is already far past any real platform. */
const MAX_PAGE_BYTES = 5 * 1024 * 1024;

/**
 * Fetch one page of a campaign site for platform sync: https only, on the
 * campaign's own host (or its www twin), even after redirects, within 15
 * seconds and 5 MB. A hostile or hacked site can't point the sync anywhere
 * else or stall it.
 */
async function fetchPageHtml(url: string, siteHost: string): Promise<string> {
  const bare = (h: string) => h.replace(/^www\./, '');
  const allowed = (u: string) => {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' && bare(parsed.host) === bare(siteHost);
  };
  if (!allowed(url)) throw new Error(`Refusing to fetch ${url}: not an https page on ${siteHost}.`);
  const resp = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!allowed(resp.url || url)) throw new Error(`Refusing ${url}: it redirected off ${siteHost}.`);
  if (!resp.ok) throw new Error(`Fetching ${url} failed: ${resp.status}`);
  if (Number(resp.headers.get('content-length') ?? 0) > MAX_PAGE_BYTES) {
    throw new Error(`Refusing ${url}: larger than ${MAX_PAGE_BYTES} bytes.`);
  }
  const text = await resp.text();
  if (text.length > MAX_PAGE_BYTES) throw new Error(`Refusing ${url}: larger than ${MAX_PAGE_BYTES} bytes.`);
  return text;
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
import {
  decisionAddresses,
  districtsForPoint,
  pointForAddress,
  resolveWard,
  wardForPoint,
  wardLabelEn,
  type Districts,
  type WardResult,
} from './ward';
import { judgeRate, judgeWardPost, RATE_LIMITS, type RateBucket } from './posting';
import { syncCouncilMembers, syncRollCalls, syncUpcomingMeetings } from './council';

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
function withinPendingWindow(createdAt: unknown, claimedAt?: unknown): boolean {
  const millis = (createdAt as Timestamp | null | undefined)?.toMillis?.();
  // A missing timestamp means the serverTimestamp hasn't landed - brand new.
  if (millis == null) return true;
  // The ignore clock starts at claim: a question asked while nobody was
  // answering from the profile gets its week from the day the official
  // claimed it, not from the day it was asked.
  const claimed = (claimedAt as Timestamp | null | undefined)?.toMillis?.() ?? 0;
  return Date.now() - Math.max(millis, claimed) < PENDING_WINDOW_MS;
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

/** Current day key in Chicago time, e.g. "2026-08-14". */
function verificationDayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

/*
 * Limits on the free checks (2026-09-28). Every session that is opened and
 * then abandoned or declined keeps its slot in Didit's free 500, so without
 * these one person starting and quitting over and over (or a few new
 * accounts doing it) could spend the month's free checks and leave everyone
 * else paying. Paid sessions are never limited: the person pays for each.
 *
 * - One open session per account: asking again within REUSE_OPEN_SESSION_MS
 *   hands back the same link instead of starting (and counting) another.
 * - FREE_ATTEMPTS_PER_ACCOUNT free sessions per account per rolling 90 days
 *   (a failed photo and a retry fit; a loop does not). Past that, a check
 *   costs what it costs after the 500.
 * - Past EMAIL_GATE_AFTER_PER_DAY free sessions app-wide in a Chicago day,
 *   a free check needs an account whose identity costs something to make:
 *   a confirmed email, or Google / Apple sign-in. A made-up address is the
 *   cheapest account there is; a real surge (a post that takes off) passes
 *   straight through for everyone who confirms. Crossing the line notifies
 *   the operator.
 * An unopened link that expires gives its free attempt back, like its slot.
 * State lives in verificationLimits/{uid} (no rule matches: Admin SDK only).
 */
const FREE_ATTEMPTS_PER_ACCOUNT = 3;
const FREE_ATTEMPT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const EMAIL_GATE_AFTER_PER_DAY = 100;
const REUSE_OPEN_SESSION_MS = 24 * 60 * 60 * 1000;
/** Two taps at once must not both start a session. */
const START_LOCK_MS = 60 * 1000;

type FreeCheckBlock = 'month' | 'attempts' | null;

/** Why a main-workflow check would not be free right now, or null if it is. */
function freeCheckBlock(checksThisMonth: number, freeStarts: number[], now: number): FreeCheckBlock {
  if (checksThisMonth >= FREE_CHECKS_PER_MONTH) return 'month';
  if (freeStarts.filter((t) => t > now - FREE_ATTEMPT_WINDOW_MS).length >= FREE_ATTEMPTS_PER_ACCOUNT) {
    return 'attempts';
  }
  return null;
}

/*
 * App Review accounts (2026-09-29). Apple reviews each in-app purchase and has
 * to reach it, but inside the month's free 500 an ID check is free and a bill
 * move sells only the reduced price, so a reviewer never sees the other two
 * products. `verificationLimits/{uid}.reviewPricing` (Admin SDK only, set by
 * `npm run review-account`) prices that one account as if the month were
 * inside the 500 ('within500') or past it ('past500'), whatever the real
 * count is. It also drops what stops a flow from being shown twice: the free
 * attempt count, the 90-day move window, handing back an open session, and
 * the busy-day email gate. Purchases are still checked with the store.
 */
type ReviewPricing = 'within500' | 'past500';

function reviewPricingOf(limits: FirebaseFirestore.DocumentData | undefined): ReviewPricing | null {
  const r = limits?.reviewPricing;
  return r === 'within500' || r === 'past500' ? r : null;
}

/** The month's check count as this account's prices see it. */
function pricedChecks(checks: number, review: ReviewPricing | null): number {
  if (review === 'past500') return Math.max(checks, FREE_CHECKS_PER_MONTH);
  if (review === 'within500') return 0;
  return checks;
}

/** freeCheckBlock, with a review account's pricing in place of the real month. */
function freeCheckBlockFor(
  checks: number,
  freeStarts: number[],
  now: number,
  review: ReviewPricing | null
): FreeCheckBlock {
  if (review) return pricedChecks(checks, review) >= FREE_CHECKS_PER_MONTH ? 'month' : null;
  return freeCheckBlock(checks, freeStarts, now);
}

/** A confirmed email, or an account from Google / Apple sign-in. */
function identityCostsSomething(token: { email_verified?: boolean; firebase?: { sign_in_provider?: string } }): boolean {
  const provider = token.firebase?.sign_in_provider;
  return token.email_verified === true || provider === 'google.com' || provider === 'apple.com';
}

/** An open session this account can pick up again, if there is one. */
function reusableSession(
  limits: FirebaseFirestore.DocumentData | undefined,
  method: 'id' | 'address'
): { sessionId: string; url: string } | null {
  const open = limits?.open as
    | { sessionId: string; url: string; method: string; at: Timestamp }
    | undefined;
  if (!open || open.method !== method) return null;
  if (open.at.toMillis() < Date.now() - REUSE_OPEN_SESSION_MS) return null;
  return { sessionId: open.sessionId, url: open.url };
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
      const limitsRef = db.doc(`verificationLimits/${session.uid}`);
      const limits = await tx.get(limitsRef);
      tx.update(sessionRef, { settled: true, finalStatus: status });
      // The session is over, so it is no longer the one to hand back; and a
      // free one that expired unopened gives its free attempt back.
      const limitsUpdate: Record<string, unknown> = {};
      if ((limits.data()?.open as { sessionId?: string } | undefined)?.sessionId === sessionId) {
        limitsUpdate.open = FieldValue.delete();
      }
      if (status === 'Expired' && session.freeAt) {
        const freeAt = (session.freeAt as Timestamp).toMillis();
        limitsUpdate.freeStarts = ((limits.data()?.freeStarts ?? []) as Timestamp[]).filter(
          (t) => t.toMillis() !== freeAt
        );
      }
      if (limits.exists && Object.keys(limitsUpdate).length) tx.update(limitsRef, limitsUpdate);
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
        if (session.freeAt && session.dayKey) {
          counters.freeByDay = { [session.dayKey as string]: FieldValue.increment(-1) };
        }
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
  const c = event.data?.data();
  const authorUid = c?.authorUid;
  // Counted even when the post limit refuses it below: the refusal deletes
  // the concern, and onConcernDeleted takes the count back off.
  await db.runTransaction(async (tx) => {
    if (!(await claimEvent(tx, event.id))) return;
    const stat = await readStat(tx, authorUid, 1);
    writeStat(tx, stat, 'concerns', 1);
    markEvent(tx, event.id);
  });
  if (c?.scope === 'ward' && typeof c.wardId === 'number' && event.data) {
    await gateWardPost(`${event.id}-ward`, authorUid, c.wardId, event.data.ref, {
      createdAt: c.createdAt,
      excerpt: excerpt(c.title),
      link: '/ward',
    });
  }
  if (c?.scope === 'city' && event.data) {
    await gateRate(`${event.id}-rate`, authorUid, 'cityConcerns', event.data.ref, {
      createdAt: c.createdAt,
      excerpt: excerpt(c.title),
      link: '/',
    });
  }
});

/**
 * Hold one ward post (a ward concern or a question to an alderman) to the
 * posting limits in posting.ts: record it in the author's per-ward ledger
 * and home-ward lock, or delete it and tell the author when they can post
 * there again. Its own transaction and once-guard, so a redelivered event
 * never counts a post twice. Returns true when the post was refused.
 */
async function gateWardPost(
  eventKey: string,
  authorUid: unknown,
  wardId: number,
  postRef: FirebaseFirestore.DocumentReference,
  post: { createdAt: unknown; excerpt: string; link: string }
): Promise<boolean> {
  if (typeof authorUid !== 'string') return false;
  const userRef = db.doc(`users/${authorUid}`);
  const ledgerRef = userRef.collection('wardPosts').doc(String(wardId));
  const at = post.createdAt instanceof Timestamp ? post.createdAt.toMillis() : Date.now();
  let refused: { reason: 'home' | 'away' | 'wards'; nextAt: number } | null = null;

  await db.runTransaction(async (tx) => {
    refused = null;
    if (!(await claimEvent(tx, eventKey))) return;
    const [user, ledger] = await Promise.all([tx.get(userRef), tx.get(ledgerRef)]);
    if (!user.exists) {
      markEvent(tx, eventKey);
      return;
    }
    const u = user.data()!;
    const verdict = judgeWardPost({
      at,
      wardId,
      homeWardId: (u.wardId as number | null | undefined) ?? null,
      times: ((ledger.data()?.times ?? []) as Timestamp[]).map((t) => t.toMillis()),
      homePosts: (u.homeWardPosts as number | undefined) ?? 0,
      lockedUntil: (u.wardLockedUntil as Timestamp | null | undefined)?.toMillis() ?? null,
      recentWards: Object.fromEntries(
        Object.entries((u.recentPostWards ?? {}) as Record<string, Timestamp>).map(([w, t]) => [
          w,
          t.toMillis(),
        ])
      ),
    });
    if (verdict.ok) {
      tx.set(ledgerRef, { times: verdict.times.map((t) => Timestamp.fromMillis(t)) });
      tx.update(userRef, {
        recentPostWards: Object.fromEntries(
          Object.entries(verdict.recentWards).map(([w, t]) => [w, Timestamp.fromMillis(t)])
        ),
        ...(verdict.home
          ? {
              homeWardPosts: verdict.home.posts,
              wardLockedUntil:
                verdict.home.lockedUntil == null ? null : Timestamp.fromMillis(verdict.home.lockedUntil),
            }
          : {}),
      });
    } else {
      tx.delete(postRef);
      refused = { reason: verdict.reason, nextAt: verdict.nextAt };
    }
    markEvent(tx, eventKey);
  });

  const r = refused as { reason: 'home' | 'away' | 'wards'; nextAt: number } | null;
  if (!r) return false;
  const when = (locale: string) =>
    new Date(r.nextAt).toLocaleString(locale, {
      timeZone: 'America/Chicago',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  const quoted = post.excerpt ? `"${post.excerpt}"` : 'your post';
  const quotedEs = post.excerpt ? `"${post.excerpt}"` : 'tu publicación';
  await sendNotification(authorUid, `${eventKey}-refused`, {
    type: 'postLimit',
    title: 'Your post was not published',
    titleEs: 'Tu publicación no se publicó',
    body:
      r.reason === 'home'
        ? `We did not publish ${quoted} because you can post up to 3 times a day in your home ward. You can post there again ${when('en-US')}.`
        : r.reason === 'away'
          ? `We did not publish ${quoted} because you can post once a week in a ward that is not your home ward. You can post in the ${wardLabelEn(wardId)} again ${when('en-US')}.`
          : `We did not publish ${quoted} because you can post in up to 5 wards besides your home ward in a week. You can post in another ward again ${when('en-US')}.`,
    bodyEs:
      r.reason === 'home'
        ? `No publicamos ${quotedEs} porque puedes publicar hasta 3 veces al día en tu distrito. Puedes volver a publicar allí el ${when('es-MX')}.`
        : r.reason === 'away'
          ? `No publicamos ${quotedEs} porque en un distrito que no es el tuyo puedes publicar una vez por semana. Puedes volver a publicar en el Distrito ${wardId} el ${when('es-MX')}.`
          : `No publicamos ${quotedEs} porque en una semana puedes publicar en hasta 5 distritos además del tuyo. Puedes volver a publicar en otro distrito el ${when('es-MX')}.`,
    link: post.link,
  });
  return true;
}

/** What each refusal notice says the limit is, in both languages. */
const RATE_NOTICE: Record<Exclude<RateBucket, 'wardChanges' | 'edits' | 'addressLookups'>, { en: string; es: string }> = {
  cityConcerns: {
    en: 'you can raise up to 2 citywide concerns a day',
    es: 'puedes plantear hasta 2 preocupaciones de toda la ciudad al día',
  },
  cityQuestions: {
    en: 'you can ask citywide officials up to 3 questions a day',
    es: 'puedes hacer hasta 3 preguntas al día a oficiales de toda la ciudad',
  },
  electionQuestions: {
    en: 'you can ask up to 3 election questions a day',
    es: 'puedes hacer hasta 3 preguntas electorales al día',
  },
  comments: {
    en: 'you can post up to 20 comments an hour and 100 a day',
    es: 'puedes publicar hasta 20 comentarios por hora y 100 al día',
  },
  reports: {
    en: 'you can file up to 10 reports a day',
    es: 'puedes presentar hasta 10 reportes al día',
  },
};

/**
 * Hold one post to its bucket's rate limit (posting.ts RATE_LIMITS): record
 * it in the author's ledger, or delete it in the same transaction and tell
 * the author when they can post again. One notice per bucket per hour, so a
 * flood of refused posts cannot become a flood of notices. Returns true
 * when the post was refused.
 */
async function gateRate(
  eventKey: string,
  authorUid: unknown,
  bucket: Exclude<RateBucket, 'wardChanges' | 'edits' | 'addressLookups'>,
  postRef: FirebaseFirestore.DocumentReference,
  post: { createdAt: unknown; excerpt: string; link: string }
): Promise<boolean> {
  if (typeof authorUid !== 'string') return false;
  const ledgerRef = db.doc(`users/${authorUid}/rateLimits/${bucket}`);
  const at = post.createdAt instanceof Timestamp ? post.createdAt.toMillis() : Date.now();
  let nextAt: number | null = null;
  await db.runTransaction(async (tx) => {
    nextAt = null;
    if (!(await claimEvent(tx, eventKey))) return;
    const ledger = await tx.get(ledgerRef);
    const verdict = judgeRate(
      RATE_LIMITS[bucket],
      ((ledger.data()?.times ?? []) as Timestamp[]).map((t) => t.toMillis()),
      at
    );
    if (verdict.ok) {
      tx.set(ledgerRef, { times: verdict.times.map((t) => Timestamp.fromMillis(t)) });
    } else {
      tx.delete(postRef);
      nextAt = verdict.nextAt;
    }
    markEvent(tx, eventKey);
  });
  const when = nextAt as number | null;
  if (when == null) return false;
  const fmt = (locale: string) =>
    new Date(when).toLocaleString(locale, {
      timeZone: 'America/Chicago',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  const notice = RATE_NOTICE[bucket];
  const report = bucket === 'reports';
  await sendNotification(authorUid, `limit-${authorUid}-${bucket}-${Math.floor(at / 3_600_000)}`, {
    type: 'postLimit',
    title: report ? 'Your report was not filed' : 'Your post was not published',
    titleEs: report ? 'Tu reporte no se presentó' : 'Tu publicación no se publicó',
    body: report
      ? `We did not file your report because ${notice.en}. You can file another ${fmt('en-US')}.`
      : `We did not publish "${post.excerpt}" because ${notice.en}. You can post again ${fmt('en-US')}.`,
    bodyEs: report
      ? `No presentamos tu reporte porque ${notice.es}. Puedes presentar otro el ${fmt('es-MX')}.`
      : `No publicamos "${post.excerpt}" porque ${notice.es}. Puedes volver a publicar el ${fmt('es-MX')}.`,
    link: post.link,
  });
  return true;
}

/**
 * Reports are held to a daily limit, so one account cannot bury the review
 * queue. A refused report is deleted before anyone reviews it.
 */
export const onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
  const r = event.data?.data();
  if (!event.data || !r?.reporterUid) return;
  const refused = await gateRate(`${event.id}-rate`, r.reporterUid, 'reports', event.data.ref, {
    createdAt: r.createdAt,
    excerpt: '',
    link: '/notifications',
  });
  if (refused || typeof r.contentPath !== 'string') return;
  // The queue quotes the reported document itself, never text the reporter
  // typed: a forged excerpt could get an innocent post taken down.
  const target = (await db.doc(r.contentPath).get().catch(() => null))?.data();
  if (!target) return;
  const text =
    r.contentType === 'concern'
      ? `${target.title ?? ''}\n${target.body ?? ''}`
      : r.contentType === 'response'
        ? target.response
        : r.contentType === 'policy'
          ? target.title
          : target.body;
  const authorUid =
    ((r.contentType === 'response' ? target.officialUid : (target.authorUid ?? target.candidateUid)) as
      | string
      | undefined) ??
    (r.authorUid as string | undefined) ??
    null;
  await event.data.ref.update({ excerpt: excerpt(text, 500), authorUid });
  if (authorUid) await shadowbanIfReported(authorUid);
});

/** Distinct accounts with open reports against one person that hide them. */
const SHADOWBAN_REPORTERS = 5;

/**
 * Shadowban (2026-09-29): once 5 different accounts have open reports
 * against a citizen's posts, everything they post is hidden from everyone
 * but them (the app filters moderation/shadowbanned like a block list, and
 * their posts notify nobody) until the weekly review clears or removes
 * them (scripts/moderate.ts). Officials and candidates are never hidden
 * automatically: their answers are public record, reviewed by hand.
 */
async function shadowbanIfReported(uid: string): Promise<void> {
  const user = (await db.doc(`users/${uid}`).get()).data();
  if (!user || (user.role ?? 'citizen') !== 'citizen') return;
  const open = await db.collection('reports').where('authorUid', '==', uid).where('status', '==', 'open').get();
  const reporters = new Set(open.docs.map((d) => d.data().reporterUid as string));
  if (reporters.size < SHADOWBAN_REPORTERS) return;
  await db
    .doc('moderation/shadowbanned')
    .set({ uids: FieldValue.arrayUnion(uid), since: { [uid]: FieldValue.serverTimestamp() } }, { merge: true });
}

async function isShadowbanned(uid: string): Promise<boolean> {
  const uids = ((await db.doc('moderation/shadowbanned').get()).data()?.uids ?? []) as string[];
  return uids.includes(uid);
}

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
  // Never notify someone about their own action, nor about anything a
  // shadowbanned account does (nobody else can see it).
  if (!uid || uid === actorUid) return;
  if (actorUid && (await isShadowbanned(actorUid))) return;
  const id = `n-${eventKey.replace(/[^A-Za-z0-9_-]/g, '').slice(-80)}`;
  // A deleted account keeps no inbox: nothing is written under its uid.
  if (!(await db.doc(`users/${uid}`).get()).exists) return;
  const ref = db.doc(`users/${uid}/notifications/${id}`);
  // A redelivered event rewrites its own notification; only the first
  // delivery reaches the phone.
  const isNew = !(await ref.get()).exists;
  await ref.set({
    ...data,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  if (isNew) await sendPush(uid, id, data);
}

// ── Phone notifications ─────────────────────────────────────────────────

/**
 * Which Settings switch lets a notification type reach the phone
 * (users/{uid}.pushPrefs). Types missing here stay in the notifications
 * tab only: verdicts, verification results, and posting-limit notices are
 * things people see in the app anyway (Brian's call, 2026-09-29).
 * Mirror of PUSH_SWITCHES in src/lib/push.ts.
 */
const PUSH_PREF_FOR_TYPE: Record<string, string> = {
  deadline: 'deadline',
  response: 'answers',
  electionAnswer: 'answers',
  comment: 'comments',
  reply: 'replies',
  credit: 'credits',
  question: 'questions',
};

/**
 * Send one notification to the person's phones through Expo's push
 * service, in the language each phone uses (stored with its token), when
 * their switch for this type is on. Never fails the in-app notification:
 * push is best effort, and a phone Expo reports as gone loses its token.
 */
async function sendPush(
  uid: string,
  notificationId: string,
  data: { type: string; title: string; titleEs: string; body: string; bodyEs: string; link: string }
): Promise<void> {
  const pref = PUSH_PREF_FOR_TYPE[data.type];
  if (!pref) return;
  try {
    const user = (await db.doc(`users/${uid}`).get()).data();
    if (user?.pushPrefs?.[pref] !== true) return;
    const tokens = Object.entries((user.pushTokens ?? {}) as Record<string, { locale?: string }>);
    if (tokens.length === 0) return;
    const messages = tokens.map(([to, t]) => {
      const es = t.locale === 'es';
      return {
        to,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        title: es ? data.titleEs : data.title,
        body: excerpt(es ? data.bodyEs : data.body, 180),
        data: { link: data.link, notificationId },
      };
    });
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
        'content-type': 'application/json',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
    const tickets = ((await resp.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
    const gone = tickets
      .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? messages[i].to : null))
      .filter((to): to is string => to != null);
    if (gone.length) {
      await db
        .doc(`users/${uid}`)
        .update(
          new FieldPath('pushTokens', gone[0]),
          FieldValue.delete(),
          ...gone.slice(1).flatMap((to) => [new FieldPath('pushTokens', to), FieldValue.delete()])
        );
    }
  } catch (err) {
    console.error(`Push to ${uid} failed:`, err);
  }
}

/**
 * A phone belongs to one account at a time. When a push token appears on an
 * account, any other account still holding it (someone signed out without a
 * connection, or reinstalled and signed in as someone else) loses it, so one
 * person's notifications never land on the next person's phone. Owners are
 * kept by token hash in pushTokenOwners (Admin SDK only).
 */
export const onPushTokensChanged = onDocumentWritten('users/{uid}', async (event) => {
  const before = Object.keys((event.data?.before.data()?.pushTokens ?? {}) as object);
  const after = Object.keys((event.data?.after.data()?.pushTokens ?? {}) as object);
  const added = after.filter((token) => !before.includes(token));
  const uid = event.params.uid;
  for (const token of added) {
    const ownerRef = db.doc(`pushTokenOwners/${crypto.createHash('sha256').update(token).digest('hex')}`);
    const previous = (await ownerRef.get()).data()?.uid as string | undefined;
    await ownerRef.set({ uid, at: FieldValue.serverTimestamp() });
    if (previous && previous !== uid) {
      await db
        .doc(`users/${previous}`)
        .update(new FieldPath('pushTokens', token), FieldValue.delete())
        .catch(() => {}); // that account may be gone
    }
  }
});

/** The platform operator (the rules' isAdmin account), for abuse alarms. */
const OPERATOR_EMAIL = 'bricarlis@gmail.com';

async function notifyOperator(eventKey: string, msg: { title: string; body: string }) {
  try {
    const operator = await getAuth().getUserByEmail(OPERATOR_EMAIL);
    await sendNotification(operator.uid, eventKey, {
      type: 'operator',
      title: msg.title,
      titleEs: msg.title,
      body: msg.body,
      bodyEs: msg.body,
      link: '/admin',
    });
  } catch (err) {
    console.error('Could not notify the operator:', msg.title, err);
  }
  console.warn(`[operator] ${msg.title}: ${msg.body}`);
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
    /** Anyone else who hears about it (the official, on an AMA thread). */
    also?: (p: FirebaseFirestore.DocumentData, authorName: string) => { uid: string; en: string; es: string }[];
  }
) {
  if (!eventId || !comment) return;
  const parentSnap = await db.doc(parentPath).get();
  if (!parentSnap.exists) return;
  const p = parentSnap.data()!;
  const authorName = (comment.authorName as string) ?? 'Someone';

  const targets = new Map<string, { en: string; es: string; type: 'comment' | 'reply' }>();
  targets.set(p[parent.ownerField] as string, { ...parent.ownerTitle(p, authorName), type: 'comment' });
  for (const extra of parent.also?.(p, authorName) ?? []) {
    if (extra.uid && !targets.has(extra.uid)) targets.set(extra.uid, { en: extra.en, es: extra.es, type: 'comment' });
  }
  // A thread id is a plain document id (rules); anything else is ignored
  // rather than joined into a path.
  if (typeof comment.threadId === 'string' && /^[A-Za-z0-9]{1,40}$/.test(comment.threadId)) {
    const root = await db.doc(`${parentPath}/comments/${comment.threadId}`).get();
    const rootAuthor = root.data()?.authorUid as string | undefined;
    // The person answered (a reply to a reply) hears about it too, once
    // it's confirmed they wrote in this thread: the uid comes from the
    // replier's app, so it's never taken on trust.
    const answered = typeof comment.replyToUid === 'string' ? comment.replyToUid : null;
    let answeredInThread = answered != null && answered === rootAuthor;
    if (answered && !answeredInThread) {
      const thread = await db.collection(`${parentPath}/comments`).where('threadId', '==', comment.threadId).get();
      answeredInThread = thread.docs.some((c) => c.data().authorUid === answered);
    }
    for (const uid of [answeredInThread ? answered : null, rootAuthor]) {
      if (uid && !targets.has(uid)) {
        targets.set(uid, {
          en: `${authorName} replied to your comment`,
          es: `${authorName} respondió a tu comentario`,
          type: 'reply',
        });
      }
    }
  }

  let n = 0;
  for (const [uid, title] of targets) {
    await sendNotification(
      uid,
      `${eventId}-c${n++}`,
      {
        type: title.type,
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
    // Every real comment has an author (rules); an empty create event is
    // the emulator re-announcing a deleted doc, and must not count.
    if (!event.data?.data()?.authorUid) return;
    await applyCommentDelta(
      event.id,
      `concerns/${event.params.concernId}`,
      event.data?.data()?.authorUid,
      1
    );
    // Counted above either way: a refused comment is deleted, and
    // onCommentDeleted takes the count back off. Nobody hears about it.
    const c = event.data?.data();
    if (
      event.data &&
      (await gateRate(`${event.id}-rate`, c?.authorUid, 'comments', event.data.ref, {
        createdAt: c?.createdAt,
        excerpt: excerpt(c?.body, 80),
        link: `/concern/${event.params.concernId}`,
      }))
    ) {
      return;
    }
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

// ── AMA threads ──────────────────────────────────────────────────────────
// officials/{o}/questions/{q}/comments: the conversation under an answered
// question (2026-09-29). Anyone can take part; the official's replies are
// marked in the app. Same comment machinery as the boards.

export const onQuestionCommentCreated = onDocumentCreated(
  'officials/{officialUid}/questions/{questionId}/comments/{commentId}',
  async (event) => {
    const c = event.data?.data();
    if (!c?.authorUid) return; // see onCommentCreated
    const questionPath = `officials/${event.params.officialUid}/questions/${event.params.questionId}`;
    await applyCommentDelta(event.id, questionPath, c.authorUid, 1);
    const link = `/official/${event.params.officialUid}?q=${event.params.questionId}&thread=1`;
    if (
      event.data &&
      (await gateRate(`${event.id}-rate`, c.authorUid, 'comments', event.data.ref, {
        createdAt: c.createdAt,
        excerpt: excerpt(c.body, 80),
        link,
      }))
    ) {
      return;
    }
    await notifyNewComment(event.id, questionPath, c, {
      ownerField: 'authorUid',
      link,
      ownerTitle: (_p, name) => ({
        en: `${name} replied in the conversation on your question`,
        es: `${name} respondió en la conversación sobre tu pregunta`,
      }),
      also: (_p, name) => [
        {
          uid: event.params.officialUid,
          en: `${name} replied to your answer`,
          es: `${name} respondió a tu respuesta`,
        },
      ],
    });
  }
);

export const onQuestionCommentDeleted = onDocumentDeleted(
  'officials/{officialUid}/questions/{questionId}/comments/{commentId}',
  async (event) => {
    const questionPath = `officials/${event.params.officialUid}/questions/${event.params.questionId}`;
    await applyCommentDelta(event.id, questionPath, event.data?.data()?.authorUid, -1);
    await db.recursiveDelete(db.doc(`${questionPath}/comments/${event.params.commentId}`));
  }
);

export const onQuestionCommentVoteWrite = onDocumentWritten(
  'officials/{officialUid}/questions/{questionId}/comments/{commentId}/votes/{voterUid}',
  async (event) =>
    applyCommentVote(
      event.id,
      `officials/${event.params.officialUid}/questions/${event.params.questionId}/comments/${event.params.commentId}`,
      event.params.voterUid,
      event.data?.before.exists ? (event.data.before.data() as BallotDoc) : null,
      event.data?.after.exists ? (event.data.after.data() as BallotDoc) : null
    )
);

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

/** New election questions are held to the daily question limit. */
export const onElectionQuestionCreated = onDocumentCreated(
  'electionQuestions/{questionId}',
  async (event) => {
    const q = event.data?.data();
    if (!event.data || !q?.authorUid) return;
    await gateRate(`${event.id}-rate`, q.authorUid, 'electionQuestions', event.data.ref, {
      createdAt: q.createdAt,
      excerpt: excerpt(q.body),
      link: '/election',
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
    if (!event.data?.data()?.authorUid) return; // see onCommentCreated
    const policyPath = `candidates/${event.params.candidateUid}/policies/${event.params.policyId}`;
    await applyCommentDelta(event.id, policyPath, event.data?.data()?.authorUid, 1);
    const c = event.data?.data();
    if (
      event.data &&
      (await gateRate(`${event.id}-rate`, c?.authorUid, 'comments', event.data.ref, {
        createdAt: c?.createdAt,
        excerpt: excerpt(c?.body, 80),
        link: `/candidate/${event.params.candidateUid}/${event.params.policyId}`,
      }))
    ) {
      return;
    }
    await refreshLatestPolicyComment(policyPath);
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
    await refreshLatestPolicyComment(`candidates/${event.params.candidateUid}/policies/${event.params.policyId}`);
  }
);

/**
 * The policy's newest comment (who, the opening words, when), written on the
 * policy so the candidate's command center lists "comments on your policies"
 * newest first from one query. Recomputed from the comments, so a deleted
 * one never lingers.
 */
async function refreshLatestPolicyComment(policyPath: string): Promise<void> {
  const policyRef = db.doc(policyPath);
  const latest = await policyRef.collection('comments').orderBy('createdAt', 'desc').limit(1).get();
  const c = latest.docs[0]?.data();
  await policyRef
    .update(
      c
        ? {
            lastComment: { authorName: c.authorName ?? '', excerpt: excerpt(c.body, 160) },
            lastCommentAt: c.createdAt ?? FieldValue.serverTimestamp(),
          }
        : { lastComment: FieldValue.delete(), lastCommentAt: FieldValue.delete() }
    )
    .catch(() => {});
}

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
        if (q?.status === 'awaitingResponse' && withinPendingWindow(q?.createdAt, o.claimedAt)) {
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
  const [official, questions] = await Promise.all([
    officialRef.get(),
    db.collection(`officials/${officialUid}/questions`).get(),
  ]);
  // The official may be gone (account deletion mid-event); nothing to grade.
  if (!official.exists) return;
  const claimedAt = official.data()!.claimedAt;
  const weights = { credit: 0, dodged: 0, ignored: 0, pending: 0 };
  for (const q of questions.docs) {
    const w = questionWeight(q.data());
    const d = q.data();
    if (d.status === 'dodged') weights.dodged += w;
    else if (d.response) weights.credit += w;
    else if (withinPendingWindow(d.createdAt, claimedAt)) weights.pending += w;
    else weights.ignored += w;
  }
  // Only write a change: every write here reaches everyone viewing the card.
  const prev = official.data()!.answerWeights as Record<string, number> | undefined;
  if (prev && Object.entries(weights).every(([k, v]) => prev[k] === v)) return;
  await officialRef.update({ answerWeights: weights }).catch(() => {});
}

/**
 * How much a question counts in the answer grade (2026-09-28): a question
 * from a verified resident (of the alderman's ward; any verified Chicagoan
 * for a citywide official) weighs 2, anyone else's 1, plus 1 for every
 * verified resident who joined it. Proven residents decide the grade;
 * everyone else still counts, for less. Questions from before residency was
 * recorded fall back to the verified flags.
 */
function isResidentVote(v: FirebaseFirestore.DocumentData, officialWard: number | null | undefined): boolean {
  if (v.verified !== true) return false;
  return officialWard == null || v.wardId === officialWard;
}

function questionWeight(d: FirebaseFirestore.DocumentData): number {
  const resident = (d.authorResident as boolean | undefined) ?? d.authorVerified === true;
  const joined = (d.upvotesResident as number | undefined) ?? (d.upvotesVerified as number | undefined) ?? 0;
  return (resident ? 2 : 1) + Math.max(0, joined);
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
    const officialWard = (await db.doc(`officials/${event.params.officialUid}`).get()).data()?.wardId as
      | number
      | null
      | undefined;
    await db.runTransaction(async (tx) => {
      counted = null;
      const snap = await tx.get(questionRef);
      if (!snap.exists) return;
      const votes = await tx.get(questionRef.collection('votes'));
      const upvotes = votes.size;
      const upvotesVerified = votes.docs.filter((v) => v.data().verified === true).length;
      const upvotesResident = votes.docs.filter((v) => isResidentVote(v.data(), officialWard)).length;
      const q = snap.data()!;
      counted = {
        prev: (q.upvotes as number) ?? 0,
        next: upvotes,
        unanswered: q.status === 'awaitingResponse',
        body: (q.body as string) ?? '',
      };
      if (
        q.upvotes !== upvotes ||
        q.upvotesVerified !== upvotesVerified ||
        q.upvotesResident !== upvotesResident
      ) {
        tx.update(questionRef, { upvotes, upvotesVerified, upvotesResident });
      }
    });
    // A vote under a question that doesn't exist changes no grade.
    if (!counted) return;
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
    const q = event.data?.data();
    // Every real question has an author (rules); an empty create event is the
    // emulator re-announcing a deleted doc, and must not count.
    if (!q?.authorUid) return;
    // Only a real official's AMA takes questions (rules check it too): a
    // question under a made-up uid would notify whoever holds that uid.
    const official = await db.doc(`officials/${event.params.officialUid}`).get();
    if (!official.exists) {
      await event.data?.ref.delete().catch(() => {});
      return;
    }
    await bumpOfficialCounters(event.id, event.params.officialUid, {
      questionsAsked: 1,
      questionsPending: 1,
    });
    // A question to an alderman is a post in their ward and held to the ward
    // posting limits. A refused one is deleted before the alderman hears of
    // it; onQuestionDeleted then takes back the counters bumped above.
    const wardId = official.data()?.wardId;
    // Whether the asker is a proven resident (verified, and of this ward for
    // an alderman): it doubles the question's weight in the answer grade.
    const author = (await db.doc(`users/${q.authorUid}`).get()).data();
    const authorResident =
      author?.verified === true && (typeof wardId !== 'number' || author?.wardId === wardId);
    await event.data?.ref.update({ authorResident }).catch(() => {});
    if (typeof wardId === 'number' && event.data) {
      const refused = await gateWardPost(`${event.id}-ward`, q?.authorUid, wardId, event.data.ref, {
        createdAt: q?.createdAt,
        excerpt: excerpt(q?.body),
        link: `/official/${event.params.officialUid}`,
      });
      if (refused) return;
    } else if (event.data) {
      // A citywide official (the mayor): the citywide question limit.
      const refused = await gateRate(`${event.id}-rate`, q.authorUid, 'cityQuestions', event.data.ref, {
        createdAt: q.createdAt,
        excerpt: excerpt(q.body),
        link: `/official/${event.params.officialUid}`,
      });
      if (refused) return;
    }
    await recountAnswerWeights(event.params.officialUid);
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
    const claimedAt = (await db.doc(`officials/${event.params.officialUid}`).get()).data()?.claimedAt;
    await bumpOfficialCounters(event.id, event.params.officialUid, {
      questionsResponded: 1,
      // Answering a question the sweep already aged into "ignored" doesn't
      // touch pending - it was no longer counted there.
      ...(withinPendingWindow(after.createdAt, claimedAt) ? { questionsPending: -1 } : {}),
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
      // The verified slice that decides the verdict is the official's own
      // proven residents: verified and of the alderman's ward (any verified
      // Chicagoan for a citywide official). Read from each judgment's own
      // snapshot, so removing one takes it out of exactly the slice it
      // joined. Judgments from binaries before 2026-09-29 carry no ward and
      // count only toward citywide officials' verdicts.
      const officialSnap = await tx.get(officialRef);
      const officialWard = officialSnap.data()?.wardId;
      const decides = (j: FirebaseFirestore.DocumentData) =>
        j.verified === true && (typeof officialWard !== 'number' || j.wardId === officialWard);
      // Everything is computed (and every document read) before the first
      // write, because Firestore rejects a transaction that reads after
      // writing. The question may be gone - an admin takedown of the thread -
      // in which case only the judge's own counter still has to settle.
      const q = snap.exists ? snap.data()! : null;
      let counts: Record<string, unknown> | null = null;
      let prevStatus = '';
      let nextStatus = '';

      if (q) {
        let yes = q.answeredYes ?? 0;
        let no = q.answeredNo ?? 0;
        let yesVerified = q.answeredYesVerified ?? 0;
        let noVerified = q.answeredNoVerified ?? 0;
        if (before) {
          before.answered ? (yes -= 1) : (no -= 1);
          if (decides(before)) before.answered ? (yesVerified -= 1) : (noVerified -= 1);
        }
        if (after) {
          after.answered ? (yes += 1) : (no += 1);
          if (decides(after)) after.answered ? (yesVerified += 1) : (noVerified += 1);
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
      }

      // ── every read is done; writes only from here ──
      if (counts) tx.update(questionRef, counts);

      if (prevStatus !== nextStatus && officialSnap.exists) {
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
 * profile (identity, ward, stats), the block list, and every ballot,
 * approval, and judgment the account cast (the triggers walk the tallies
 * back), so a freed identity can never vote twice. Content stays on the
 * record but is re-attributed to "[deleted]" so no display name outlives its
 * account.
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
  await eraseAccount(uid, { ban: false });
  return { ok: true };
});

/**
 * Everything deleting an account does, for the person's own request and for
 * the operator's (moderationActions). A ban keeps the verified-identity
 * claim, marked banned, so the same ID can never verify another account.
 */
async function eraseAccount(uid: string, { ban }: { ban: boolean }): Promise<void> {
  const profile = await db.doc(`users/${uid}`).get();

  // A deleted account's votes go with it (2026-09-28): every ballot it cast
  // is deleted, and the triggers take each one back out of its tallies. That
  // also means an identity freed below can never vote twice through a new
  // account. Approvals, judgments, and every kind of vote doc (all carry
  // `uid`).
  const officials = await db.collection('officials').listDocuments();
  await Promise.all(officials.map((o) => o.collection('approvals').doc(uid).delete()));
  const [ballots, judgments] = await Promise.all([
    db.collectionGroup('votes').where('uid', '==', uid).get(),
    db.collectionGroup('judgments').where('uid', '==', uid).get(),
  ]);
  const withdrawals = [...ballots.docs.map((d) => d.ref), ...judgments.docs.map((d) => d.ref)];
  for (let i = 0; i < withdrawals.length; i += 400) {
    const batch = db.batch();
    for (const ref of withdrawals.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }

  // Strip the pseudonym off everything the account posted. The text stays:
  // a question and its answer are useful to everyone who reads them later.
  const authored = await Promise.all([
    db.collection('concerns').where('authorUid', '==', uid).get(),
    db.collectionGroup('comments').where('authorUid', '==', uid).get(),
    db.collectionGroup('questions').where('authorUid', '==', uid).get(),
    db.collection('electionQuestions').where('authorUid', '==', uid).get(),
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
  // ever return with a new account; a ban keeps it, marked, so they can't.
  const identityClaimId = profile.exists ? profile.data()!.identityClaimId : null;
  if (identityClaimId) {
    const claimRef = db.doc(`identityClaims/${identityClaimId}`);
    await (ban
      ? claimRef.set({ uid: null, banned: true, bannedAt: FieldValue.serverTimestamp() })
      : claimRef.delete()
    ).catch(() => {});
  }
  // Unspent verification credits go with the account (the purchase records
  // in verificationPurchases stay, as the store's ledger does).
  await db.doc(`verificationCredits/${uid}`).delete().catch(() => {});
  await db.doc(`verificationLimits/${uid}`).delete().catch(() => {});

  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.doc('moderation/shadowbanned').set({ uids: FieldValue.arrayRemove(uid) }, { merge: true });
  await getAuth()
    .deleteUser(uid)
    .catch((err) => {
      if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
    });
}

/** Every post an account wrote (the triggers clean up counts and threads). */
async function removePostsBy(uid: string): Promise<number> {
  const authored = await Promise.all([
    db.collection('concerns').where('authorUid', '==', uid).get(),
    db.collectionGroup('comments').where('authorUid', '==', uid).get(),
    db.collectionGroup('questions').where('authorUid', '==', uid).get(),
    db.collection('electionQuestions').where('authorUid', '==', uid).get(),
  ]);
  const refs = authored.flatMap((snap) => snap.docs.map((d) => d.ref));
  for (const ref of refs) await ref.delete();
  return refs.length;
}

/**
 * The operator's moderation, run from scripts/moderate.ts (Admin SDK only;
 * no client can write moderationActions): remove everything an account
 * posted, or delete the account and ban its ID. Its open reports are
 * marked resolved, and the result is written back on the action.
 */
export const onModerationAction = onDocumentCreated(
  { document: 'moderationActions/{actionId}', timeoutSeconds: 540 },
  async (event) => {
    const a = event.data?.data();
    if (!event.data || !a || a.done || typeof a.uid !== 'string') return;
    const uid = a.uid as string;
    let removed = 0;
    try {
      if (a.removePosts) removed = await removePostsBy(uid);
      if (a.type === 'deleteUser') await eraseAccount(uid, { ban: a.ban !== false });
      const open = await db.collection('reports').where('authorUid', '==', uid).where('status', '==', 'open').get();
      await Promise.all(open.docs.map((d) => d.ref.update({ status: 'resolved' })));
      await event.data.ref.update({ done: true, removed, doneAt: FieldValue.serverTimestamp() });
    } catch (err) {
      console.error(`Moderation action ${event.params.actionId} failed:`, err);
      await event.data.ref.update({ done: false, error: String(err) });
    }
  }
);

// ── Editing posts ────────────────────────────────────────────────────────

/** Past versions kept per post: enough for any honest back-and-forth. */
const MAX_EDIT_HISTORY = 50;

/**
 * Edit your own post (2026-09-28): concerns and comments any time,
 * questions to officials and candidates until they're answered. Every edit
 * adds a timestamp to the post's `edits` history; if anyone had already
 * replied, the entry also keeps the text they were replying to, so nobody
 * can quietly change what a reply answered. Edits go only through here (the
 * rules refuse direct updates), so the history can't be skipped.
 */
export const editPost = onCall(APP_CHECK, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = request.auth.uid;
  const path = String(request.data?.path ?? '');
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : null);
  const title = str(request.data?.title);
  const body = str(request.data?.body);
  const refs = request.data?.references;

  const kind = /^concerns\/[^/]+$/.test(path)
    ? 'concern'
    : /^(concerns\/[^/]+|candidates\/[^/]+\/policies\/[^/]+|officials\/[^/]+\/questions\/[^/]+)\/comments\/[^/]+$/.test(path)
      ? 'comment'
      : /^officials\/[^/]+\/questions\/[^/]+$/.test(path)
        ? 'question'
        : /^electionQuestions\/[^/]+$/.test(path)
          ? 'electionQuestion'
          : null;
  if (!kind) throw new HttpsError('invalid-argument', 'This can’t be edited.');
  if (body == null) throw new HttpsError('invalid-argument', 'Write something first.');

  const [min, max] = { concern: [0, 4000], comment: [1, 2000], question: [10, 2000], electionQuestion: [10, 1000] }[kind];
  // Fixed sentences (not built from the numbers) so the app can translate
  // them; the edit boxes already stop at the maximum.
  if (body.length < min) {
    throw new HttpsError('invalid-argument', min >= 10 ? 'Write at least 10 characters.' : 'Write something first.');
  }
  if (body.length > max) throw new HttpsError('invalid-argument', 'That’s longer than this box allows.');
  if (kind === 'concern' && (title == null || title.length < 4 || title.length > 140)) {
    throw new HttpsError('invalid-argument', 'Give your concern a title of at least 4 characters.');
  }
  let references: string[] | undefined;
  if (kind === 'concern' || kind === 'comment') {
    if (refs !== undefined) {
      if (!Array.isArray(refs) || refs.length > 10) throw new HttpsError('invalid-argument', 'At most 10 references.');
      references = refs.map((r) => String(r).trim()).filter(Boolean);
      if (references.some((r) => !r.startsWith('https://') || r.length > 500)) {
        throw new HttpsError('invalid-argument', 'References must be https:// links.');
      }
    }
  }

  const ref = db.doc(path);
  const rateRef = db.doc(`users/${uid}/rateLimits/edits`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const rate = await tx.get(rateRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That post is gone.');
    const d = snap.data()!;
    if (d.authorUid !== uid) throw new HttpsError('permission-denied', 'Only the author can edit this.');
    if (kind === 'question' && (d.response != null || d.status !== 'awaitingResponse')) {
      throw new HttpsError('failed-precondition', 'An answered question can’t be edited.');
    }
    if (kind === 'electionQuestion' && (d.answerCount ?? 0) > 0) {
      throw new HttpsError('failed-precondition', 'An answered question can’t be edited.');
    }
    const limit = judgeRate(
      RATE_LIMITS.edits,
      ((rate.data()?.times ?? []) as Timestamp[]).map((t) => t.toMillis()),
      Date.now()
    );
    if (!limit.ok) throw new HttpsError('resource-exhausted', 'Too many edits for now. Try again in a while.');

    // Replied to, or backed: a concern with comments or votes; a comment
    // with a later reply in its thread or a writing credit; a question
    // others joined (their joins weigh in the grade, so they must be able to
    // see what they joined). Questions can't be answered and still editable.
    let replied = false;
    if (kind === 'concern') replied = (d.commentCount ?? 0) > 0 || (d.tallies?.totalAll ?? 0) > 0;
    if (kind === 'question' || kind === 'electionQuestion') replied = (d.upvotes ?? 0) > 0;
    if (kind === 'comment' && d.credited) replied = true;
    if (kind === 'comment') {
      const rootId = (d.threadId as string | null | undefined) ?? ref.id;
      const thread = await tx.get(ref.parent.where('threadId', '==', rootId));
      const at = (d.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
      replied = replied || thread.docs.some(
        (c) => c.id !== ref.id && ((c.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0) > at
      );
    }

    const now = Timestamp.now();
    const entry: Record<string, unknown> = { at: now };
    if (replied) {
      entry.body = d.body ?? '';
      if (kind === 'concern') entry.title = d.title ?? '';
    }
    const edits = [...((d.edits ?? []) as unknown[]), entry].slice(-MAX_EDIT_HISTORY);
    tx.set(rateRef, { times: limit.times.map((t) => Timestamp.fromMillis(t)) });
    tx.update(ref, {
      body,
      ...(kind === 'concern' ? { title } : {}),
      ...(references !== undefined ? { references } : {}),
      edits,
      editedAt: now,
    });
  });
  // A candidate's command center previews the latest comment on each policy.
  const policy = path.match(/^(candidates\/[^/]+\/policies\/[^/]+)\/comments\/[^/]+$/);
  if (policy) await refreshLatestPolicyComment(policy[1]);
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
  const siteHost = new URL(sourceUrl).host;
  const parsed = await parsePlatformUrl(sourceUrl, (url) => fetchPageHtml(url, siteHost));

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
    if (!snap.exists) continue;
    // The first time the profile is claimed starts the officials' ignore
    // clock (withinPendingWindow). Never moved once set.
    const stampClaim = claimed && !snap.data()!.claimedAt;
    if (snap.data()!.claimed !== claimed || stampClaim) {
      await ref.update({ claimed, ...(stampClaim ? { claimedAt: FieldValue.serverTimestamp() } : {}) });
      if (stampClaim && col === 'officials') await recountOfficialQuestions(uid);
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
/**
 * Recount an official's question counters from the questions themselves:
 * asked, responded, answered, dodged, and pending (the week of grace, from
 * the claim). Delta counters can drift when a create and a delete arrive out
 * of order; this sets them straight. Also backfills each question's
 * resident fields (upvotesResident, authorResident) for questions from
 * before they existed, then recounts the answer weights.
 */
async function recountOfficialQuestions(officialUid: string): Promise<void> {
  const officialRef = db.doc(`officials/${officialUid}`);
  const official = await officialRef.get();
  if (!official.exists) return;
  const o = official.data()!;
  const officialWard = o.wardId as number | null | undefined;
  const questions = await db.collection(`officials/${officialUid}/questions`).get();
  const counts = { questionsAsked: 0, questionsResponded: 0, questionsAnswered: 0, questionsDodged: 0, questionsPending: 0 };
  for (const q of questions.docs) {
    const d = q.data();
    counts.questionsAsked += 1;
    if (d.response) counts.questionsResponded += 1;
    if (d.status === 'answered') counts.questionsAnswered += 1;
    if (d.status === 'dodged') counts.questionsDodged += 1;
    if (d.status === 'awaitingResponse' && withinPendingWindow(d.createdAt, o.claimedAt)) counts.questionsPending += 1;
    const fill: Record<string, unknown> = {};
    if (d.upvotesResident === undefined) {
      const votes = await q.ref.collection('votes').get();
      fill.upvotesResident = votes.docs.filter((v) => isResidentVote(v.data(), officialWard)).length;
    }
    if (d.authorResident === undefined && d.authorUid) {
      const author = (await db.doc(`users/${d.authorUid}`).get()).data();
      fill.authorResident =
        author?.verified === true && (officialWard == null || author?.wardId === officialWard);
    }
    if (Object.keys(fill).length) await q.ref.update(fill);
  }
  const changed = Object.entries(counts).some(([k, v]) => (o[k] ?? 0) !== v);
  if (changed) await officialRef.update(counts);
  await recountAnswerWeights(officialUid);
}

export const sweepPendingQuestions = onSchedule(
  { schedule: '15 6 * * *', timeZone: 'America/Chicago' },
  async () => {
    const officials = await db.collection('officials').get();
    for (const o of officials.docs) {
      try {
        if ((o.data().questionsAsked ?? 0) === 0 && (o.data().questionsPending ?? 0) === 0) continue;
        await recountOfficialQuestions(o.id);
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
    title: 'Early voting opens downtown',
    titleEs: 'La votación anticipada abre en el centro',
    body: 'Any Chicago voter can vote early downtown starting Thursday, October 1, at 137 S. State St. or 69 W. Washington St. (6th floor). Sites in every ward open October 19.',
    bodyEs: 'A partir del jueves 1 de octubre, cualquier votante de Chicago puede votar por anticipado en el centro, en 137 S. State St. o en 69 W. Washington St. (6.º piso). Los sitios de cada distrito abren el 19 de octubre.',
  },
  {
    date: '2026-10-06',
    title: 'Last day to register with a paper form by mail',
    titleEs: 'Último día para registrarte con un formulario en papel por correo',
    body: 'Paper registration forms sent by mail must be postmarked by Tuesday, October 6. Online registration stays open through October 18, and in-person registration runs through election day with two forms of ID.',
    bodyEs: 'Los formularios de registro en papel enviados por correo deben llevar matasellos a más tardar del martes 6 de octubre. El registro en línea sigue abierto hasta el 18 de octubre, y el registro en persona sigue hasta el día de la elección con dos formas de identificación.',
  },
  {
    date: '2026-10-18',
    title: 'Last day to register online',
    titleEs: 'Último día para registrarte en línea',
    body: 'Online registration closes Sunday, October 18 (needs an Illinois license or state ID). After that, register in person at an early voting site or at your polling place on election day, with two forms of ID.',
    bodyEs: 'El registro en línea cierra el domingo 18 de octubre (requiere una licencia o identificación estatal de Illinois). Después, regístrate en persona en un sitio de votación anticipada o en tu lugar de votación el día de la elección, con dos formas de identificación.',
  },
  {
    date: '2026-10-19',
    title: 'Early voting opens in every ward',
    titleEs: 'La votación anticipada abre en cada distrito',
    body: 'One early voting site in every ward opens Monday, October 19, joining the two downtown, and any Chicago voter can use any site.',
    bodyEs: 'El lunes 19 de octubre abre un sitio de votación anticipada en cada distrito, junto a los dos del centro, y cualquier votante de Chicago puede usar cualquier sitio.',
  },
  {
    date: '2026-10-29',
    title: 'Last day to apply for a mail ballot',
    titleEs: 'Último día para pedir una boleta por correo',
    body: 'Mail ballot applications close Thursday, October 29. Already have a mail ballot? Mail it back postmarked by November 3 (it must arrive by November 17), or leave it in the drop box at any early voting site.',
    bodyEs: 'Las solicitudes de boleta por correo cierran el jueves 29 de octubre. ¿Ya tienes tu boleta por correo? Envíala con matasellos a más tardar el 3 de noviembre (debe llegar antes del 17 de noviembre), o déjala en el buzón de cualquier sitio de votación anticipada.',
  },
  {
    date: '2026-11-03',
    title: 'General election day',
    titleEs: 'Día de la elección general',
    body: 'Polls are open 6 am to 7 pm at your precinct or any vote center in the city. Same-day registration is available with two forms of ID. Mail ballots must be postmarked by November 3.',
    bodyEs: 'Las urnas abren de 6 am a 7 pm en tu precinto o en cualquier centro de votación de la ciudad. Puedes registrarte el mismo día con dos formas de identificación. Las boletas por correo deben llevar matasellos a más tardar del 3 de noviembre.',
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
 * Bodies name their dates instead of saying "today": each one is sent the
 * day before AND the day of, so "today" would be wrong half the time.
 *
 * Deadline reminders for everyone: the day before and the day of each voting
 * milestone, every account gets a notification in its inbox (the same quiet
 * inbox as replies and answers; nothing pushes). One write per user per
 * milestone-day, idempotent by id, so a re-run can't double up.
 */
export const sendDeadlineReminders = onSchedule(
  // Every user gets one per milestone-day: minutes of work at scale, so a
  // long timeout, chunks in parallel, and a retry (sendNotification is
  // idempotent by id, so a rerun only fills in whoever was missed).
  { schedule: '0 9 * * *', timeZone: 'America/Chicago', timeoutSeconds: 1800, memory: '512MiB', retryCount: 2 },
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
      for (let i = 0; i < users.docs.length; i += 25) {
        await Promise.all(
          users.docs.slice(i, i + 25).map((u) =>
            sendNotification(u.id, `deadline-${m.date}-${m.days}`, {
              type: 'deadline',
              title,
              titleEs,
              body: m.body,
              bodyEs: m.bodyEs,
              link: '/election',
            }).catch((err) => console.error(`Deadline reminder failed for ${u.id}:`, err))
          )
        );
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
  { schedule: '30 3 * * *', timeZone: 'America/Chicago', secrets: [DIDIT_API_KEY], timeoutSeconds: 540 },
  async () => {
    const pending = await db.collection('verificationSessions').where('erased', '==', false).get();
    const cutoff = Date.now() - DIDIT_SESSION_MAX_AGE_MS;
    // An approval the webhook hasn't applied yet (the geocoder was down, say)
    // keeps its decision at Didit until a retry records the outcome, or
    // until the age limit, whichever comes first.
    const due = pending.docs.filter((d) => {
      const s = d.data();
      const created = (s.createdAt as Timestamp | undefined)?.toMillis?.() ?? 0;
      if (created < cutoff) return true;
      if (!s.settled) return false;
      return s.finalStatus !== 'Approved' || s.outcome != null;
    });
    let erased = 0;
    for (let i = 0; i < due.length; i += 5) {
      const done = await Promise.all(due.slice(i, i + 5).map((d) => eraseDiditSession(d.id)));
      erased += done.filter(Boolean).length;
    }
    console.log(`Erased ${erased} of ${pending.size} unerased Didit sessions.`);
  }
);

/**
 * City Council from the Clerk's legislation API (council.ts): members
 * matched to aldermen, the next two weeks of meetings, and new roll calls
 * with a No. Twice a day, since a Council agenda lands about a week out and
 * votes the same day. Each part runs even if another fails.
 */
export const syncCouncil = onSchedule(
  { schedule: '0 4,13 * * *', timeZone: 'America/Chicago', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    for (const [name, run] of [
      ['members', () => syncCouncilMembers(db)],
      ['meetings', () => syncUpcomingMeetings(db)],
      ['roll calls', () => syncRollCalls(db)],
    ] as const) {
      try {
        console.log(`Council ${name}: ${await run()}`);
      } catch (err) {
        console.error(`Council ${name} sync failed:`, err);
      }
    }
  }
);

export const syncPlatforms = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'America/Chicago', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const candidates = await db.collection('candidates').where('sourceUrl', '!=', null).get();
    for (let i = 0; i < candidates.docs.length; i += 4) {
      await Promise.all(
        candidates.docs.slice(i, i + 4).map((c) =>
          syncCandidatePlatform(c.id, c.data().sourceUrl as string).catch((err) =>
            console.error(`Platform sync failed for ${c.id}:`, err)
          )
        )
      );
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
  await claimReverify(request.auth.uid);
  const before = (await db.doc(`users/${request.auth.uid}`).get()).data();
  const oldWard = (before?.wardId as number | null | undefined) ?? null;
  await applyVerification(request.auth.uid, { verified: true, wardId });
  if (oldWard != null && oldWard !== wardId) await leaveWard(request.auth.uid, oldWard);
  return { ok: true };
});

/**
 * Set or change a home ward without verifying. It opens full participation
 * in that ward (3 posts a day, ward polls, rating the alderman) while every
 * ballot stays unverified, so declared residents count in the all-users
 * tallies only and never in a grade. It can be changed freely until its
 * owner posts there: the second home-ward post locks it for a week, the
 * third for 3 months (wardLockedUntil, stamped by gateWardPost). A switch
 * changes where the person's posting limits and ward screens point, and
 * nothing else: every vote already cast stays as cast. Verifying
 * replaces a declared ward with the ward on the ID; verified accounts and
 * officials cannot declare.
 */
export const declareWard = onCall(APP_CHECK, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = request.auth.uid;
  const wardId = Number(request.data?.wardId);
  if (!Number.isInteger(wardId) || wardId < WARD_MIN || wardId > WARD_MAX) {
    throw new HttpsError('invalid-argument', `wardId must be ${WARD_MIN}–${WARD_MAX}.`);
  }
  const userRef = db.doc(`users/${uid}`);
  const changesRef = db.doc(`users/${uid}/rateLimits/wardChanges`);
  await db.runTransaction(async (tx) => {
    const u = (await tx.get(userRef)).data();
    const changes = await tx.get(changesRef);
    if (!u) throw new HttpsError('not-found', 'No profile.');
    if (u.verified) throw new HttpsError('failed-precondition', 'Verified accounts use the ward on their ID.');
    if (u.role === 'official') {
      throw new HttpsError('failed-precondition', 'Official accounts keep the ward they were set up with.');
    }
    const old = (u.wardId as number | null | undefined) ?? null;
    if (old === wardId) return old;
    const lockedUntil = (u.wardLockedUntil as Timestamp | null | undefined)?.toMillis() ?? 0;
    if (old != null && lockedUntil > Date.now()) {
      throw new HttpsError(
        'failed-precondition',
        'You have posted in your home ward, so it is locked for now. Verify your residency to change it sooner.'
      );
    }
    // Free switching is for finding the right ward, not for touring them.
    const rate = judgeRate(
      RATE_LIMITS.wardChanges,
      ((changes.data()?.times ?? []) as Timestamp[]).map((t) => t.toMillis()),
      Date.now()
    );
    if (!rate.ok) {
      throw new HttpsError('resource-exhausted', 'You have changed your home ward 5 times today. Try again tomorrow.', {
        retryAt: rate.nextAt,
      });
    }
    tx.set(changesRef, { times: rate.times.map((t) => Timestamp.fromMillis(t)) });
    tx.update(userRef, {
      wardId,
      wardDeclaredAt: FieldValue.serverTimestamp(),
      homeWardPosts: 0,
      wardLockedUntil: null,
      // Districts found from an address in another ward no longer apply.
      ...(u.districts && u.districts.wardId !== wardId ? { districts: FieldValue.delete() } : {}),
    });
    return old;
  });
  return { wardId };
});

/**
 * A typed home address -> this person's districts (2026-09-29), so the
 * election tab can show their own races. Accounts verified after this
 * shipped get them from the verified address; everyone else types an
 * address once. Only the district numbers are kept, with the ward they
 * belong to: the address goes to the Census geocoder and is dropped. An
 * address in another ward than the person's home ward is refused rather
 * than stored, so their districts always match their ward screens. 5
 * lookups a day (each costs a geocoder call).
 */
export const findMyDistricts = onCall(APP_CHECK, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = request.auth.uid;
  const typed = request.data?.address;
  if (typeof typed !== 'string' || typed.trim().length < 5 || typed.length > 200) {
    throw new HttpsError('invalid-argument', 'Type a street address.');
  }
  const userRef = db.doc(`users/${uid}`);
  const lookupsRef = db.doc(`users/${uid}/rateLimits/addressLookups`);
  const rate = judgeRate(
    RATE_LIMITS.addressLookups,
    (((await lookupsRef.get()).data()?.times ?? []) as Timestamp[]).map((t) => t.toMillis()),
    Date.now()
  );
  if (!rate.ok) {
    throw new HttpsError('resource-exhausted', 'You have looked up 5 addresses today. Try again tomorrow.', {
      retryAt: rate.nextAt,
    });
  }
  // A lookup counts once it finds a place; a typo that matches nothing
  // doesn't use one up.
  const spend = () => lookupsRef.set({ times: rate.times.map((t) => Timestamp.fromMillis(t)) });

  // "1234 N Clark St" alone is ambiguous to a national geocoder.
  // A 5-digit house number ("10400 S Western") is not a ZIP, and "Illinois"
  // is a street name too: only a trailing ZIP or ", Chicago" / ", IL" counts.
  const line = /,\s*chicago\b|,\s*(il|illinois)\b|\b6\d{4}(-\d{4})?\s*$/i.test(typed)
    ? typed
    : `${typed}, Chicago, IL`;
  let point: { lon: number; lat: number } | null;
  try {
    point = await pointForAddress(line);
  } catch (err) {
    console.error('Census geocoder failed for a district lookup:', err);
    throw new HttpsError('unavailable', 'The address lookup is not answering right now. Try again in a few minutes.');
  }
  if (!point) return { result: 'notFound' };
  await spend();
  const wardId = wardForPoint(point.lon, point.lat);
  if (wardId == null) return { result: 'outside' };
  const districts: Districts | null = districtsForPoint(point.lon, point.lat);
  if (!districts) return { result: 'notFound' };

  const u = (await userRef.get()).data();
  if (!u) throw new HttpsError('not-found', 'No profile.');
  const home = (u.wardId as number | null | undefined) ?? null;
  // Ward 51 is the hidden test ward: no real address is in it, so its
  // accounts (testers, App Review) may use any Chicago address, and the
  // districts are kept under ward 51 so the app treats them as theirs.
  const testWard = home === 51;
  if (home != null && home !== wardId && !testWard) {
    return { result: 'otherWard', wardId, verified: u.verified === true };
  }
  await userRef.update({ districts: { ...districts, wardId: testWard ? home : wardId } });
  return { result: 'ok', wardId, districts };
});

/**
 * Start a re-verification for an already-verified citizen: enforce the
 * 90-day window and stamp the clock, in one transaction so two quick taps
 * can't both pass. Null when the person isn't verified yet (a first
 * verification, which has no window).
 */
async function claimReverify(
  uid: string,
  review = false
): Promise<{ at: Timestamp | null; prev: Timestamp | null; wardId: number | null } | null> {
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
    // A review account's move leaves no stamp, so Settings stays open for the next one.
    if (review) return { at: null, prev, wardId: (u.wardId as number | null | undefined) ?? null };
    if (prev && Date.now() - prev.toMillis() < REVERIFY_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', 'You can verify a new address once every 3 months.');
    }
    const at = Timestamp.now();
    tx.update(userRef, { reverifyAt: at });
    return { at, prev, wardId: (u.wardId as number | null | undefined) ?? null };
  });
}

/** Undo a re-verification stamp when no session was actually started. */
async function releaseReverify(uid: string, claim: { at: Timestamp | null; prev: Timestamp | null }) {
  if (!claim.at) return;
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
  { ...APP_CHECK, secrets: [DIDIT_API_KEY, DIDIT_WORKFLOW_ID], timeoutSeconds: 120 },
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

  // One open session per account: asking again hands back the same link,
  // before anything is claimed or counted (a re-verification's 90-day stamp
  // belongs to the session already open).
  const method: 'id' | 'address' = request.data?.method === 'address' ? 'address' : 'id';
  const limitsRef = db.doc(`verificationLimits/${uid}`);
  const limitsBefore = (await limitsRef.get()).data();
  const review = reviewPricingOf(limitsBefore);
  const open = review ? null : reusableSession(limitsBefore, method);
  if (open) return { inquiryUrl: open.url };

  // A verified citizen starting a session is re-verifying at a new address.
  const reverify = await claimReverify(uid, review != null);
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
  const dayKey = verificationDayKey();
  const monthRef = db.doc(`verificationUsage/${monthKey}`);
  const creditsRef = db.doc(`verificationCredits/${uid}`);
  let spent: CreditType | null;
  // Set when this session is one of the free ones (its free attempt).
  let freeAt: Timestamp | null = null;
  let freeToday = 0;
  try {
    spent = await db.runTransaction(async (tx) => {
      freeAt = null;
      const month = await tx.get(monthRef);
      const credits = await tx.get(creditsRef);
      const limits = await tx.get(limitsRef);
      const now = Date.now();
      const startingAt = (limits.data()?.startingAt as Timestamp | undefined)?.toMillis() ?? 0;
      if (startingAt > now - START_LOCK_MS) {
        throw new HttpsError('already-exists', 'Your verification is already starting. Give it a moment.');
      }
      const checks = (month.data()?.sessions as number | undefined) ?? 0;
      freeToday = ((month.data()?.freeByDay as Record<string, number> | undefined)?.[dayKey]) ?? 0;
      const freeStarts = ((limits.data()?.freeStarts ?? []) as Timestamp[]).map((t) => t.toMillis());
      const block = creditType === 'bill' ? 'bill' : freeCheckBlockFor(checks, freeStarts, now, review);
      if (!block && !review && freeToday >= EMAIL_GATE_AFTER_PER_DAY && !identityCostsSomething(request.auth!.token)) {
        throw new HttpsError(
          'failed-precondition',
          'Confirm your email address first. Open the confirmation email, then try again.',
          { emailVerificationRequired: true }
        );
      }
      let spend: CreditType | null = null;
      if (block) {
        const have = (credits.data()?.[creditType] as number | undefined) ?? 0;
        if (have < 1) {
          throw new HttpsError(
            'failed-precondition',
            'Verification needs a payment first. Update the app to pay for it.',
            { paymentRequired: true, productId: productFor(creditType, pricedChecks(checks, review)), reason: block }
          );
        }
        tx.set(
          creditsRef,
          { [creditType]: have - 1, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        spend = creditType;
      }
      const limitsUpdate: Record<string, unknown> = { startingAt: Timestamp.fromMillis(now) };
      if (!spend) {
        freeAt = Timestamp.fromMillis(now);
        limitsUpdate.freeStarts = [
          ...freeStarts.filter((t) => t > now - FREE_ATTEMPT_WINDOW_MS).map((t) => Timestamp.fromMillis(t)),
          freeAt,
        ];
      }
      tx.set(limitsRef, limitsUpdate, { merge: true });
      tx.set(
        monthRef,
        {
          sessions: checks + 1,
          ...(spend ? {} : { freeByDay: { [dayKey]: freeToday + 1 } }),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return spend;
    });
  } catch (err) {
    if (reverify) await releaseReverify(uid, reverify);
    throw err;
  }
  const free = freeAt as Timestamp | null;
  // A big day: good news or a burst of throwaway accounts. The operator
  // hears once a day, when the email requirement switches on.
  if (free && freeToday + 1 === EMAIL_GATE_AFTER_PER_DAY) {
    await notifyOperator(`free-gate-${dayKey}`, {
      title: `${EMAIL_GATE_AFTER_PER_DAY} free verifications today (${dayKey})`,
      body: `Free checks for the rest of today need a confirmed email or Google / Apple sign-in. If this is a surge from a post, great; if it is new accounts in a loop, look at verificationSessions.`,
    });
  }

  let url: string | undefined;
  try {
    // The emulator never reaches Didit, even when it can read the real
    // secrets from Secret Manager: this fails like any unstarted session,
    // so the refund path still runs. Use devVerify to simulate a pass.
    if (process.env.FUNCTIONS_EMULATOR) {
      throw new HttpsError('failed-precondition', 'Didit is not called from the emulator. Use devVerify.');
    }
    const resp = await fetch('https://verification.didit.me/v2/session/', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: workflowId, vendor_data: uid }),
      // Well inside the function's own timeout, so the refund below always
      // gets to run when Didit is slow.
      signal: AbortSignal.timeout(30_000),
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
        dayKey,
        settled: false,
        erased: false,
        createdAt: FieldValue.serverTimestamp(),
        ...(reverify
          ? { kind: 'reverify', reverifyAt: reverify.at, prevReverifyAt: reverify.prev }
          : {}),
        ...(spent ? { creditType: spent } : {}),
        ...(free ? { freeAt: free } : {}),
      });
      // The session is real from here on: its own webhook settles the
      // slot, so a hiccup recording the hand-back link must not refund too.
      await limitsRef
        .set(
          {
            open: { sessionId: session.session_id, url, method, at: FieldValue.serverTimestamp() },
            startingAt: FieldValue.delete(),
          },
          { merge: true }
        )
        .catch((err) => console.error(`Could not record the open session for ${uid}:`, err));
    } else {
      console.warn('Didit session response had no session_id - slot cannot be released on expiry.');
    }
  } catch (err) {
    // No session was actually started, so give the slot, the credit, and
    // the moving window back.
    if (reverify) await releaseReverify(uid, reverify);
    if (spent) await refundCredit(uid, spent);
    await monthRef
      .set(
        {
          sessions: FieldValue.increment(-1),
          ...(free ? { freeByDay: { [dayKey]: FieldValue.increment(-1) } } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {});
    await limitsRef
      .set(
        {
          startingAt: FieldValue.delete(),
          ...(free ? { freeStarts: FieldValue.arrayRemove(free) } : {}),
        },
        { merge: true }
      )
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
  const [month, credits, limits] = await Promise.all([
    db.doc(`verificationUsage/${verificationMonthKey()}`).get(),
    db.doc(`verificationCredits/${uid}`).get(),
    db.doc(`verificationLimits/${uid}`).get(),
  ]);
  // An open session is picked up again at no cost: `free` stays true so
  // binaries from before `resume` existed still show the start button.
  const method: 'id' | 'address' = request.data?.method === 'address' ? 'address' : 'id';
  const review = reviewPricingOf(limits.data());
  const resume = !review && reusableSession(limits.data(), method) != null;
  const checks = (month.data()?.sessions as number | undefined) ?? 0;
  const freeToday = ((month.data()?.freeByDay as Record<string, number> | undefined)?.[verificationDayKey()]) ?? 0;
  const freeStarts = ((limits.data()?.freeStarts ?? []) as Timestamp[]).map((t) => t.toMillis());
  const block = creditType === 'bill' ? 'bill' : freeCheckBlockFor(checks, freeStarts, Date.now(), review);
  const free = resume || block == null;
  return {
    free,
    resume,
    /** Why it isn't free: 'month' (the 500 are used), 'attempts' (this
     * account's free tries), or 'bill'. */
    reason: free ? null : block,
    /** A free check today needs a confirmed email first (a busy day). */
    emailRequired:
      !resume && !review && block == null && freeToday >= EMAIL_GATE_AFTER_PER_DAY && !identityCostsSomething(request.auth.token),
    creditType,
    credits: (credits.data()?.[creditType] as number | undefined) ?? 0,
    productId: free ? null : productFor(creditType, pricedChecks(checks, review)),
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
  // Decision fetch, up to six geocoder calls, and the erase at Didit.
  { secrets: [DIDIT_WEBHOOK_SECRET, DIDIT_API_KEY, IDENTITY_HASH_KEY], timeoutSeconds: 300 },
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
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 300) {
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
  const sessionData = sessionRef ? (await sessionRef.get()).data() : undefined;
  if (sessionData?.outcome) {
    await reply(200, 'Already applied.');
    return;
  }
  const recordOutcome = async (outcome: string) => {
    if (sessionRef) await sessionRef.set({ outcome }, { merge: true });
  };
  const current = userSnap.data()!;
  // Verifying a new address from Settings. The session says so; the profile
  // is only the fallback for sessions recorded before `kind` existed, since
  // a retried first verification may already show verified.
  const moving = sessionData ? sessionData.kind === 'reverify' : current.verified === true;
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
      if (existing.data()?.banned) return false;
      const holder = existing.exists ? (existing.data()!.uid as string | null) : null;
      // A claim left by an account deleted mid-verification holds nothing.
      const holderLives = holder && holder !== uid ? (await tx.get(db.doc(`users/${holder}`))).exists : false;
      if (holderLives) return false;
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
  } else if (!moving || !oldClaim) {
    // Without the document's number there is no one-account-per-ID check,
    // so a first verification grants nothing (it used to go through
    // unchecked). Someone moving keeps the claim they already hold.
    console.warn(`Approved session ${sessionId} carried no document number: not verified.`);
    await recordOutcome('no-document-identity');
    await sendNotification(uid, noteKey, {
      type: 'verification',
      title: 'We couldn’t read your ID’s document number',
      titleEs: 'No pudimos leer el número de tu identificación',
      body: 'Verification checks that each ID is used for one account only, so it needs the number on your ID. Verify again with a clear, well-lit photo of the whole card.',
      bodyEs:
        'La verificación comprueba que cada identificación se use en una sola cuenta, así que necesita el número de tu identificación. Verifícate de nuevo con una foto clara y bien iluminada de toda la tarjeta.',
      link: moving ? '/settings' : '/verify',
    });
    await reply(200, 'Approved, but no document number to deduplicate on.');
    return;
  }

  // The profile and the session's outcome land together, so a retry after
  // a crash either redoes both or sees "Already applied".
  const applied = db.batch();
  applied.update(userRef, {
    verified: true,
    wardId: ward.wardId,
    identityClaimId: docKey ?? oldClaim,
    // The address's districts, numbers only (the address itself is never kept).
    districts: ward.districts ? { ...ward.districts, wardId: ward.wardId } : FieldValue.delete(),
  });
  if (sessionRef) applied.set(sessionRef, { outcome: moving ? 'moved' : 'verified' }, { merge: true });
  await applied.commit();

  // A declared ward that verification replaces with a different one gets
  // the same cleanup as a move: the old ward's alderman rating is withdrawn.
  if (!moving && oldWard != null && oldWard !== ward.wardId) await leaveWard(uid, oldWard);

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
