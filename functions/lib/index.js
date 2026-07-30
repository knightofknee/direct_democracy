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
exports.personaWebhook = exports.createVerificationSession = exports.devVerify = void 0;
const crypto = __importStar(require("crypto"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const WARD_MIN = 1;
const WARD_MAX = 50;
async function applyVerification(uid, result) {
    await db.doc(`users/${uid}`).update({
        verified: result.verified,
        wardId: result.wardId,
        registeredVoter: result.registeredVoter,
    });
}
/**
 * DEV ONLY — simulates a passing Persona inquiry when running against the
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
exports.createVerificationSession = (0, https_1.onCall)(async (request) => {
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
//# sourceMappingURL=index.js.map