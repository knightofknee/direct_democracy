/**
 * Release status in one screen: what config/app says (iOS: latestVersion =
 * warn, minVersion = block, on the BINARY version scheme, the only one this
 * project knows; Android: androidLatestBuild / androidMinBuild, on the build
 * number) and whether the LIVE Firestore rules match firestore.rules here.
 * Read-only; the release-day reminder task runs it, and so can you.
 *
 *   gcloud auth application-default login
 *   npm run release-status
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

/** The ruleset the live release points at, via the Rules API with ADC. */
async function liveRulesMatchLocal(): Promise<boolean | string> {
  try {
    const token = execSync('gcloud auth application-default print-access-token', { encoding: 'utf8' }).trim();
    const h = { authorization: `Bearer ${token}` };
    const rel = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore`,
      { headers: h }
    ).then((r) => r.json() as Promise<{ rulesetName?: string }>);
    if (!rel.rulesetName) return 'no cloud.firestore release found';
    const rs = await fetch(`https://firebaserules.googleapis.com/v1/${rel.rulesetName}`, { headers: h }).then(
      (r) => r.json() as Promise<{ source?: { files?: { content: string }[] } }>
    );
    const content = rs.source?.files?.map((f) => f.content).join('\n') ?? '';
    // Whitespace is collapsed so a reformat cannot produce a false mismatch.
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    return norm(content) === norm(readFileSync('firestore.rules', 'utf8'));
  } catch (e) {
    return `rules check failed: ${e instanceof Error ? e.message : e}`;
  }
}

async function main() {
  const [cfgSnap, match] = await Promise.all([db.doc('config/app').get(), liveRulesMatchLocal()]);
  const cfg = cfgSnap.data() ?? {};
  const show = (v: unknown) => (v === undefined || v === '' ? '(unset)' : String(v));
  console.log(`iOS      latestVersion:       ${show(cfg.latestVersion)}   (warn dial)`);
  console.log(`iOS      minVersion:          ${show(cfg.minVersion)}   (block dial)`);
  console.log(`Android  androidLatestBuild:  ${show(cfg.androidLatestBuild)}   (warn dial, versionCode)`);
  console.log(`Android  androidMinBuild:     ${show(cfg.androidMinBuild)}   (block dial, versionCode)`);
  console.log(`Store links: iOS ${cfg.iosUrl ? 'set' : 'MISSING'}, Android ${cfg.androidUrl ? 'set' : 'MISSING (Android never nudges)'}`);
  console.log(`Live rules match firestore.rules: ${match === true ? 'YES' : match === false ? 'NO, deploy them' : match}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
