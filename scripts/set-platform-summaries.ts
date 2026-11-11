/**
 * Operator-side writer for the two pieces of operator copy on a mayoral
 * candidate's page: the platform note (platformNote / platformNoteEs /
 * platformNoteTone) and the expandable AI summary (aiSummary).
 *
 * The summaries are written by Claude under ONE set of rules for every
 * candidate (scripts/data/platform-summary-prompt.md). For a candidate in
 * the mayor games the words live in scripts/data/mayor-games.json and this
 * script copies them onto the page (what sets them apart, and their side
 * of every split); platform-summaries.json keeps only the note and the
 * policiesHash the summary was written from, so a platform that changed
 * since shows up as stale. A candidate outside the games keeps both pieces
 * in platform-summaries.json.
 *
 *   gcloud auth application-default login
 *   npm run set-platform-summaries                 write the JSON to production
 *   npm run set-platform-summaries -- --check      list stale / missing summaries, write nothing
 *   npm run set-platform-summaries -- --dump <dir> write each live platform to <dir>/<uid>.txt
 *                                                  plus hashes.json, for (re)writing summaries
 *
 * An entry with "note": null leaves that candidate's note alone (Alexi
 * Giannoulias's English note is hand-written and stays as is).
 */
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { inTheRace, splitText, type MayorGamesDoc } from '../src/lib/mayor-games-data';

const app = initializeApp({ credential: applicationDefault(), projectId: 'direct-democracy-e338a' });
const db = getFirestore(app);

interface Entry {
  name: string;
  /** null = leave the stored English note untouched. */
  note: string | null;
  noteEs: string | null;
  noteTone: 'warning' | 'success' | null;
  /**
   * Only for a candidate who is NOT in the mayor games (no petitions
   * filed): the two pieces, hand-written under the same rules. For
   * everyone in the games these are absent on purpose and come from
   * mayor-games.json (2026-11-09: two copies of every summary had drifted
   * apart, and the one on this page was the staler).
   */
  summary?: string;
  summaryEs?: string;
  comparison?: string;
  comparisonEs?: string;
  policiesHash: string;
}

const DATA = join(__dirname, 'data', 'platform-summaries.json');
const GAMES = JSON.parse(readFileSync(join(__dirname, 'data', 'mayor-games.json'), 'utf8')) as MayorGamesDoc;

/**
 * The summary as the mayor games carry it, for a candidate in the race:
 * what sets them apart, and their side of every split as text.
 */
function fromGames(uid: string) {
  const c = inTheRace(GAMES.candidates).find((x) => x.candidateUid === uid);
  if (!c) return null;
  return {
    summary: c.summary,
    summaryEs: c.summaryEs ?? c.summary,
    comparison: splitText(GAMES, c.slug, 'en') ?? '',
    comparisonEs: splitText(GAMES, c.slug, 'es') ?? '',
  };
}

/** The live platform as the app lists it: unarchived policies in order. */
async function livePlatform(uid: string): Promise<{ text: string; hash: string; count: number }> {
  const snap = await db.collection(`candidates/${uid}/policies`).orderBy('order').get();
  const policies = snap.docs.map((d) => d.data()).filter((p) => !p.archived);
  const text = policies
    .map((p) => `### ${p.section ? `[${p.section}] ` : ''}${p.title}\n${p.body}`)
    .join('\n\n');
  return { text, hash: createHash('sha256').update(text).digest('hex').slice(0, 16), count: policies.length };
}

async function candidateUids(): Promise<{ uid: string; name: string }[]> {
  const snap = await db.collection('candidates').get();
  return snap.docs
    .filter((d) => !d.data().directory)
    .map((d) => ({ uid: d.id, name: d.data().name as string }));
}

async function dump(dir: string) {
  mkdirSync(dir, { recursive: true });
  const hashes: Record<string, { name: string; policiesHash: string; policies: number }> = {};
  for (const { uid, name } of await candidateUids()) {
    const live = await livePlatform(uid);
    writeFileSync(join(dir, `${uid}.txt`), `# ${name}\n\n${live.text}\n`);
    hashes[uid] = { name, policiesHash: live.hash, policies: live.count };
  }
  writeFileSync(join(dir, 'hashes.json'), JSON.stringify(hashes, null, 2));
  console.log(`Wrote ${Object.keys(hashes).length} platforms to ${dir}`);
}

async function check() {
  let stale = 0;
  for (const { uid, name } of await candidateUids()) {
    const stored = (await db.doc(`candidates/${uid}`).get()).data()?.aiSummary?.policiesHash ?? null;
    const live = await livePlatform(uid);
    const state = !stored ? 'MISSING' : stored === live.hash ? 'current' : 'STALE';
    if (state !== 'current') stale++;
    console.log(`${state.padEnd(8)} ${name} (${live.count} policies, ${live.hash})`);
  }
  console.log(
    stale === 0
      ? 'Every summary matches its live platform.'
      : `${stale} to rewrite. A changed platform also dates the comparison paragraph of every other candidate; reread them all.`
  );
}

function validate(entries: Record<string, Entry>) {
  const problems: string[] = [];
  for (const [uid, e] of Object.entries(entries)) {
    const fields = { noteEs: e.noteEs, summary: e.summary, summaryEs: e.summaryEs, comparison: e.comparison, comparisonEs: e.comparisonEs, note: e.note };
    for (const [key, value] of Object.entries(fields)) {
      if (value && /[\u2014\u2013]/.test(value)) problems.push(`${e.name} (${uid}).${key}: contains an em or en dash`);
    }
    if (!e.policiesHash?.trim()) problems.push(`${e.name} (${uid}).policiesHash: missing`);
    if (fromGames(uid)) {
      for (const key of ['summary', 'summaryEs', 'comparison', 'comparisonEs'] as const) {
        if (e[key] != null) problems.push(`${e.name} (${uid}).${key}: this candidate is in the mayor games; edit mayor-games.json instead`);
      }
    } else {
      for (const key of ['summary', 'summaryEs'] as const) {
        if (!e[key]?.trim()) problems.push(`${e.name} (${uid}).${key}: missing`);
      }
    }
    if (e.note && !e.noteEs) problems.push(`${e.name} (${uid}): note without noteEs`);
    if (e.noteTone && !['warning', 'success'].includes(e.noteTone)) problems.push(`${e.name} (${uid}).noteTone: invalid`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}

async function write() {
  const entries = JSON.parse(readFileSync(DATA, 'utf8')) as Record<string, Entry>;
  validate(entries);
  for (const [uid, e] of Object.entries(entries)) {
    const ref = db.doc(`candidates/${uid}`);
    const card = await ref.get();
    if (!card.exists) {
      console.warn(`skip ${e.name}: no candidates/${uid}`);
      continue;
    }
    const prev = card.data()?.aiSummary;
    const live = await livePlatform(uid);
    if (live.hash !== e.policiesHash) {
      console.warn(`! ${e.name}: platform changed since this summary was written (${e.policiesHash} -> ${live.hash}). Rewrite it.`);
    }
    const text = fromGames(uid) ?? {
      summary: e.summary ?? '',
      summaryEs: e.summaryEs ?? e.summary ?? '',
      comparison: e.comparison ?? '',
      comparisonEs: e.comparisonEs ?? e.comparison ?? '',
    };
    // The date shown in the app moves only when the words or their source do.
    const unchanged =
      prev &&
      prev.summary === text.summary &&
      prev.comparison === text.comparison &&
      prev.policiesHash === e.policiesHash;
    await ref.set(
      {
        ...(e.note !== null ? { platformNote: e.note, platformNoteTone: e.noteTone } : {}),
        platformNoteEs: e.noteEs,
        aiSummary: {
          ...text,
          policiesHash: e.policiesHash,
          generatedAt: unchanged ? prev.generatedAt : FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
    console.log(`✓ ${e.name}${unchanged ? ' (summary unchanged)' : ''}`);
  }
}

const dumpAt = process.argv.indexOf('--dump');
const run = dumpAt >= 0 ? dump(process.argv[dumpAt + 1] ?? 'platform-dump') : process.argv.includes('--check') ? check() : write();
run.then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
