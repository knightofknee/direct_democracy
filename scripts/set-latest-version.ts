/**
 * Flips the update-nudge version after a release is confirmed live in the
 * store. Sets config/app.latestVersion, which src/components/update-modal.tsx
 * compares against the running binary's own version (src/lib/app-update.ts).
 * Use the BINARY version (the one EAS stamps into app.json), not the store
 * listing's public name if the two ever diverge.
 *
 *   npm run set-latest-version -- 1.0.9
 *
 * Android has its own dials on the build number (versionCode), since Android
 * builds only bump versionCode and several Play releases share one version
 * name. Flip each store's dial once THAT store serves the build (closed
 * testing counts: it is how testers learn a build is out):
 *
 *   npm run set-latest-version -- --android-latest 9     Android warn
 *   npm run set-latest-version -- --android-min 9        Android block ("" lifts it)
 *
 * Android builds up to versionCode 8 have no build-number check and still
 * read latestVersion / minVersion.
 *
 * Run it only once the store actually serves the update (check the listing
 * page or a device's App Store), so the nudge never sends users to a page
 * with nothing to install.
 *
 * Store links live on the same doc and are set once (or whenever they change):
 *
 *   npm run set-latest-version -- 1.0.9 --ios-url https://apps.apple.com/app/id...
 *
 * The nudge stays disabled on a platform until its URL is set; leaving
 * androidUrl absent while Android has no public release is the intended
 * off switch.
 *
 * A hard floor locks out binaries too old to support (the prompt loses its
 * Close button and ignores the snooze):
 *
 *   npm run set-latest-version -- 1.0.12 --min-version 1.0.9
 *
 * Each release's message, shown on BOTH cards (the nudge and the block) in
 * builds after 1.0.12; set it with every version flip (Spanish alongside):
 *
 *   npm run set-latest-version -- 1.0.13 \
 *     --message "The election tab has been improved, check it out. Update the app please!" \
 *     --message-es "La pestaña de elecciones mejoró, échale un ojo. ¡Actualiza la app, por favor!"
 *
 * Only binaries that shipped WITH the modal (1.0.9 and later) can be gated;
 * anything older has no code to show the prompt. Set the floor no higher
 * than a version that is actually on the store, and never above
 * latestVersion. --min-version "" clears the floor.
 *
 * Against production (default) it needs Google credentials:
 *   gcloud auth application-default login
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

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
}

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';

const app = useEmulator
  ? initializeApp({ projectId: PROJECT_ID })
  : initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

/** Dotted-version compare: negative, zero, or positive like a comparator. */
function compare(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

async function main() {
  // The version is the first bare argument that isn't a flag's value.
  const argv = process.argv.slice(2);
  const version = argv.find(
    (a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--emulator')
  );
  const iosUrl = arg('ios-url');
  const androidUrl = arg('android-url');
  const androidLatest = arg('android-latest');
  const androidMinIdx = process.argv.indexOf('--android-min');
  const androidMin = androidMinIdx >= 0 ? (process.argv[androidMinIdx + 1] ?? '') : null;
  for (const n of [androidLatest, androidMin]) {
    if (n && !/^[1-9]\d*$/.test(n)) {
      console.error('Not a build number:', n);
      process.exit(1);
    }
  }
  const minIdx = process.argv.indexOf('--min-version');
  const minVersion = minIdx >= 0 ? (process.argv[minIdx + 1] ?? '') : null;
  if (minVersion && !/^\d+(\.\d+)*$/.test(minVersion)) {
    console.error('Not a dotted version:', minVersion);
    process.exit(1);
  }

  // Store links may be set ahead of the first flip (version omitted); a
  // version flip alone leaves the link fields untouched via the merge.
  if (version && !/^\d+(\.\d+)*$/.test(version)) {
    console.error('Not a dotted version:', version);
    process.exit(1);
  }
  if (!version && !iosUrl && !androidUrl && minVersion === null && androidLatest === null && androidMin === null) {
    console.error(
      'Usage: npm run set-latest-version -- [<binary version, e.g. 1.0.9>] [--min-version V|""]' +
        ' [--android-latest BUILD] [--android-min BUILD|""] [--ios-url URL] [--android-url URL] [--emulator]'
    );
    process.exit(1);
  }

  const update: Record<string, string | number | FieldValue> = {};
  if (version) update.latestVersion = version;
  if (iosUrl) update.iosUrl = iosUrl;
  if (androidUrl) update.androidUrl = androidUrl;
  if (minVersion !== null) update.minVersion = minVersion;
  if (androidLatest) update.androidLatestBuild = Number(androidLatest);
  if (androidMin !== null) update.androidMinBuild = androidMin ? Number(androidMin) : FieldValue.delete();
  const message = arg('message');
  const messageEs = arg('message-es');
  if (message) update.updateMessage = message;
  if (messageEs) update.updateMessageEs = messageEs;
  const current = (await db.doc('config/app').get()).data() ?? {};
  const floor = minVersion ?? (current.minVersion as string | undefined) ?? '';
  const latest = version ?? (current.latestVersion as string | undefined) ?? '';
  if (floor && latest && compare(floor, latest) > 0) {
    console.error(`minVersion ${floor} is above latestVersion ${latest}: that would lock out the current release.`);
    process.exit(1);
  }
  const aFloor = androidMin !== null ? Number(androidMin || 0) : Number(current.androidMinBuild ?? 0);
  const aLatest = androidLatest ? Number(androidLatest) : Number(current.androidLatestBuild ?? 0);
  if (aFloor && aFloor > aLatest) {
    console.error(`androidMinBuild ${aFloor} is above androidLatestBuild ${aLatest || '(unset)'}: that would lock out the current release.`);
    process.exit(1);
  }
  await db.doc('config/app').set(update, { merge: true });

  const doc = await db.doc('config/app').get();
  console.log('config/app is now:', doc.data());
  if (minVersion) {
    console.log('Binaries older than', minVersion, 'are now locked out until they update (1.0.9+ only; older builds have no prompt).');
  }
  if (version) {
    console.log(
      'iOS binaries older than', version, '(and Android builds 8 and older) will show the update nudge.'
    );
  }
  if (androidLatest) {
    console.log('Android builds older than', androidLatest, 'will show the update nudge.');
  }
  if (androidMin) {
    console.log('Android builds older than', androidMin, 'are now locked out until they update.');
  }
}

main().then(() => process.exit(0));
