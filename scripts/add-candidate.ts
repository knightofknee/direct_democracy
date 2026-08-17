/**
 * Provisions a candidate account (the operator's job, like officials).
 *
 * The person signs up in the app first (any sign-in method); this script then
 * promotes that account by email: sets role 'candidate' on their profile and
 * creates their candidates/{uid} card. Clients can never do either - the
 * security rules pin role changes and candidate cards to the Admin SDK.
 *
 * Against production (default) it needs Google credentials:
 *   gcloud auth application-default login
 *   npm run add-candidate -- --email you@example.com --name "Your Name" \
 *     --source https://www.waldgrave.com/chigui --website https://www.waldgrave.com
 *
 * Against the emulator:
 *   npm run add-candidate -- --emulator --email candidate@demo.local --name "Demo Candidate"
 *
 * Optional flags:
 *   --office  "Candidate for Mayor" (default)
 *   --website https://…   public campaign-site link shown on the card
 *   --source  https://…   platform page to sync policies from; the nightly
 *                         job (or the in-app "Sync from my site" button)
 *                         imports every policy on it - nothing hand-entered.
 */

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null;
}
const useEmulator = process.argv.includes('--emulator');

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
  const name = arg('name');
  if (!email || !name) {
    console.error('Usage: npm run add-candidate -- --email <email> --name "<name>" [--office "…"] [--website https://…] [--source https://…] [--emulator]');
    process.exit(1);
  }
  const office = arg('office') ?? 'Candidate for Mayor';
  const websiteUrl = arg('website');
  const sourceUrl = arg('source');
  for (const [flag, url] of [['website', websiteUrl], ['source', sourceUrl]] as const) {
    if (url && !url.startsWith('https://')) {
      console.error(`--${flag} must be an https:// URL.`);
      process.exit(1);
    }
  }

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`No account found for ${email} - have them sign up in the app first.`);
    process.exit(1);
  }

  await db.doc(`users/${user.uid}`).update({ role: 'candidate' });

  const cardRef = db.doc(`candidates/${user.uid}`);
  const existing = await cardRef.get();
  await cardRef.set(
    {
      uid: user.uid,
      name,
      office,
      websiteUrl: websiteUrl ?? existing.data()?.websiteUrl ?? null,
      sourceUrl: sourceUrl ?? existing.data()?.sourceUrl ?? null,
      // Bio/photo are the candidate's own to edit in the app; counters are
      // trigger-maintained. Only seed them on first provision.
      ...(existing.exists
        ? {}
        : { bio: '', photoUrl: null, lastSyncedAt: null, policyCount: 0 }),
    },
    { merge: true }
  );

  console.log(`✓ ${name} (${email}) is now a candidate: ${office}`);
  console.log(`  users/${user.uid}.role = candidate`);
  console.log(`  candidates/${user.uid} ${existing.exists ? 'updated' : 'created'}`);
  if (sourceUrl) {
    console.log(`  Platform will sync from ${sourceUrl} nightly - or press "Sync from my site" in the app.`);
  } else {
    console.log('  No --source given: the candidate manages policies in the app.');
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
