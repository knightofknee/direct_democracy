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
exports.PurchaseRejected = exports.PRODUCTS = exports.FREE_CHECKS_PER_MONTH = exports.ANDROID_PACKAGE = exports.BUNDLE_ID = void 0;
exports.creditForProduct = creditForProduct;
exports.productFor = productFor;
exports.accountTokenFor = accountTokenFor;
exports.verifyApplePurchase = verifyApplePurchase;
exports.verifyGooglePurchase = verifyGooglePurchase;
/**
 * Paid verification. Didit's first 500 ID checks each month are free; past
 * that, and for every proof-of-address move (which Didit never gives free),
 * the person buys one verification through Apple or Google. A purchase
 * becomes a credit on `verificationCredits/{uid}` (no security rule matches,
 * so only the Admin SDK touches it) and createVerificationSession spends one
 * credit per Didit session. Prices live on the store products, never here.
 *
 * Every purchase is checked with the store before it becomes a credit:
 * Apple's signed transaction is verified against Apple's root certificates
 * (functions/data/apple), Google's token is looked up in the Play Developer
 * API with this project's service account. Each store transaction is
 * recorded once in `verificationPurchases/{store}-{id}`, so redeeming the
 * same purchase twice grants nothing.
 */
const crypto = __importStar(require("crypto"));
const fs_1 = require("fs");
const path_1 = require("path");
const app_store_server_library_1 = require("@apple/app-store-server-library");
const google_auth_library_1 = require("google-auth-library");
exports.BUNDLE_ID = 'com.briancarlisle.directdemocracy';
exports.ANDROID_PACKAGE = 'com.briancarlisle.directdemocracy';
/** The App Store's numeric id for the app (itunes lookup by bundle id). */
const APP_APPLE_ID = 6797189381;
/** Didit's free ID checks per calendar month. */
exports.FREE_CHECKS_PER_MONTH = 500;
/**
 * Store product ids (identical in App Store Connect and Play Console). The
 * bill move has two prices: while Didit's free 500 cover its ID checks, and
 * after. Either one buys the same `bill` credit.
 */
exports.PRODUCTS = {
    verification: 'verification_standard',
    billReduced: 'verification_bill_reduced',
    bill: 'verification_bill_standard',
};
const CREDIT_FOR_PRODUCT = {
    [exports.PRODUCTS.verification]: 'id',
    [exports.PRODUCTS.billReduced]: 'bill',
    [exports.PRODUCTS.bill]: 'bill',
};
function creditForProduct(productId) {
    return CREDIT_FOR_PRODUCT[productId] ?? null;
}
/** The product to sell for a session, given how many checks ran this month. */
function productFor(type, checksThisMonth) {
    if (type === 'id')
        return exports.PRODUCTS.verification;
    return checksThisMonth < exports.FREE_CHECKS_PER_MONTH ? exports.PRODUCTS.billReduced : exports.PRODUCTS.bill;
}
/**
 * A stable UUID per account, passed to the store with every purchase (Apple
 * appAccountToken, Google obfuscatedAccountId) so a purchase can only be
 * redeemed by the account that made it. Derived, not stored: the same uid
 * always gives the same token, and the token reveals nothing about the uid.
 */
function accountTokenFor(uid) {
    const h = crypto.createHash('sha256').update(`dd-verification:${uid}`).digest('hex');
    // RFC 4122 layout: version 5 nibble, variant bits 10xx.
    const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
class PurchaseRejected extends Error {
}
exports.PurchaseRejected = PurchaseRejected;
// ── Apple ──────────────────────────────────────────────────────────────
let appleRoots = null;
function appleRootCertificates() {
    if (!appleRoots) {
        const dir = (0, path_1.join)(__dirname, '..', 'data', 'apple');
        appleRoots = ['AppleRootCA-G3.cer', 'AppleRootCA-G2.cer', 'AppleIncRootCertificate.cer'].map((f) => (0, fs_1.readFileSync)((0, path_1.join)(dir, f)));
    }
    return appleRoots;
}
const appleVerifiers = new Map();
function appleVerifier(env) {
    let v = appleVerifiers.get(env);
    if (!v) {
        v = new app_store_server_library_1.SignedDataVerifier(appleRootCertificates(), true, env, exports.BUNDLE_ID, env === app_store_server_library_1.Environment.PRODUCTION ? APP_APPLE_ID : undefined);
        appleVerifiers.set(env, v);
    }
    return v;
}
/**
 * Verify a StoreKit 2 signed transaction (the JWS the app receives). App
 * Review and TestFlight buy in the sandbox, so a transaction that isn't a
 * production one is tried against the sandbox before it's rejected.
 */
async function verifyApplePurchase(jws, uid) {
    let payload;
    let sandbox = false;
    try {
        payload = await appleVerifier(app_store_server_library_1.Environment.PRODUCTION).verifyAndDecodeTransaction(jws);
    }
    catch (err) {
        if (err instanceof app_store_server_library_1.VerificationException &&
            err.status === app_store_server_library_1.VerificationStatus.INVALID_ENVIRONMENT) {
            payload = await appleVerifier(app_store_server_library_1.Environment.SANDBOX).verifyAndDecodeTransaction(jws);
            sandbox = true;
        }
        else if (err instanceof app_store_server_library_1.VerificationException) {
            throw new PurchaseRejected(`Apple transaction failed verification (${err.status}).`);
        }
        else {
            throw err;
        }
    }
    if (!payload.transactionId || !payload.productId) {
        throw new PurchaseRejected('Apple transaction is missing its id or product.');
    }
    if (payload.revocationDate)
        throw new PurchaseRejected('Apple refunded this purchase.');
    if (payload.appAccountToken && payload.appAccountToken !== accountTokenFor(uid)) {
        throw new PurchaseRejected('This purchase belongs to another account.');
    }
    return {
        store: 'apple',
        transactionId: payload.transactionId,
        productId: payload.productId,
        sandbox,
    };
}
// ── Google ─────────────────────────────────────────────────────────────
const googleAuth = new google_auth_library_1.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const PLAY = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${exports.ANDROID_PACKAGE}/purchases/products`;
/**
 * Look a Play purchase token up with the Play Developer API and acknowledge
 * it (an unacknowledged purchase is refunded by Google after three days).
 * The app consumes it afterwards so the same product can be bought again.
 */
async function verifyGooglePurchase(productId, token, uid) {
    const client = await googleAuth.getClient();
    const url = `${PLAY}/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
    let data;
    try {
        data = (await client.request({ url })).data;
    }
    catch (err) {
        const status = err.response?.status;
        if (status === 400 || status === 404 || status === 410) {
            throw new PurchaseRejected('Google Play does not recognize this purchase.');
        }
        throw err;
    }
    // 0 purchased, 1 canceled, 2 pending (e.g. cash payment not yet made).
    if (data.purchaseState !== 0)
        throw new PurchaseRejected('This purchase is not complete.');
    if (data.obfuscatedExternalAccountId && data.obfuscatedExternalAccountId !== accountTokenFor(uid)) {
        throw new PurchaseRejected('This purchase belongs to another account.');
    }
    if (data.acknowledgementState !== 1) {
        await client.request({ url: `${url}:acknowledge`, method: 'POST', data: {} });
    }
    return {
        store: 'google',
        transactionId: data.orderId ?? crypto.createHash('sha256').update(token).digest('hex'),
        productId,
        // purchaseType 0 is a license tester's test purchase.
        sandbox: data.purchaseType === 0,
    };
}
//# sourceMappingURL=payments.js.map