/**
 * Operator-side platform sync: pull a candidate's policies from their
 * sourceUrl right now instead of waiting for the nightly job. Needed for
 * placeholder candidates (add-candidate --create), whose accounts have no
 * password, so nobody can press "Sync from my site" in the app for them.
 *
 *   gcloud auth application-default login
 *   npm run sync-platform -- <candidateUid> [<candidateUid> ...]
 *
 * Mirrors syncCandidatePlatform in functions/src/index.ts (same fields, same
 * slug-keyed upsert) - keep the two in step; the deployed function stays the
 * canonical nightly path.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { parsePlatformHtml } from '../functions/src/platform';

const app = initializeApp({ credential: applicationDefault(), projectId: 'direct-democracy-e338a' });
const db = getFirestore(app);

async function sync(candidateUid: string) {
  const card = await db.doc(`candidates/${candidateUid}`).get();
  const sourceUrl = card.data()?.sourceUrl as string | null;
  if (!sourceUrl) throw new Error(`No sourceUrl on candidates/${candidateUid}`);

  const resp = await fetch(sourceUrl, { headers: { accept: 'text/html' } });
  if (!resp.ok) throw new Error(`Fetching ${sourceUrl} failed: ${resp.status}`);
  const parsed = parsePlatformHtml(await resp.text());

  const policiesRef = db.collection(`candidates/${candidateUid}/policies`);
  const existing = await policiesRef.get();
  const byId = new Map(existing.docs.map((d) => [d.id, d]));

  const batch = db.batch();
  const seen = new Set<string>();
  for (const p of parsed) {
    const current = byId.get(p.slug);
    if (current && current.data().source !== 'site') {
      console.warn(`Sync skipped "${p.title}": id ${p.slug} is an in-app policy.`);
      continue;
    }
    seen.add(p.slug);
    const fields = {
      section: p.section,
      title: p.title,
      body: p.body,
      links: p.links,
      order: p.order,
      archived: false,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (current) {
      batch.update(current.ref, fields);
    } else {
      batch.set(policiesRef.doc(p.slug), {
        ...fields,
        candidateUid,
        source: 'site',
        tallies: { all: {}, verified: {}, totalAll: 0, totalVerified: 0 },
        commentCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  let archived = 0;
  for (const doc of existing.docs) {
    if (doc.data().source === 'site' && !seen.has(doc.id) && !doc.data().archived) {
      batch.update(doc.ref, { archived: true, updatedAt: FieldValue.serverTimestamp() });
      archived += 1;
    }
  }

  batch.update(db.doc(`candidates/${candidateUid}`), {
    lastSyncedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  console.log(`${card.data()?.name}: synced ${seen.size} policies (${archived} archived) from ${sourceUrl}`);
}

async function main() {
  for (const uid of process.argv.slice(2)) {
    await sync(uid);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
