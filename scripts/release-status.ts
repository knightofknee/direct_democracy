/**
 * Release status in one screen: what config/app says (latestVersion = warn,
 * minVersion = block, both on the BINARY version scheme, the only one this
 * project knows) and whether the LIVE Firestore rules carry the
 * verified-only approvals gate. Read-only; the release-day
 * reminder task runs it, and so can you.
 *
 *   gcloud auth application-default login
 *   npm run release-status
 */
import { execSync } from 'child_process';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';
const APPROVALS_GATE = 'me().verified == true\n          && me().wardId != null';

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

/** The ruleset the live release points at, via the Rules API with ADC. */
async function liveRulesHaveGate(): Promise<boolean | string> {
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
    // Comments come off first (the rule's own comment quotes the gate) and
    // whitespace is collapsed so a reformat cannot produce a false "missing".
    const norm = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ');
    return norm(content).includes(norm(APPROVALS_GATE));
  } catch (e) {
    return `rules check failed: ${e instanceof Error ? e.message : e}`;
  }
}

async function main() {
  const [cfgSnap, gate] = await Promise.all([db.doc('config/app').get(), liveRulesHaveGate()]);
  const cfg = cfgSnap.data() ?? {};
  console.log(`config/app.latestVersion:    ${cfg.latestVersion ?? '(unset)'}   (warn dial)`);
  console.log(`config/app.minVersion:       ${cfg.minVersion ?? '(unset)'}   (block dial)`);
  console.log(`Live rules have approvals gate: ${gate === true ? 'YES' : gate === false ? 'NO' : gate}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
