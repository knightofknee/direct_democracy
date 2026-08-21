/**
 * Promotes (or demotes) an account to elected official - the operator's job,
 * used for App Store review accounts and real provisioning alike.
 *
 * The person signs up in the app first; this script then promotes that
 * account by email: sets role 'official' + verified + ward on their profile
 * and creates their officials/{uid} card. Clients can never do either - the
 * security rules pin role changes and official cards to the Admin SDK.
 *
 * Against production (default) it needs Google credentials:
 *   gcloud auth application-default login
 *   npm run set-official -- --email test2@test.com --ward 1
 *
 * Revert when done:
 *   npm run set-official -- --email test2@test.com --demote
 *
 * Optional flags:
 *   --title "Alderman, 1st Ward"   card title (default is built from --ward)
 *   --name  "Display Name"         card name (default: profile displayName)
 *   --bio   "…"                    card bio
 *   --emulator                     target the local Emulator Suite
 */

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null;
}
const useEmulator = process.argv.includes('--emulator');
const demote = process.argv.includes('--demote');

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

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

async function main() {
  const email = arg('email');
  if (!email) {
    console.error('Usage: npm run set-official -- --email <email> [--ward 1] [--title "…"] [--name "…"] [--bio "…"] [--demote] [--emulator]');
    process.exit(1);
  }

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`No account found for ${email} - have them sign up in the app first.`);
    process.exit(1);
  }
  const profileRef = db.doc(`users/${user.uid}`);
  const cardRef = db.doc(`officials/${user.uid}`);

  if (demote) {
    await profileRef.update({ role: 'citizen', verified: false, wardId: null });
    await cardRef.delete();
    console.log(`✓ ${email} is back to an unverified citizen.`);
    console.log(`  users/${user.uid}: role citizen, verified false, wardId null`);
    console.log(`  officials/${user.uid} deleted`);
    return;
  }

  const wardId = Number(arg('ward') ?? 1);
  if (!Number.isInteger(wardId) || wardId < 1 || wardId > 50) {
    console.error('--ward must be a whole number from 1 to 50.');
    process.exit(1);
  }
  const title = arg('title') ?? `Alderman, ${ordinal(wardId)} Ward`;

  const profile = await profileRef.get();
  const name = arg('name') ?? profile.data()?.displayName ?? email;
  const bio = arg('bio') ?? '';

  await profileRef.update({ role: 'official', verified: true, wardId });

  const existing = await cardRef.get();
  await cardRef.set(
    {
      uid: user.uid,
      name,
      title,
      wardId,
      // Bio/photo are the official's own to edit; counters and approval
      // tallies are trigger-maintained. Only seed them on first provision.
      ...(existing.exists
        ? {}
        : {
            bio,
            photoUrl: null,
            questionsAsked: 0,
            questionsResponded: 0,
            questionsAnswered: 0,
            questionsDodged: 0,
          }),
    },
    { merge: true }
  );

  console.log(`✓ ${name} (${email}) is now an official: ${title}`);
  console.log(`  users/${user.uid}: role official, verified true, wardId ${wardId}`);
  console.log(`  officials/${user.uid} ${existing.exists ? 'updated' : 'created'}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
