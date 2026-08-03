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
exports.personaWebhook = exports.createVerificationSession = exports.devVerify = exports.deleteAccount = exports.onJudgmentWrite = exports.onQuestionResponded = exports.onQuestionCreated = exports.onApprovalWrite = exports.onQuestionDeleted = exports.onConcernDeleted = exports.onCommentDeleted = exports.onCommentCreated = exports.onPollVoteWrite = exports.onConcernVoteWrite = exports.onConcernCreated = void 0;
const crypto = __importStar(require("crypto"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
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
    const personaAccountId = profile.exists ? profile.data().personaAccountId : null;
    if (personaAccountId) {
        await db.doc(`personaAccounts/${personaAccountId}`).delete().catch(() => { });
    }
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await (0, auth_1.getAuth)().deleteUser(uid);
    return { ok: true };
});
/**
 * DEV ONLY - simulates a passing Persona inquiry when running against the
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
 * Returns a hosted Persona inquiry URL for the signed-in user. The user's uid
 * rides along as reference-id so the webhook can match the result back.
 *
 * Required environment configuration (set as function secrets/params):
 *   PERSONA_TEMPLATE_ID    - inquiry template (govt ID + address collection)
 *   PERSONA_ENVIRONMENT_ID - Persona environment
 */
exports.createVerificationSession = (0, https_1.onCall)(APP_CHECK, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in first.');
    }
    const templateId = process.env.PERSONA_TEMPLATE_ID;
    const environmentId = process.env.PERSONA_ENVIRONMENT_ID;
    if (!templateId || !environmentId) {
        throw new https_1.HttpsError('failed-precondition', 'Persona is not configured yet.');
    }
    const url = `https://withpersona.com/verify` +
        `?inquiry-template-id=${encodeURIComponent(templateId)}` +
        `&environment-id=${encodeURIComponent(environmentId)}` +
        `&reference-id=${encodeURIComponent(request.auth.uid)}`;
    return { inquiryUrl: url };
});
/**
 * Persona webhook - the only writer of `verified` in production.
 *
 * Configure in Persona: event `inquiry.completed`, pointed at this function's
 * URL, with a shared secret stored as PERSONA_WEBHOOK_SECRET.
 *
 * Ward derivation: the inquiry template should attach the resident's ward as
 * a custom field (`ward_id`), e.g. via an address-to-ward lookup step. Until
 * that lookup exists, inquiries without a ward are recorded as verified with
 * no ward (city-level verified, no ward tab).
 */
exports.personaWebhook = (0, https_2.onRequest)(async (req, res) => {
    const secret = process.env.PERSONA_WEBHOOK_SECRET;
    if (!secret) {
        res.status(500).send('Webhook secret not configured.');
        return;
    }
    // Persona signs webhooks: Persona-Signature: t=<ts>,v1=<hmac>
    const signature = req.header('Persona-Signature') ?? '';
    const parts = Object.fromEntries(signature.split(',').map((kv) => kv.trim().split('=')));
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
    // Reject replays of old signed payloads (Persona's t is unix seconds).
    if (Math.abs(Date.now() / 1000 - Number(t)) > 5 * 60) {
        res.status(401).send('Stale signature.');
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
    // 'completed' = every required verification passed; 'approved' = a decision
    // workflow signed off. Anything else (failed / declined / expired /
    // needs_review) must NOT mint verified=true. If the inquiry template uses
    // decisioning, point the webhook at inquiry.approved instead and this
    // check still holds.
    if (!uid || (status !== 'completed' && status !== 'approved')) {
        res.status(200).send('Not a passing inquiry.');
        return;
    }
    const fields = inquiry?.attributes?.fields ?? {};
    const wardRaw = Number(fields['ward_id']?.value);
    const wardId = Number.isInteger(wardRaw) && wardRaw >= WARD_MIN && wardRaw <= WARD_MAX ? wardRaw : null;
    // One verified human, one verified account. Persona assigns each person a
    // stable account id (enable account deduplication on the inquiry
    // template); if this identity already verified a different uid, refuse.
    const personaAccountId = inquiry?.relationships?.account?.data?.id ?? null;
    if (personaAccountId) {
        const claimed = await db.runTransaction(async (tx) => {
            const mapRef = db.doc(`personaAccounts/${personaAccountId}`);
            const existing = await tx.get(mapRef);
            if (existing.exists && existing.data().uid !== uid)
                return false;
            tx.set(mapRef, { uid, updatedAt: firestore_1.FieldValue.serverTimestamp() });
            return true;
        });
        if (!claimed) {
            console.warn(`Duplicate identity: Persona account ${personaAccountId} already verified another uid.`);
            res.status(200).send('Identity already verified on another account.');
            return;
        }
    }
    else {
        console.warn('Inquiry carried no Persona account id - dedup not enforced for this verification.');
    }
    try {
        await db.doc(`users/${uid}`).update({
            verified: true,
            wardId,
            personaAccountId,
        });
    }
    catch {
        // The account may have been deleted between inquiry and webhook. A 200
        // stops Persona from retrying a verification that can never land.
        console.warn(`Verified inquiry for missing user ${uid} - profile not found.`);
        res.status(200).send('No such user.');
        return;
    }
    res.status(200).send('OK');
});
//# sourceMappingURL=index.js.map