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
import * as crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from '@apple/app-store-server-library';
import { GoogleAuth } from 'google-auth-library';

export const BUNDLE_ID = 'com.briancarlisle.directdemocracy';
export const ANDROID_PACKAGE = 'com.briancarlisle.directdemocracy';
/** The App Store's numeric id for the app (itunes lookup by bundle id). */
const APP_APPLE_ID = 6797189381;

/** Didit's free ID checks per calendar month. */
export const FREE_CHECKS_PER_MONTH = 500;

/** What a credit pays for: a session on the main workflow, or a move with a bill. */
export type CreditType = 'id' | 'bill';

/**
 * Store product ids (identical in App Store Connect and Play Console). The
 * bill move has two prices: while Didit's free 500 cover its ID checks, and
 * after. Either one buys the same `bill` credit.
 */
export const PRODUCTS = {
  verification: 'verification_standard',
  billReduced: 'verification_bill_reduced',
  bill: 'verification_bill_standard',
} as const;

const CREDIT_FOR_PRODUCT: Record<string, CreditType> = {
  [PRODUCTS.verification]: 'id',
  [PRODUCTS.billReduced]: 'bill',
  [PRODUCTS.bill]: 'bill',
};

export function creditForProduct(productId: string): CreditType | null {
  return CREDIT_FOR_PRODUCT[productId] ?? null;
}

/** The product to sell for a session, given how many checks ran this month. */
export function productFor(type: CreditType, checksThisMonth: number): string {
  if (type === 'id') return PRODUCTS.verification;
  return checksThisMonth < FREE_CHECKS_PER_MONTH ? PRODUCTS.billReduced : PRODUCTS.bill;
}

/**
 * A stable UUID per account, passed to the store with every purchase (Apple
 * appAccountToken, Google obfuscatedAccountId) so a purchase can only be
 * redeemed by the account that made it. Derived, not stored: the same uid
 * always gives the same token, and the token reveals nothing about the uid.
 */
export function accountTokenFor(uid: string): string {
  const h = crypto.createHash('sha256').update(`dd-verification:${uid}`).digest('hex');
  // RFC 4122 layout: version 5 nibble, variant bits 10xx.
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export interface VerifiedPurchase {
  store: 'apple' | 'google' | 'emulator';
  /** Unique per purchase within its store. */
  transactionId: string;
  productId: string;
  sandbox: boolean;
}

export class PurchaseRejected extends Error {}

// ── Apple ──────────────────────────────────────────────────────────────

let appleRoots: Buffer[] | null = null;
function appleRootCertificates(): Buffer[] {
  if (!appleRoots) {
    const dir = join(__dirname, '..', 'data', 'apple');
    appleRoots = ['AppleRootCA-G3.cer', 'AppleRootCA-G2.cer', 'AppleIncRootCertificate.cer'].map(
      (f) => readFileSync(join(dir, f))
    );
  }
  return appleRoots;
}

const appleVerifiers = new Map<Environment, SignedDataVerifier>();
function appleVerifier(env: Environment): SignedDataVerifier {
  let v = appleVerifiers.get(env);
  if (!v) {
    v = new SignedDataVerifier(
      appleRootCertificates(),
      true,
      env,
      BUNDLE_ID,
      env === Environment.PRODUCTION ? APP_APPLE_ID : undefined
    );
    appleVerifiers.set(env, v);
  }
  return v;
}

/**
 * Verify a StoreKit 2 signed transaction (the JWS the app receives). App
 * Review and TestFlight buy in the sandbox, so a transaction that isn't a
 * production one is tried against the sandbox before it's rejected.
 */
export async function verifyApplePurchase(jws: string, uid: string): Promise<VerifiedPurchase> {
  let payload;
  let sandbox = false;
  try {
    payload = await appleVerifier(Environment.PRODUCTION).verifyAndDecodeTransaction(jws);
  } catch (err) {
    if (
      err instanceof VerificationException &&
      err.status === VerificationStatus.INVALID_ENVIRONMENT
    ) {
      payload = await appleVerifier(Environment.SANDBOX).verifyAndDecodeTransaction(jws);
      sandbox = true;
    } else if (err instanceof VerificationException) {
      throw new PurchaseRejected(`Apple transaction failed verification (${err.status}).`);
    } else {
      throw err;
    }
  }
  if (!payload.transactionId || !payload.productId) {
    throw new PurchaseRejected('Apple transaction is missing its id or product.');
  }
  if (payload.revocationDate) throw new PurchaseRejected('Apple refunded this purchase.');
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

const googleAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});

const PLAY = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}/purchases/products`;

/**
 * Look a Play purchase token up with the Play Developer API and acknowledge
 * it (an unacknowledged purchase is refunded by Google after three days).
 * The app consumes it afterwards so the same product can be bought again.
 */
export async function verifyGooglePurchase(
  productId: string,
  token: string,
  uid: string
): Promise<VerifiedPurchase> {
  const client = await googleAuth.getClient();
  const url = `${PLAY}/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
  let data: {
    purchaseState?: number;
    orderId?: string;
    acknowledgementState?: number;
    obfuscatedExternalAccountId?: string;
    purchaseType?: number;
  };
  try {
    data = (await client.request({ url })).data as typeof data;
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 400 || status === 404 || status === 410) {
      throw new PurchaseRejected('Google Play does not recognize this purchase.');
    }
    throw err;
  }
  // 0 purchased, 1 canceled, 2 pending (e.g. cash payment not yet made).
  if (data.purchaseState !== 0) throw new PurchaseRejected('This purchase is not complete.');
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
