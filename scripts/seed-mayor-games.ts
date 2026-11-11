/**
 * Seeds `mayorGames/2027`, the one read-only document behind the mayor
 * games on the elections tab (2026-11-04): every candidate for mayor on the
 * February 23, 2027 ballot with their key points (quotes verbatim, each
 * with its URL), what sets them apart, the table of questions the field
 * splits on, what nearly all of them say, what they say about money,
 * their campaign finance from the State Board of Elections, their poll
 * standing, and their pizza position. Compiled from public sources into
 * scripts/data/mayor-games.json; not accounts. The app only orders and
 * dresses this data (src/lib/mayor-games.ts).
 *
 * Re-runnable: the doc is replaced whole. Update the JSON, run again.
 *
 *   gcloud auth application-default login
 *   npm run seed-mayor-games
 *
 * Flags:
 *   --emulator   target the local Emulator Suite instead
 *   --check      validate the JSON and print the orders the games will
 *                show, writing nothing
 */

const useEmulator = process.argv.includes('--emulator');
const checkOnly = process.argv.includes('--check');
if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import {
  cheapDateOrder,
  liveSplits,
  pizzaGroups,
  quoteLines,
  supportPerMillion,
  type MayorCandidate,
  type MayorGamesDoc,
} from '../src/lib/mayor-games-data';

const PROJECT_ID = 'direct-democracy-e338a';
const DATA = join(__dirname, 'data', 'mayor-games.json');

const HTTPS = /^https:\/\//;
const DASH = /[\u2013\u2014]/;

// The content rules this seed can check by machine (the rest are in
// scripts/data/platform-summary-prompt.md). A summary is at most four
// chunks and about a hundred words, every chunk opens with a lead, and no
// chunk is about policing: the field does not split on it (Brian,
// 2026-11-09), so it belongs to the consensus list, once.
const MAX_CHUNKS = 4;
const MAX_WORDS = 105;
const LEAD = /^([^:.\n]{2,32}): /;
const POLICE_LEAD = /^(police|policing|public safety|safety|crime|polic[i\u00ed]a|seguridad|crimen)\b/i;
// Words that rate instead of describe. Whole words, in either language.
const JUDGING =
  /\b(detailed|thorough|serious|vague|thin|strong|weak|bold|comprehensive|impressive|ambitious|sensible|radical|extreme|detallad[oa]|serio|vag[oa]|ambicios[oa]|extrem[oa])\b/i;

/** Every string field of an object tree, with its path, for the copy checks. */
function strings(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  }
}

function validate(file: MayorGamesDoc): void {
  const problems: string[] = [];
  if (file.election !== '2027-municipal') problems.push(`election must be 2027-municipal, got ${file.election}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(file.asOf)) problems.push('asOf must be an ISO date');
  for (const key of ['financeNote', 'financeNoteEs', 'pollNote', 'pollNoteEs'] as const) {
    if (!file[key]?.trim()) problems.push(`${key}: missing`);
    if (DASH.test(file[key] ?? '')) problems.push(`${key}: em or en dash`);
  }
  const slugs = new Set<string>();
  for (const c of file.candidates) {
    const who = c.name || c.slug;
    if (!/^[a-z0-9-]+$/.test(c.slug)) problems.push(`${who}: slug must be lowercase letters, digits, hyphens`);
    if (slugs.has(c.slug)) problems.push(`${who}: duplicate slug`);
    slugs.add(c.slug);
    for (const key of ['name', 'shortName', 'title', 'titleEs', 'bio', 'bioEs', 'summary', 'summaryEs'] as const) {
      if (!c[key]?.trim()) problems.push(`${who}.${key}: missing`);
    }
    if ('compare' in c) problems.push(`${who}: "compare" is gone; comparisons come from the splits table`);
    for (const key of ['summary', 'summaryEs'] as const) {
      const text = c[key] ?? '';
      const chunks = text.split(/\n{2,}/).filter(Boolean);
      if (chunks.length > MAX_CHUNKS) problems.push(`${who}.${key}: ${chunks.length} chunks, at most ${MAX_CHUNKS}`);
      // Spanish runs longer; the cap is on the English.
      const words = text.split(/\s+/).filter(Boolean).length;
      if (key === 'summary' && words > MAX_WORDS) problems.push(`${who}.${key}: ${words} words, at most ${MAX_WORDS}`);
      for (const chunk of chunks) {
        const lead = LEAD.exec(chunk);
        if (!lead) problems.push(`${who}.${key}: every chunk opens with a short lead and a colon ("${chunk.slice(0, 30)}...")`);
        else if (POLICE_LEAD.test(lead[1])) problems.push(`${who}.${key}: no chunk about policing ("${lead[1]}")`);
      }
      if (JUDGING.test(text)) problems.push(`${who}.${key}: describes, never rates (found "${JUDGING.exec(text)![0]}")`);
    }
    if ((c.summary ?? '').split(/\n{2,}/).length !== (c.summaryEs ?? '').split(/\n{2,}/).length) {
      problems.push(`${who}: summary and summaryEs have different numbers of chunks`);
    }
    if (!['filed', 'certified', 'removed', 'withdrawn'].includes(c.status)) problems.push(`${who}.status: invalid`);
    if (c.statusNote && !c.statusNoteEs) problems.push(`${who}: statusNote without statusNoteEs`);
    if (c.points.length < 2) problems.push(`${who}: at least two key points`);
    for (const [i, p] of c.points.entries()) {
      if (!p.text?.trim() || !p.textEs?.trim()) problems.push(`${who}.points[${i}]: text and textEs`);
    }
    if (!c.money?.summary?.trim() || !c.money.summaryEs?.trim()) problems.push(`${who}.money: summary and summaryEs`);
    for (const url of [c.website, c.photoUrl, c.platformUrl]) {
      if (url != null && !HTTPS.test(url)) problems.push(`${who}: ${url} must be https`);
    }
    if (c.candidateUid && c.platformUrl) problems.push(`${who}: platformUrl is for candidates without a page in the app`);
    if (c.photoFrame != null) {
      const { x, y, zoom } = c.photoFrame;
      if (!c.photoUrl) problems.push(`${who}: photoFrame without a photoUrl`);
      if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1 && zoom >= 1 && zoom <= 8)) problems.push(`${who}: bad photoFrame`);
    }
    if (c.finance) {
      if (!HTTPS.test(c.finance.url)) problems.push(`${who}.finance.url must be https`);
      if (!c.finance.period?.trim() || !c.finance.periodEs?.trim()) problems.push(`${who}.finance: period and periodEs`);
      if (c.finance.note && !c.finance.noteEs) problems.push(`${who}.finance: note without noteEs`);
      for (const key of ['raised', 'spent', 'cashOnHand'] as const) {
        const v = c.finance[key];
        if (v != null && !(typeof v === 'number' && v >= 0)) problems.push(`${who}.finance.${key}: number or null`);
      }
    }
    if (c.support) {
      if (!HTTPS.test(c.support.url)) problems.push(`${who}.support.url must be https`);
      if (c.support.pct != null && !(c.support.pct >= 0 && c.support.pct <= 100)) problems.push(`${who}.support.pct: 0-100`);
    }
    if (!['thin', 'deep', 'both', 'none'].includes(c.pizza?.verdict)) problems.push(`${who}.pizza.verdict: invalid`);
    if (c.pizza.verdict !== 'none' && !c.pizza.quote && !c.pizza.preference) {
      problems.push(`${who}.pizza: a verdict needs a quote or a preference`);
    }
    if (c.pizza.preference && !c.pizza.preferenceEs) problems.push(`${who}.pizza: preference without preferenceEs`);
    const quotes = [...c.points.map((p) => p.quote), ...c.money.quotes, c.pizza.quote].filter(Boolean);
    for (const q of quotes) {
      if (!q!.text?.trim() || !q!.source?.trim() || !HTTPS.test(q!.url)) problems.push(`${who}: quote needs text, source, https url`);
    }
    for (const f of c.fun) {
      if (!f.text?.trim() || !f.textEs?.trim() || !HTTPS.test(f.url)) problems.push(`${who}.fun: text, textEs, https url`);
    }
    if (!Array.isArray(c.sourceUrls) || c.sourceUrls.length === 0) problems.push(`${who}: sourceUrls`);
    // No em or en dash anywhere, quotes included: a quote with one is cut
    // before the dash or left out.
    const all: [string, string][] = [];
    strings(c, who, all);
    for (const [path, text] of all) if (DASH.test(text)) problems.push(`${path}: em or en dash`);
  }
  // What nearly everyone says, once.
  if (!Array.isArray(file.consensus) || file.consensus.length < 3 || file.consensus.length > 6) {
    problems.push('consensus: three to six lines');
  }
  for (const [i, line] of (file.consensus ?? []).entries()) {
    if (!line.text?.trim() || !line.textEs?.trim()) problems.push(`consensus[${i}]: text and textEs`);
    if (DASH.test(`${line.text}${line.textEs}`)) problems.push(`consensus[${i}]: em or en dash`);
  }
  // Former mayor trivia: short, sourced, and about nobody on the ballot.
  const triviaIds = new Set<string>();
  const onBallot = file.candidates.map((c) => c.name.toLowerCase());
  for (const item of file.trivia ?? []) {
    const what = `trivia.${item.id}`;
    if (!/^[a-z0-9-]+$/.test(item.id ?? '')) problems.push(`${what}: id must be lowercase letters, digits, hyphens`);
    if (triviaIds.has(item.id)) problems.push(`${what}: duplicate id`);
    triviaIds.add(item.id);
    if (!item.mayor?.trim() || !item.years?.trim()) problems.push(`${what}: mayor and years`);
    if (!item.text?.trim() || !item.textEs?.trim()) problems.push(`${what}: text and textEs`);
    if ((item.text ?? '').length > 220) problems.push(`${what}: ${item.text.length} characters, at most 220`);
    if (!HTTPS.test(item.url ?? '')) problems.push(`${what}: url must be https`);
    if (DASH.test(`${item.text}${item.textEs}${item.years}`)) problems.push(`${what}: em or en dash`);
    if (onBallot.includes((item.mayor ?? '').toLowerCase())) problems.push(`${what}: ${item.mayor} is on the ballot; former mayors only`);
  }
  // The splits table: real forks only.
  const splitIds = new Set<string>();
  for (const split of file.splits ?? []) {
    const what = `splits.${split.id}`;
    if (!/^[a-z0-9-]+$/.test(split.id ?? '')) problems.push(`${what}: id must be lowercase letters, digits, hyphens`);
    if (splitIds.has(split.id)) problems.push(`${what}: duplicate id`);
    splitIds.add(split.id);
    if (!split.title?.trim() || !split.titleEs?.trim()) problems.push(`${what}: title and titleEs`);
    if (POLICE_LEAD.test(split.title ?? '')) problems.push(`${what}: no split about policing`);
    const placed = new Set<string>();
    for (const side of split.sides ?? []) {
      if (!side.label?.trim() || !side.labelEs?.trim()) problems.push(`${what}: every side has label and labelEs`);
      if (DASH.test(`${side.label}${side.labelEs}`)) problems.push(`${what}: em or en dash`);
      if (!side.slugs?.length) problems.push(`${what}: side "${side.label}" has no candidates`);
      for (const slug of side.slugs ?? []) {
        if (!slugs.has(slug)) problems.push(`${what}: unknown candidate "${slug}"`);
        if (placed.has(slug)) problems.push(`${what}: "${slug}" is on two sides`);
        placed.add(slug);
      }
    }
  }
  for (const split of file.splits ?? []) {
    if (!liveSplits(file).some((x) => x.split.id === split.id)) {
      problems.push(`splits.${split.id}: fewer than two sides with a candidate still in the race; it is no longer a split`);
    }
  }
  if (problems.length) {
    console.error('Seed data problems in mayor-games.json:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

function report(file: MayorGamesDoc): void {
  const { ranked, unknown } = cheapDateOrder(file.candidates, 1);
  console.log(`\nCheap date (${ranked.length} ranked, ${unknown.length} with no spending on record):`);
  ranked.forEach((c, i) => {
    const per = supportPerMillion(c)!;
    console.log(
      `  ${String(i + 1).padStart(2)}. ${c.name.padEnd(24)} ${String(c.support?.pct ?? '-').padStart(5)}%  spent $${(
        c.finance!.spent! / 1e6
      ).toFixed(2)}M  ${per.toFixed(1)} pts/$1M`
    );
  });
  for (const c of unknown) console.log(`   -  ${c.name}`);
  console.log('\nWhere they split:');
  for (const { split, sides } of liveSplits(file)) {
    console.log(`  ${split.title}`);
    for (const side of sides) console.log(`    ${side.label}: ${side.candidates.map((c) => c.shortName).join(', ')}`);
  }
  console.log(`\nFormer mayor trivia: ${(file.trivia ?? []).length} facts about ${new Set((file.trivia ?? []).map((x) => x.mayor)).size} mayors`);
  const lines = quoteLines(file.candidates);
  console.log('\nPick-up lines (usable quotes per candidate; under 4 is thin):');
  for (const c of file.candidates) {
    const n = lines.filter((l) => l.slug === c.slug).length;
    if (n < 4) console.log(`  ${c.name}: ${n}`);
  }
  const groups = pizzaGroups(file.candidates, 1);
  console.log('\nPizza date:');
  for (const key of ['thin', 'both', 'deep', 'none'] as const) {
    console.log(`  ${key}: ${groups[key].map((c: MayorCandidate) => c.name).join(', ') || '(nobody)'}`);
  }
}

async function main() {
  const file = JSON.parse(readFileSync(DATA, 'utf8')) as MayorGamesDoc;
  validate(file);
  report(file);
  if (checkOnly) {
    console.log('\nValid; nothing written (--check).');
    return;
  }
  const app = useEmulator
    ? initializeApp({ projectId: PROJECT_ID })
    : initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore(app);
  await db.doc('mayorGames/2027').set({ ...file, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
  console.log(`\n✓ mayorGames/2027: ${file.candidates.length} candidates, data as of ${file.asOf}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
