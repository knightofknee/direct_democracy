/**
 * Writes each alderman's ward newsletter link (officials/{uid}.newsletterUrl)
 * from scripts/data/ward-newsletters.json. Each entry names the page on the
 * ward office's own site that points to the newsletter (sourceUrl), so the
 * link is the office's own, not a guess.
 *
 * Full sync, re-runnable: wards in the file get their link, wards missing
 * from it (or with url null) have any old link removed. seed-aldermen merges,
 * so it never touches this field.
 *
 *   gcloud auth application-default login
 *   npm run set-newsletters -- --dry-run
 *   npm run set-newsletters
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';
const dryRun = process.argv.includes('--dry-run');

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

interface Entry {
  ward: number;
  alderman: string;
  /** Where a resident reads past issues (preferred) or signs up; null if none found. */
  url: string | null;
  /** The ward office page that links to it. */
  sourceUrl: string | null;
  /** A feed of past issues, kept for a future summary job. */
  rssUrl?: string | null;
  /** A page of issue links, read by scripts/newsletters.ts when there is no feed. */
  archiveUrl?: string | null;
  /** Where the newsletter inbox's subscription to this ward stands. */
  inbox?: string;
  /** What was found, and why a ward has no link. */
  note?: string;
  checked: string;
}

function validate(entries: Entry[]): void {
  const problems: string[] = [];
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isInteger(e.ward) || e.ward < 1 || e.ward > 50) problems.push(`bad ward ${e.ward}`);
    if (seen.has(e.ward)) problems.push(`ward ${e.ward} listed twice`);
    seen.add(e.ward);
    for (const [k, v] of [['url', e.url], ['sourceUrl', e.sourceUrl], ['rssUrl', e.rssUrl]] as const) {
      if (v != null && (!/^https:\/\//.test(v) || v.length > 500)) problems.push(`ward ${e.ward}: ${k} must be https`);
    }
    if (e.url && !e.sourceUrl) problems.push(`ward ${e.ward}: a link needs its sourceUrl`);
  }
  if (problems.length) {
    console.error('Newsletter data problems:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

async function main() {
  const entries: Entry[] = JSON.parse(
    readFileSync(join(__dirname, 'data', 'ward-newsletters.json'), 'utf8')
  );
  validate(entries);
  const byWard = new Map(entries.map((e) => [e.ward, e]));

  const snap = await db.collection('officials').where('wardId', '!=', null).get();
  let set = 0;
  let cleared = 0;
  for (const doc of snap.docs) {
    const wardId = doc.get('wardId') as number;
    if (wardId < 1 || wardId > 50) continue; // ward 51 is the test ward
    const url = byWard.get(wardId)?.url ?? null;
    const current = (doc.get('newsletterUrl') as string | undefined) ?? null;
    if (url === current) continue;
    console.log(`ward ${String(wardId).padStart(2)} ${doc.get('name')}: ${current ?? '-'} -> ${url ?? '-'}`);
    if (dryRun) continue;
    await doc.ref.update({ newsletterUrl: url ?? FieldValue.delete() });
    if (url) set += 1;
    else cleared += 1;
  }
  console.log(dryRun ? 'Dry run, nothing written.' : `Done: ${set} set, ${cleared} cleared.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
