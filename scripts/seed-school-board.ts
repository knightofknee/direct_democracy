/**
 * Seeds the schoolBoardCandidates collection - the read-only voter directory
 * for the November 3, 2026 Chicago Board of Education election - from
 * scripts/data/school-board-2026.json. Nominee cards are compiled from
 * public sources (each entry carries its sourceUrls); they are not accounts.
 *
 * Full sync, re-runnable: every entry in the file is upserted under a stable
 * slug id, and any existing doc whose id is no longer in the file is deleted
 * (candidates do drop off the ballot). Update the JSON, run again.
 *
 * Against production (default) it needs Google credentials:
 *   gcloud auth application-default login
 *   npm run seed-school-board
 *
 * Flags:
 *   --emulator   target the local Emulator Suite instead
 */

const useEmulator = process.argv.includes('--emulator');
if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'direct-democracy-e338a';

const app = useEmulator
  ? initializeApp({ projectId: PROJECT_ID })
  : initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);

interface Entry {
  name: string;
  race: string;
  incumbent: boolean;
  website: string | null;
  photoUrl?: string | null;
  runningOn: string;
  priorCareer: string | null;
  runningOnEs?: string | null;
  priorCareerEs?: string | null;
  sourceUrls: string[];
}

const VALID_RACES = new Set([
  'president',
  ...Array.from({ length: 10 }, (_, i) => [`${i + 1}a`, `${i + 1}b`]).flat(),
]);

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function validate(entries: Entry[]): void {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const id = slug(e.name);
    if (seen.has(id)) problems.push(`duplicate slug: ${id}`);
    seen.add(id);
    if (!VALID_RACES.has(e.race)) problems.push(`${e.name}: bad race "${e.race}"`);
    if (!e.runningOn?.trim()) problems.push(`${e.name}: empty runningOn`);
    if (e.website != null && !/^https:\/\//.test(e.website))
      problems.push(`${e.name}: website must be https`);
    if (e.photoUrl != null && !/^https:\/\//.test(e.photoUrl))
      problems.push(`${e.name}: photoUrl must be https`);
    if (!Array.isArray(e.sourceUrls) || e.sourceUrls.length === 0)
      problems.push(`${e.name}: needs at least one source URL`);
    for (const text of [e.runningOn, e.priorCareer ?? '', e.runningOnEs ?? '', e.priorCareerEs ?? '']) {
      if (/[–—]/.test(text)) problems.push(`${e.name}: em/en dash in copy`);
    }
  }
  if (problems.length) {
    console.error('Seed data problems:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

async function main() {
  const file = join(__dirname, 'data', 'school-board-2026.json');
  const entries: Entry[] = JSON.parse(readFileSync(file, 'utf8'));
  validate(entries);

  const col = db.collection('schoolBoardCandidates');
  const existing = await col.get();
  const keep = new Set(entries.map((e) => slug(e.name)));

  let removed = 0;
  for (const doc of existing.docs) {
    if (!keep.has(doc.id)) {
      await doc.ref.delete();
      console.log(`- removed ${doc.id} (no longer in seed file)`);
      removed++;
    }
  }

  for (const e of entries) {
    await col.doc(slug(e.name)).set(
      {
        name: e.name,
        race: e.race,
        incumbent: e.incumbent,
        website: e.website ?? null,
        photoUrl: e.photoUrl ?? null,
        runningOn: e.runningOn.trim(),
        priorCareer: e.priorCareer?.trim() || null,
        runningOnEs: e.runningOnEs?.trim() || null,
        priorCareerEs: e.priorCareerEs?.trim() || null,
        sourceUrls: e.sourceUrls,
      },
      { merge: false }
    );
  }

  const byRace = new Map<string, number>();
  for (const e of entries) byRace.set(e.race, (byRace.get(e.race) ?? 0) + 1);
  console.log(`✓ seeded ${entries.length} nominees across ${byRace.size} races (${removed} removed)`);
  for (const [race, n] of [...byRace.entries()].sort()) console.log(`  ${race}: ${n}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
