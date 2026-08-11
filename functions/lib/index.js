"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.diditWebhook = exports.createVerificationSession = exports.devVerify = exports.deleteAccount = exports.onJudgmentWrite = exports.onQuestionResponded = exports.onQuestionCreated = exports.onApprovalWrite = exports.onQuestionDeleted = exports.onConcernDeleted = exports.onCommentDeleted = exports.onCommentCreated = exports.onPollVoteWrite = exports.onConcernVoteWrite = exports.onConcernCreated = void 0;
const crypto = __importStar(require("crypto"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const tally_1 = require("./tally");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
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
const DIDIT_API_KEY = (0, params_1.defineSecret)('DIDIT_API_KEY');
const DIDIT_WORKFLOW_ID = (0, params_1.defineSecret)('DIDIT_WORKFLOW_ID');
const DIDIT_WEBHOOK_SECRET = (0, params_1.defineSecret)('DIDIT_WEBHOOK_SECRET');
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
function verificationMonthKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).slice(0, 7);
}
/**
 * Settle a session's reserved slot in the monthly ledger, exactly once per
 * session (webhook deliveries can repeat). Expired sessions were never
 * opened, so nothing billed and the slot is returned; Approved, Declined,
 * and Abandoned sessions all ran billable modules and keep their slot.
 */
async function settleVerificationSlot(sessionId, status) {
    const sessionRef = db.doc(`verificationSessions/${sessionId}`);
    await db
        .runTransaction(async (tx) => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists || snap.data().settled)
            return;
        const monthRef = db.doc(`verificationUsage/${snap.data().monthKey}`);
        tx.update(sessionRef, { settled: true, finalStatus: status });
        const counters = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
        if (status === 'Expired') {
            counters.sessions = firestore_1.FieldValue.increment(-1);
            counters.expired = firestore_1.FieldValue.increment(1);
        }
        else if (status === 'Approved') {
            counters.approved = firestore_1.FieldValue.increment(1);
        }
        else if (status === 'Declined') {
            counters.declined = firestore_1.FieldValue.increment(1);
        }
        else {
            counters.abandoned = firestore_1.FieldValue.increment(1);
        }
        tx.set(monthRef, counters, { merge: true });
    })
        .catch((err) => console.error(`Failed to settle verification slot ${sessionId}:`, err));
}
async function applyVerification(uid, result) {
    await db.doc(`users/${uid}`).update({
        verified: result.verified,
        wardId: result.wardId,
    });
}
function slicesOf(ballot) {
    return { verified: !!ballot.verified };
}
/**
 * Slices for an item that belongs to an area. On ward-scoped items the
 * verified slice counts only residents of that ward; "verified" always means
 * "verified for this item's area". Citywide items count every verified user.
 */
function areaSlicesOf(ballot, item) {
    const inArea = item.scope !== 'ward' || ballot.wardId === item.wardId;
    return { verified: !!ballot.verified && inArea };
}
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
async function claimEvent(tx, eventId) {
    // No id to dedupe on: counting once too often beats never counting at all.
    if (!eventId)
        return true;
    const snap = await tx.get(db.doc(`processedEvents/${eventId}`));
    return !snap.exists;
}
/** Records the claim. Must follow every read in the transaction. */
function markEvent(tx, eventId) {
    if (!eventId)
        return;
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
async function readStat(tx, uid, delta) {
    if (!uid || delta === 0)
        return null;
    const snap = await tx.get(db.doc(`users/${uid}`));
    return snap.exists ? snap : null;
}
/** Applies a stat delta, clamped so a counter can never go negative. */
function writeStat(tx, snap, stat, delta) {
    if (!snap)
        return;
    const stats = (snap.data()?.stats ?? {});
    tx.update(snap.ref, { [`stats.${stat}`]: Math.max(0, (stats[stat] ?? 0) + delta) });
}
/** Counter delta for a ballot/judgment write: +1 cast, -1 retracted, 0 changed. */
function ballotStatDelta(before, after) {
    if (!before && after)
        return 1;
    if (before && !after)
        return -1;
    return 0;
}
/** A counter's next value, clamped at zero. */
function step(current, delta) {
    return Math.max(0, (typeof current === 'number' ? current : 0) + delta);
}
exports.onConcernCreated = (0, firestore_2.onDocumentCreated)('concerns/{concernId}', async (event) => {
    const authorUid = event.data?.data()?.authorUid;
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id)))
            return;
        const stat = await readStat(tx, authorUid, 1);
        writeStat(tx, stat, 'concerns', 1);
        markEvent(tx, event.id);
    });
});
exports.onConcernVoteWrite = (0, firestore_2.onDocumentWritten)('concerns/{concernId}/votes/{voterUid}', async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const concernRef = db.doc(`concerns/${event.params.concernId}`);
    // A brand-new ballot (not a changed one) counts toward vote milestones;
    // retracting one walks the stat back so cast-retract-cast can't farm it.
    const statDelta = ballotStatDelta(before, after);
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id)))
            return;
        const snap = await tx.get(concernRef);
        const stat = await readStat(tx, event.params.voterUid, statDelta);
        // The concern may already be gone (withdrawal cascades to its ballots);
        // the voter's own counter still has to come back down.
        if (snap.exists) {
            const concern = snap.data();
            let tallies = concern.tallies;
            if (before)
                tallies = (0, tally_1.removeBallot)(tallies, before.value, areaSlicesOf(before, concern));
            if (after)
                tallies = (0, tally_1.addBallot)(tallies, after.value, areaSlicesOf(after, concern));
            tx.update(concernRef, {
                tallies,
                score: (0, tally_1.weightedScore)(tallies.all, tally_1.PRIORITY_WEIGHTS),
                scoreVerified: (0, tally_1.weightedScore)(tallies.verified, tally_1.PRIORITY_WEIGHTS),
            });
        }
        writeStat(tx, stat, 'votes', statDelta);
        markEvent(tx, event.id);
    });
});
exports.onPollVoteWrite = (0, firestore_2.onDocumentWritten)('polls/{pollId}/votes/{voterUid}', async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const pollRef = db.doc(`polls/${event.params.pollId}`);
    const statDelta = ballotStatDelta(before, after);
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id)))
            return;
        const snap = await tx.get(pollRef);
        const stat = await readStat(tx, event.params.voterUid, statDelta);
        if (snap.exists) {
            const poll = snap.data();
            const validKeys = new Set((poll.options ?? []).map((o) => o.key));
            // Rules can't introspect the ballot against the option list, so the
            // trigger is the integrity gate: dedupe, drop unknown keys, and allow
            // multiple keys only on approval polls. Deterministic, so a ballot
            // sanitizes identically when it's later changed or removed. A ballot
            // with nothing valid left counts nowhere - not even toward totals.
            const sanitize = (value) => {
                const keys = [...new Set(Array.isArray(value) ? value : [value])].filter((k) => validKeys.has(k));
                return poll.type === 'approval' ? keys : keys.slice(0, 1);
            };
            let tallies = poll.tallies;
            const beforeKeys = before ? sanitize(before.value) : [];
            const afterKeys = after ? sanitize(after.value) : [];
            if (before && beforeKeys.length) {
                tallies = (0, tally_1.removeBallot)(tallies, beforeKeys, slicesOf(before));
            }
            if (after && afterKeys.length)
                tallies = (0, tally_1.addBallot)(tallies, afterKeys, slicesOf(after));
            tx.update(pollRef, { tallies });
        }
        writeStat(tx, stat, 'votes', statDelta);
        markEvent(tx, event.id);
    });
});
/** One trigger body for both directions of a comment's life. */
async function applyCommentDelta(eventId, concernId, authorUid, delta) {
    const concernRef = db.doc(`concerns/${concernId}`);
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, eventId)))
            return;
        const snap = await tx.get(concernRef);
        const stat = await readStat(tx, authorUid, delta);
        // The concern may already be gone (withdrawal cascades to its comments).
        if (snap.exists) {
            tx.update(concernRef, { commentCount: step(snap.data()?.commentCount, delta) });
        }
        writeStat(tx, stat, 'comments', delta);
        markEvent(tx, eventId);
    });
}
exports.onCommentCreated = (0, firestore_2.onDocumentCreated)('concerns/{concernId}/comments/{commentId}', async (event) => applyCommentDelta(event.id, event.params.concernId, event.data?.data()?.authorUid, 1));
exports.onCommentDeleted = (0, firestore_2.onDocumentDeleted)('concerns/{concernId}/comments/{commentId}', async (event) => applyCommentDelta(event.id, event.params.concernId, event.data?.data()?.authorUid, -1));
/** A withdrawn concern takes its ballots and comments with it. */
exports.onConcernDeleted = (0, firestore_2.onDocumentDeleted)('concerns/{concernId}', async (event) => {
    const authorUid = event.data?.data()?.authorUid;
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id)))
            return;
        const stat = await readStat(tx, authorUid, -1);
        writeStat(tx, stat, 'concerns', -1);
        markEvent(tx, event.id);
    });
    // Re-deleting already-deleted documents is a no-op, so the cascade is safe
    // to repeat on redelivery and stays outside the once-guard (a transaction
    // can't carry a recursive delete anyway).
    await db.recursiveDelete(db.doc(`concerns/${event.params.concernId}`));
});
/**
 * A question can vanish two ways: the asker withdraws it while unanswered, or
 * the admin takes down an abusive thread at any stage. Rebalance every
 * counter the question contributed to and sweep its judgments.
 */
exports.onQuestionDeleted = (0, firestore_2.onDocumentDeleted)('officials/{officialUid}/questions/{questionId}', async (event) => {
    const q = event.data?.data();
    const officialRef = db.doc(`officials/${event.params.officialUid}`);
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id)))
            return;
        const snap = await tx.get(officialRef);
        if (snap.exists) {
            const o = snap.data();
            const next = { questionsAsked: step(o.questionsAsked, -1) };
            if (q?.response)
                next.questionsResponded = step(o.questionsResponded, -1);
            if (q?.status === 'answered')
                next.questionsAnswered = step(o.questionsAnswered, -1);
            if (q?.status === 'dodged')
                next.questionsDodged = step(o.questionsDodged, -1);
            tx.update(officialRef, next);
        }
        markEvent(tx, event.id);
    });
    await db.recursiveDelete(db.doc(`officials/${event.params.officialUid}/questions/${event.params.questionId}`));
});
/**
 * Approval ballots - the "how well liked" axis of an official's grade.
 * Aggregates the standard dual tally (all / verified) plus a constituents-only count
 * (ballots from verified residents of the official's own ward; for citywide
 * offices every verified resident is a constituent).
 */
exports.onApprovalWrite = (0, firestore_2.onDocumentWritten)('officials/{officialUid}/approvals/{voterUid}', async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const officialRef = db.doc(`officials/${event.params.officialUid}`);
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id)))
            return;
        const snap = await tx.get(officialRef);
        if (!snap.exists)
            return;
        const official = snap.data();
        let tallies = official.approvalTallies ?? {
            all: {},
            verified: {},
            totalAll: 0,
            totalVerified: 0,
        };
        const constituents = { ...(official.approvalConstituents ?? { approve: 0, disapprove: 0 }) };
        const isConstituent = (ballot) => !!ballot.verified && (official.wardId == null || ballot.wardId === official.wardId);
        const constKey = (v) => (v === 'approve' ? 'approve' : 'disapprove');
        if (before) {
            tallies = (0, tally_1.removeBallot)(tallies, before.value, slicesOf(before));
            if (isConstituent(before)) {
                constituents[constKey(before.value)] = Math.max(0, constituents[constKey(before.value)] - 1);
            }
        }
        if (after) {
            tallies = (0, tally_1.addBallot)(tallies, after.value, slicesOf(after));
            if (isConstituent(after)) {
                constituents[constKey(after.value)] += 1;
            }
        }
        tx.update(officialRef, { approvalTallies: tallies, approvalConstituents: constituents });
        markEvent(tx, event.id);
    });
});
/** Move one of an official's AMA counters by a clamped delta, exactly once. */
async function bumpOfficialCounter(eventId, officialUid, field, delta) {
    const officialRef = db.doc(`officials/${officialUid}`);
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, eventId)))
            return;
        const snap = await tx.get(officialRef);
        if (snap.exists)
            tx.update(officialRef, { [field]: step(snap.data()?.[field], delta) });
        markEvent(tx, eventId);
    });
}
exports.onQuestionCreated = (0, firestore_2.onDocumentCreated)('officials/{officialUid}/questions/{questionId}', async (event) => bumpOfficialCounter(event.id, event.params.officialUid, 'questionsAsked', 1));
/** The official posting their response moves questionsResponded. */
exports.onQuestionResponded = (0, firestore_2.onDocumentWritten)('officials/{officialUid}/questions/{questionId}', async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (!after || before?.response || !after.response)
        return;
    await bumpOfficialCounter(event.id, event.params.officialUid, 'questionsResponded', 1);
});
/**
 * Community judgment ("did this answer it?") aggregation: recompute the
 * question's yes/no counts and status, and keep the official's
 * answered/dodged counters in step with status flips.
 */
exports.onJudgmentWrite = (0, firestore_2.onDocumentWritten)('officials/{officialUid}/questions/{questionId}/judgments/{judgeUid}', async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const questionRef = db.doc(`officials/${event.params.officialUid}/questions/${event.params.questionId}`);
    const officialRef = db.doc(`officials/${event.params.officialUid}`);
    const statDelta = ballotStatDelta(before, after);
    await db.runTransaction(async (tx) => {
        if (!(await claimEvent(tx, event.id)))
            return;
        const snap = await tx.get(questionRef);
        const stat = await readStat(tx, event.params.judgeUid, statDelta);
        // Everything is computed (and every document read) before the first
        // write, because Firestore rejects a transaction that reads after
        // writing. The question may be gone - an admin takedown of the thread -
        // in which case only the judge's own counter still has to settle.
        const q = snap.exists ? snap.data() : null;
        let counts = null;
        let officialSnap = null;
        let prevStatus = '';
        let nextStatus = '';
        if (q) {
            let yes = q.answeredYes ?? 0;
            let no = q.answeredNo ?? 0;
            let yesVerified = q.answeredYesVerified ?? 0;
            let noVerified = q.answeredNoVerified ?? 0;
            if (before) {
                before.answered ? (yes -= 1) : (no -= 1);
                if (before.verified)
                    before.answered ? (yesVerified -= 1) : (noVerified -= 1);
            }
            if (after) {
                after.answered ? (yes += 1) : (no += 1);
                if (after.verified)
                    after.answered ? (yesVerified += 1) : (noVerified += 1);
            }
            yes = Math.max(0, yes);
            no = Math.max(0, no);
            yesVerified = Math.max(0, yesVerified);
            noVerified = Math.max(0, noVerified);
            // Only verified users decide the verdict - unverified judgments are
            // displayed but can't flip the status, so a stack of throwaway
            // accounts can't brand an official a dodger (or launder a real dodge).
            prevStatus = q.status;
            nextStatus = !q.response
                ? prevStatus
                : yesVerified + noVerified >= tally_1.ANSWER_JUDGMENT_QUORUM
                    ? yesVerified > noVerified
                        ? 'answered'
                        : 'dodged'
                    : 'underReview';
            counts = {
                answeredYes: yes,
                answeredNo: no,
                answeredYesVerified: yesVerified,
                answeredNoVerified: noVerified,
                status: nextStatus,
            };
            // The official's answered/dodged counters move with the status flip.
            if (prevStatus !== nextStatus)
                officialSnap = await tx.get(officialRef);
        }
        // ── every read is done; writes only from here ──
        if (counts)
            tx.update(questionRef, counts);
        if (officialSnap?.exists) {
            const o = officialSnap.data();
            const next = {};
            if (prevStatus === 'answered')
                next.questionsAnswered = step(o.questionsAnswered, -1);
            if (prevStatus === 'dodged')
                next.questionsDodged = step(o.questionsDodged, -1);
            if (nextStatus === 'answered')
                next.questionsAnswered = step(o.questionsAnswered, 1);
            if (nextStatus === 'dodged')
                next.questionsDodged = step(o.questionsDodged, 1);
            if (Object.keys(next).length)
                tx.update(officialRef, next);
        }
        writeStat(tx, stat, 'judgments', statDelta);
        markEvent(tx, event.id);
    });
});
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
exports.deleteAccount = (0, https_1.onCall)(APP_CHECK, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in first.');
    }
    const uid = request.auth.uid;
    const profile = await db.doc(`users/${uid}`).get();
    if (profile.exists && profile.data().role === 'official') {
        throw new https_1.HttpsError('failed-precondition', 'Official accounts are removed by the platform operator.');
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
    const identityClaimId = profile.exists ? profile.data().identityClaimId : null;
    if (identityClaimId) {
        await db.doc(`identityClaims/${identityClaimId}`).delete().catch(() => { });
    }
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await (0, auth_1.getAuth)().deleteUser(uid);
    return { ok: true };
});
/**
 * DEV ONLY - simulates a passing identity verification when running against the
 * Emulator Suite. Never deployed behavior: throws outside the emulator.
 */
exports.devVerify = (0, https_1.onCall)(async (request) => {
    if (!process.env.FUNCTIONS_EMULATOR) {
        throw new https_1.HttpsError('failed-precondition', 'devVerify is emulator-only.');
    }
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in first.');
    }
    const wardId = Number(request.data?.wardId);
    if (!Number.isInteger(wardId) || wardId < WARD_MIN || wardId > WARD_MAX) {
        throw new https_1.HttpsError('invalid-argument', `wardId must be ${WARD_MIN}–${WARD_MAX}.`);
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
exports.createVerificationSession = (0, https_1.onCall)({ ...APP_CHECK, secrets: [DIDIT_API_KEY, DIDIT_WORKFLOW_ID] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in first.');
    }
    const apiKey = DIDIT_API_KEY.value();
    const workflowId = DIDIT_WORKFLOW_ID.value();
    if (!apiKey || !workflowId) {
        throw new https_1.HttpsError('failed-precondition', 'Identity verification is not configured yet.');
    }
    // Reserve a slot under the monthly cap before spending money with Didit.
    const monthKey = verificationMonthKey();
    const monthRef = db.doc(`verificationUsage/${monthKey}`);
    const sessionNumber = await db.runTransaction(async (tx) => {
        const snap = await tx.get(monthRef);
        const sessions = snap.data()?.sessions ?? 0;
        if (sessions >= VERIFICATION_MONTHLY_CAP)
            return null;
        tx.set(monthRef, { sessions: sessions + 1, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
        return sessions + 1;
    });
    if (sessionNumber === null) {
        throw new https_1.HttpsError('resource-exhausted', 'Verification is at capacity for this month. Please try again after the 1st.');
    }
    if (sessionNumber > VERIFICATION_FREE_TIER) {
        console.warn(`Verification session ${sessionNumber}/${VERIFICATION_MONTHLY_CAP} this month is past the ${VERIFICATION_FREE_TIER}-session free tier and bills us.`);
    }
    let url;
    try {
        const resp = await fetch('https://verification.didit.me/v2/session/', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ workflow_id: workflowId, vendor_data: request.auth.uid }),
        });
        if (!resp.ok) {
            console.error('Didit session creation failed:', resp.status, await resp.text());
            throw new https_1.HttpsError('internal', 'Could not start verification. Try again shortly.');
        }
        const session = (await resp.json());
        url = session.url ?? session.session_url;
        if (!url) {
            console.error('Didit session response had no url field:', JSON.stringify(session).slice(0, 300));
            throw new https_1.HttpsError('internal', 'Could not start verification. Try again shortly.');
        }
        // Record the reservation so the webhook can settle this session's slot
        // (return it if the link expires unopened, keep it if modules billed).
        if (session.session_id) {
            await db.doc(`verificationSessions/${session.session_id}`).set({
                uid: request.auth.uid,
                monthKey,
                settled: false,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        else {
            console.warn('Didit session response had no session_id - slot cannot be released on expiry.');
        }
    }
    catch (err) {
        // No session was actually started, so give the slot back.
        await monthRef
            .set({ sessions: firestore_1.FieldValue.increment(-1), updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true })
            .catch(() => { });
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error('Didit session creation threw:', err);
        throw new https_1.HttpsError('internal', 'Could not start verification. Try again shortly.');
    }
    return { inquiryUrl: url };
});
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
exports.diditWebhook = (0, https_2.onRequest)({ secrets: [DIDIT_WEBHOOK_SECRET] }, async (req, res) => {
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
    const uid = body.vendor_data ?? null;
    const status = body.status;
    const sessionId = body.session_id ?? null;
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
    const docKey = idv.document_number && idv.issuing_state
        ? crypto
            .createHash('sha256')
            .update(`${idv.issuing_state}:${idv.document_number}:${idv.date_of_birth ?? ''}`)
            .digest('hex')
        : null;
    if (docKey) {
        const claimed = await db.runTransaction(async (tx) => {
            const mapRef = db.doc(`identityClaims/${docKey}`);
            const existing = await tx.get(mapRef);
            if (existing.exists && existing.data().uid !== uid)
                return false;
            tx.set(mapRef, { uid, updatedAt: firestore_1.FieldValue.serverTimestamp() });
            return true;
        });
        if (!claimed) {
            console.warn('Duplicate identity: document already verified another uid.');
            res.status(200).send('Identity already verified on another account.');
            return;
        }
    }
    else {
        console.warn('Approved session carried no document identity - dedup not enforced.');
    }
    try {
        await db.doc(`users/${uid}`).update({
            verified: true,
            identityClaimId: docKey,
        });
    }
    catch {
        // The account may have been deleted between session and webhook. A 200
        // stops Didit from retrying a verification that can never land.
        console.warn(`Approved session for missing user ${uid} - profile not found.`);
        res.status(200).send('No such user.');
        return;
    }
    res.status(200).send('OK');
});
//# sourceMappingURL=index.js.map