/**
 * Marks an account verified for a ward (or unverifies it) - the operator's
 * stand-in for the Didit webhook, used for App Store review accounts and
 * manual fixes. Clients can never write verified/wardId themselves.
 *
 * Against production (default) it needs Google credentials:
 *   gcloud auth application-default login
 *   npm run verify-user -- --email test3@test.com --ward 1
 *
 * Revert:
 *   npm run verify-user -- --email test3@test.com --unverify
 *
 * Against the emulator, add --emulator.
 */

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null;
}
const useEmulator = process.argv.includes('--emulator');
const unverify = process.argv.includes('--unverify');

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099';
}

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';

const app = useEmulator
  ? initializeApp({ projectId: PROJECT_ID })
  : initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const email = arg('email');
  if (!email) {
    console.error('Usage: npm run verify-user -- --email <email> [--ward 1] [--unverify] [--emulator]');
    process.exit(1);
  }

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`No account found for ${email} - have them sign up in the app first.`);
    process.exit(1);
  }

  if (unverify) {
    await db.doc(`users/${user.uid}`).update({ verified: false, wardId: null });
    console.log(`✓ ${email} is unverified again.`);
    console.log(`  users/${user.uid}: verified false, wardId null`);
    return;
  }

  const wardId = Number(arg('ward') ?? 1);
  if (!Number.isInteger(wardId) || wardId < 1 || wardId > 50) {
    console.error('--ward must be a whole number from 1 to 50.');
    process.exit(1);
  }

  await db.doc(`users/${user.uid}`).update({ verified: true, wardId });
  console.log(`✓ ${email} is verified in ward ${wardId}.`);
  console.log(`  users/${user.uid}: verified true, wardId ${wardId}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
