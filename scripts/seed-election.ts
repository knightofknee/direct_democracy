/**
 * Seeds the electionCandidates and electionRaceNotes collections - the
 * read-only voter directory for the February 23, 2027 municipal election
 * (clerk, treasurer, aldermen, police district councils; the mayoral field
 * is seed-mayor-games) - from scripts/data/municipal-2027.json. Candidate
 * cards are compiled from public sources (each entry carries its
 * sourceUrls); they are not accounts.
 *
 * Full sync per election, re-runnable: every entry in a file is upserted
 * under a stable `${election}--${slug}` id, and any existing doc for that
 * election whose id is no longer in the file is deleted (candidates do drop
 * off the ballot). Update the JSON, run again. Files:
 *
 *   scripts/data/municipal-2027.json   election "2027-municipal"
 *
 * Elections that are over (RETIRED_ELECTIONS) have their cards, race
 * notes, and the 2026 school board directory deleted on every run, so a
 * past ballot never lingers in production.
 *
 * Against production (default) it needs Google credentials:
 *   gcloud auth application-default login
 *   npm run seed-election
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
  party: string | null;
  incumbent: boolean;
  website: string | null;
  writeIn?: boolean;
  photoUrl?: string | null;
  photoFrame?: { x: number; y: number; zoom: number } | null;
  runningOn: string;
  priorCareer: string | null;
  runningOnEs?: string | null;
  priorCareerEs?: string | null;
  sourceUrls: string[];
}

interface RaceNote {
  race: string;
  note: string;
  noteEs?: string | null;
  sourceUrls?: string[];
}

interface ElectionFile {
  election: string;
  candidates: Entry[];
  raceNotes?: RaceNote[];
}

// Race ids per election. Fixed ids plus numbered families (district races,
// subcircuits, police district councils); mirror of src/constants/elections.ts.
const VALID_RACES: Record<string, (race: string) => boolean> = {
  '2027-municipal': (race) =>
    race === 'clerk' || race === 'city-treasurer' || /^ward-([1-9]|[1-4]\d|50)$/.test(race) || /^pdc-\d+$/.test(race),
};

/**
 * Ballots that have been voted on. Their directories are deleted on every
 * run (the November 3, 2026 general election and its school board races
 * left the app on 2026-11-04).
 */
const RETIRED_ELECTIONS = ['2026-general'];

/** Races seeded before ids carried the race; their doc ids must not change. */
const ORIGINAL_RACES = new Set([
  'clerk',
  // The February City Treasurer race, renamed from 'treasurer' on 2026-10-09
  // (that id is the November state race); its card ids stay as they were.
  'city-treasurer',
  ...Array.from({ length: 50 }, (_, i) => `ward-${i + 1}`),
]);

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function validate(file: ElectionFile): void {
  const problems: string[] = [];
  const validRace = VALID_RACES[file.election];
  if (!validRace) {
    console.error(`Unknown election "${file.election}"`);
    process.exit(1);
  }
  const seen = new Set<string>();
  for (const e of file.candidates) {
    // The race is part of the id so the same person in two races stays
    // distinct.
    const id = `${e.race}--${slug(e.name)}`;
    if (seen.has(id)) problems.push(`duplicate slug: ${id}`);
    seen.add(id);
    if (!validRace(e.race)) problems.push(`${e.name}: bad race "${e.race}"`);
    if (!e.runningOn?.trim()) problems.push(`${e.name}: empty runningOn`);
    if (e.website != null && !/^https:\/\//.test(e.website))
      problems.push(`${e.name}: website must be https`);
    if (e.photoUrl != null && !/^https:\/\//.test(e.photoUrl))
      problems.push(`${e.name}: photoUrl must be https`);
    if (e.photoFrame != null) {
      const { x, y, zoom } = e.photoFrame;
      if (!e.photoUrl) problems.push(`${e.name}: photoFrame without a photoUrl`);
      if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1 && zoom >= 1 && zoom <= 8))
        problems.push(`${e.name}: photoFrame needs x/y in 0-1 and zoom in 1-8`);
    }
    if (e.writeIn != null && typeof e.writeIn !== 'boolean') problems.push(`${e.name}: writeIn must be boolean`);
    if (!Array.isArray(e.sourceUrls) || e.sourceUrls.length === 0)
      problems.push(`${e.name}: needs at least one source URL`);
    for (const text of [e.runningOn, e.priorCareer ?? '', e.runningOnEs ?? '', e.priorCareerEs ?? '']) {
      if (/[–—]/.test(text)) problems.push(`${e.name}: em/en dash in copy`);
    }
  }
  for (const n of file.raceNotes ?? []) {
    if (!validRace(n.race)) problems.push(`race note: bad race "${n.race}"`);
    if (!n.note?.trim()) problems.push(`race note ${n.race}: empty note`);
    if (/[–—]/.test(n.note + (n.noteEs ?? ''))) problems.push(`race note ${n.race}: em/en dash in copy`);
  }
  if (problems.length) {
    console.error(`Seed data problems in ${file.election}:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

async function seedElection(file: ElectionFile): Promise<void> {
  validate(file);
  const docId = (s: string) => `${file.election}--${s}`;

  const candidates = db.collection('electionCandidates');
  const existing = await candidates.where('election', '==', file.election).get();
  // Ids stay `${election}--${slug}` for the original fixed races (they are
  // already live) and gain the race for everything added since, where one
  // person can appear in two races.
  const idFor = (e: Entry) =>
    ORIGINAL_RACES.has(e.race) ? docId(slug(e.name)) : docId(`${e.race}--${slug(e.name)}`);
  const keep = new Set(file.candidates.map(idFor));

  let removed = 0;
  for (const doc of existing.docs) {
    if (!keep.has(doc.id)) {
      await doc.ref.delete();
      console.log(`- removed ${doc.id} (no longer in seed file)`);
      removed++;
    }
  }

  // Firestore rejects writes over ~500 in one batch; chunk the upserts.
  const writes = file.candidates.map((e) => ({
    ref: candidates.doc(idFor(e)),
    data: {
      election: file.election,
      race: e.race,
      name: e.name,
      party: e.party ?? null,
      incumbent: e.incumbent,
      website: e.website ?? null,
      photoUrl: e.photoUrl ?? null,
      photoFrame: e.photoFrame ?? null,
      writeIn: e.writeIn === true,
      runningOn: e.runningOn.trim(),
      priorCareer: e.priorCareer?.trim() || null,
      runningOnEs: e.runningOnEs?.trim() || null,
      priorCareerEs: e.priorCareerEs?.trim() || null,
      sourceUrls: e.sourceUrls,
    },
  }));
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) batch.set(w.ref, w.data, { merge: false });
    await batch.commit();
  }

  const notes = db.collection('electionRaceNotes');
  const existingNotes = await notes.where('election', '==', file.election).get();
  const keepNotes = new Set((file.raceNotes ?? []).map((n) => docId(n.race)));
  for (const doc of existingNotes.docs) {
    if (!keepNotes.has(doc.id)) {
      await doc.ref.delete();
      console.log(`- removed note ${doc.id}`);
    }
  }
  for (const n of file.raceNotes ?? []) {
    await notes.doc(docId(n.race)).set(
      {
        election: file.election,
        race: n.race,
        note: n.note.trim(),
        noteEs: n.noteEs?.trim() || null,
        sourceUrls: n.sourceUrls ?? [],
      },
      { merge: false }
    );
  }

  const byRace = new Map<string, number>();
  for (const e of file.candidates) byRace.set(e.race, (byRace.get(e.race) ?? 0) + 1);
  console.log(
    `✓ ${file.election}: ${file.candidates.length} candidates across ${byRace.size} races, ` +
      `${file.raceNotes?.length ?? 0} race notes (${removed} removed)`
  );
  for (const [race, n] of [...byRace.entries()].sort()) console.log(`  ${race}: ${n}`);
}

/** Delete every card and note of a ballot that has been voted on. */
async function retireElection(election: string): Promise<void> {
  let removed = 0;
  for (const coll of ['electionCandidates', 'electionRaceNotes']) {
    const snap = await db.collection(coll).where('election', '==', election).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
    removed += snap.size;
  }
  if (removed) console.log(`- retired ${election}: ${removed} docs deleted`);
}

/** The 2026 school board directory: a separate collection, same fate. */
async function retireSchoolBoard(): Promise<void> {
  const snap = await db.collection('schoolBoardCandidates').get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
  if (snap.size) console.log(`- retired schoolBoardCandidates: ${snap.size} docs deleted`);
}

async function main() {
  for (const election of RETIRED_ELECTIONS) await retireElection(election);
  await retireSchoolBoard();
  for (const name of ['municipal-2027.json']) {
    const file: ElectionFile = JSON.parse(readFileSync(join(__dirname, 'data', name), 'utf8'));
    await seedElection(file);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
