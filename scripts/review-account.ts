/**
 * Sets up an App Review account so a reviewer can reach every verification
 * in-app purchase. Inside the month's free 500 an ID check is free and a bill
 * move sells only the reduced price, so without this a reviewer never sees
 * the other two products. The server reads `verificationLimits/{uid}.reviewPricing`
 * (Admin SDK only) and prices that one account as if the month were inside
 * the 500 or past it, with no 90-day move window, no handed-back open
 * session, and no free-attempt count, so each flow can be shown again.
 *
 * The account must already exist (sign up in the app). Every run also clears
 * the account's leftover credits and open session, so the next tap sells.
 *
 *   npm run review-account -- --email <email> --pricing past500
 *   npm run review-account -- --email <email> --pricing within500 --verified
 *   npm run review-account -- --email <email> --off
 *
 * --verified marks the account verified in the hidden test ward 51 (moving,
 * where the bill products live, is only offered to verified accounts).
 * --unverified clears that again. --off removes the review pricing.
 *
 * Against production (default) it needs Google credentials:
 *   gcloud auth application-default login
 * Against the emulator, add --emulator.
 */

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null;
}
const has = (flag: string) => process.argv.includes(`--${flag}`);
const useEmulator = has('emulator');

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099';
}

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';
/** The hidden test ward (TEST_WARD in src/constants/chicago.ts). */
const TEST_WARD = 51;

const app = useEmulator
  ? initializeApp({ projectId: PROJECT_ID })
  : initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const email = arg('email');
  const pricing = arg('pricing');
  const off = has('off');
  if (!email || (!off && pricing !== 'past500' && pricing !== 'within500')) {
    console.error(
      'Usage: npm run review-account -- --email <email> (--pricing past500|within500 | --off) [--verified | --unverified] [--emulator]'
    );
    process.exit(1);
  }

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`No account found for ${email} - sign it up in the app first.`);
    process.exit(1);
  }
  const uid = user.uid;
  const profile = (await db.doc(`users/${uid}`).get()).data();
  if (!profile) {
    console.error(`${email} has no users/${uid} profile yet - open the app signed in as it once.`);
    process.exit(1);
  }
  if (profile.role && profile.role !== 'citizen') {
    console.error(`${email} is a ${profile.role} account. Use a plain citizen account for review.`);
    process.exit(1);
  }
  if (profile.verified && profile.wardId !== TEST_WARD && !has('unverified')) {
    console.error(`${email} is verified in ward ${profile.wardId}. Review accounts live in ward ${TEST_WARD}.`);
    process.exit(1);
  }

  if (has('verified')) {
    await db.doc(`users/${uid}`).update({ verified: true, wardId: TEST_WARD, reverifyAt: FieldValue.delete() });
    await auth.updateUser(uid, { emailVerified: true });
  } else if (has('unverified')) {
    await db.doc(`users/${uid}`).update({ verified: false, wardId: null, reverifyAt: FieldValue.delete() });
  } else {
    await db.doc(`users/${uid}`).update({ reverifyAt: FieldValue.delete() });
  }

  await db.doc(`verificationLimits/${uid}`).set(
    {
      reviewPricing: off ? FieldValue.delete() : pricing,
      open: FieldValue.delete(),
      startingAt: FieldValue.delete(),
      freeStarts: [],
    },
    { merge: true }
  );
  await db.doc(`verificationCredits/${uid}`).delete();

  const after = (await db.doc(`users/${uid}`).get()).data()!;
  console.log(`✓ ${email}`);
  console.log(`  review pricing: ${off ? 'off' : pricing}`);
  console.log(`  verified: ${after.verified === true}${after.verified ? ` (ward ${after.wardId})` : ''}`);
  console.log('  credits and open session cleared, move window open');
  if (!off) {
    const moves = pricing === 'past500' ? 'verification_bill_standard' : 'verification_bill_reduced';
    console.log(
      after.verified
        ? `  Settings > Verify with my ID sells ${pricing === 'past500' ? 'verification_standard' : 'nothing (free)'}; Verify with a bill or statement sells ${moves}`
        : `  Verify sells ${pricing === 'past500' ? 'verification_standard' : 'nothing (free)'}`
    );
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
