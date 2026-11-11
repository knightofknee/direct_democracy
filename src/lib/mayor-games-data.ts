import type { Ionicons } from '@expo/vector-icons';

import type { PhotoFrame } from '@/lib/types';

/**
 * The mayor games (2026-11-04): the February 23, 2027 mayoral field as four
 * games on the elections tab. This file is the data model and the pure
 * ordering rules, with no React Native imports, so the seed and SEO scripts
 * share them with the app; the live hook and the blind-date memory live in
 * mayor-games.ts. Everything comes from ONE read-only document,
 * `mayorGames/2027`, seeded by `npm run seed-mayor-games` from
 * scripts/data/mayor-games.json (public sources, every quote verbatim with
 * its URL, operator-translated Spanish beside each English field). The
 * games only order and dress the same facts:
 *
 *   blind  Blind date: key points first, name and face behind a Reveal.
 *   lines  Pick-up lines: one real quote, three faces, who said it.
 *   speed  Speed date: one candidate at a time, what sets them apart and
 *          where they split from the others.
 *   cheap  Cheap date: ordered by poll support per dollar spent.
 *   pizza  Pizza date: ordered by who is right about pizza (thin crust).
 *
 * Nothing here is written by the app; the one thing it remembers is which
 * candidates this phone has already met on a blind date (AsyncStorage).
 */

export type MayorGame = 'blind' | 'lines' | 'speed' | 'cheap' | 'pizza';

export const MAYOR_GAMES: {
  kind: MayorGame;
  title: string;
  tagline: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    kind: 'blind',
    title: 'Blind date',
    tagline: 'Judge the ideas first. Find out who it was after.',
    icon: 'eye-off-outline',
  },
  {
    kind: 'lines',
    title: 'Pick-up lines',
    tagline: 'One quote, three faces. Who said it?',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    kind: 'speed',
    title: 'Speed date',
    tagline: 'One minute each. The whole field in a coffee break.',
    icon: 'timer-outline',
  },
  {
    kind: 'cheap',
    title: 'Cheap date',
    tagline: 'Who gets the most support for the least money.',
    icon: 'cash-outline',
  },
  {
    kind: 'pizza',
    title: 'Pizza date',
    tagline: 'Ranked by who is right about pizza. No questions.',
    icon: 'pizza-outline',
  },
];

export interface MayorQuote {
  /** Verbatim, in the language it was said in. */
  text: string;
  /** Where it was said or reported ("Sun-Times, Oct. 26, 2026"). */
  source: string;
  url: string;
}

export interface MayorPoint {
  text: string;
  textEs?: string | null;
  quote?: MayorQuote | null;
}

export interface MayorFinance {
  committee: string | null;
  /** Dollars, as reported to the State Board of Elections; null = not found. */
  raised: number | null;
  spent: number | null;
  cashOnHand: number | null;
  /** What `spent` covers ("Jan. 1 to Sept. 30, 2026"). */
  period: string;
  periodEs?: string | null;
  url: string;
  note?: string | null;
  noteEs?: string | null;
}

export interface MayorSupport {
  /** Percent of likely voters; null = not listed in the poll. */
  pct: number | null;
  poll: string;
  url: string;
}

export type PizzaVerdict = 'thin' | 'deep' | 'both' | 'none';

export interface MayorPizza {
  /** thin = correct, both = hedging, deep = incorrect, none = no view on record. */
  verdict: PizzaVerdict;
  preference: string | null;
  preferenceEs?: string | null;
  quote?: MayorQuote | null;
}

export interface MayorCandidate {
  slug: string;
  name: string;
  /** How the press shortens the name ("Giannoulias"). */
  shortName: string;
  /** One line: the job ("Illinois Secretary of State"). */
  title: string;
  titleEs?: string | null;
  bio: string;
  bioEs?: string | null;
  website: string | null;
  photoUrl: string | null;
  photoFrame?: PhotoFrame | null;
  /** Their candidates/{uid} page with the imported platform, when they have one. */
  candidateUid: string | null;
  /** The platform on their own site, when there is no page to import it. */
  platformUrl: string | null;
  /** filed = petitions in; certified = on the ballot; removed / withdrawn = out. */
  status: 'filed' | 'certified' | 'removed' | 'withdrawn';
  statusNote?: string | null;
  statusNoteEs?: string | null;
  /** The blind date: what they would do, each point with a quote when there is one. */
  points: MayorPoint[];
  /**
   * What sets this candidate apart (2026-11-09, replacing a topic-by-topic
   * summary that said the same things for everyone): at most four chunks,
   * each "Lead: text". A chunk is something only this candidate proposes,
   * their side of a real split with the other side named, or one plain line
   * when nothing is published. Nothing nearly every candidate says belongs
   * here (that is `consensus`, once, on the doc), and there is no police
   * chunk. Rules: scripts/data/platform-summary-prompt.md.
   */
  summary: string;
  summaryEs?: string | null;
  /** The cheap date: only what they say about money, taxes, and spending. */
  money: { summary: string; summaryEs?: string | null; quotes: MayorQuote[] };
  finance: MayorFinance | null;
  support: MayorSupport | null;
  pizza: MayorPizza;
  /** Odds and ends on the record (a famous relative, a hot dog stand). */
  fun: { text: string; textEs?: string | null; url: string }[];
  sourceUrls: string[];
}

/**
 * A question the field actually splits on: two or more answers, each held
 * by named candidates, sourced on their pages. A candidate is on at most
 * one side; one with nothing on record is on none. The comparison on every
 * screen is drawn from this one table, so a fact reads the same everywhere.
 */
export interface MayorSplit {
  id: string;
  /** The question's short name ("Property taxes"). */
  title: string;
  titleEs?: string | null;
  sides: { label: string; labelEs?: string | null; slugs: string[] }[];
}

export interface MayorGamesDoc {
  election: string;
  /** When the data was last checked (ISO date). */
  asOf: string;
  /** Where the money numbers come from and what they cover. */
  financeNote: string;
  financeNoteEs?: string | null;
  /** Which poll the support numbers come from. */
  pollNote: string;
  pollNoteEs?: string | null;
  /** What nearly every candidate says, stated once so no summary repeats it. */
  consensus: { text: string; textEs?: string | null }[];
  splits: MayorSplit[];
  /** Facts about former mayors, for the small trivia card on the tab. */
  trivia?: MayorTriviaItem[];
  candidates: MayorCandidate[];
}

/**
 * One fact about a former mayor of Chicago (2026-11-09): a sentence or two,
 * confirmed on the page at `url`. Never the sitting mayor or anyone on the
 * ballot: the card is a breather between the games and the splits, not
 * another place to weigh candidates.
 */
export interface MayorTriviaItem {
  id: string;
  mayor: string;
  /** Years in office ("1955-1976"). */
  years: string;
  text: string;
  textEs?: string | null;
  url: string;
}

/** The candidates still in the race, in the file's order. */
export function inTheRace(candidates: MayorCandidate[]): MayorCandidate[] {
  return candidates.filter((c) => c.status === 'filed' || c.status === 'certified');
}

/**
 * A fixed random order from a seed: each candidate's place comes from a
 * hash of the seed and their slug, so an update arriving never moves the
 * others (the same approach the tab used for the candidate list).
 */
export function shuffledBy<T extends { slug: string }>(list: T[], seed: number): T[] {
  const rank = (slug: string) => {
    let h = seed ^ 0x811c9dc5;
    for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 0x01000193);
    return h >>> 0;
  };
  return [...list].sort((a, b) => rank(a.slug) - rank(b.slug));
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

// ---------------------------------------------------------------------------
// Where they split.

/** One split as it reads from one candidate's side. */
export interface SplitView {
  split: MayorSplit;
  /** Index of this candidate's side in `sides`. */
  mine: number;
  /** Candidates in the race on each side, in the given order (shuffle before calling). */
  sides: { label: string; labelEs?: string | null; candidates: MayorCandidate[] }[];
}

/** Each split's sides with only candidates still in the race; sides left empty drop out. */
export function liveSplits(doc: Pick<MayorGamesDoc, 'splits' | 'candidates'>, order?: MayorCandidate[]) {
  const field = order ?? inTheRace(doc.candidates);
  return (doc.splits ?? [])
    .map((split) => ({
      split,
      sides: split.sides
        .map((side) => ({
          label: side.label,
          labelEs: side.labelEs,
          candidates: field.filter((c) => side.slugs.includes(c.slug)),
        }))
        .filter((side) => side.candidates.length > 0),
    }))
    .filter((x) => x.sides.length >= 2);
}

/** The splits this candidate has taken a side on. */
export function splitsFor(
  doc: Pick<MayorGamesDoc, 'splits' | 'candidates'>,
  slug: string,
  order?: MayorCandidate[]
): SplitView[] {
  return liveSplits(doc, order)
    .map((x) => ({ ...x, mine: x.sides.findIndex((side) => side.candidates.some((c) => c.slug === slug)) }))
    .filter((x) => x.mine >= 0);
}

/** "Kelly", "Kelly and Nee", "Kelly, Nee, and Ma" (or with "y" in Spanish). */
function nameList(names: string[], es: boolean): string {
  const and = es ? 'y' : 'and';
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} ${and} ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}${es ? '' : ','} ${and} ${names[names.length - 1]}`;
}

/**
 * A candidate's side of every split as summary chunks ("Pensions: Workers
 * share the cost, with Cardenas. Restructure the funds and pay ahead:
 * Giannoulias and Mendoza."), for the screens that show text and not the
 * table: their platform page and the search pages. Null when they are on
 * no split.
 */
export function splitText(
  doc: Pick<MayorGamesDoc, 'splits' | 'candidates'>,
  slug: string,
  lang: 'en' | 'es'
): string | null {
  const es = lang === 'es';
  const pick = (en: string, other?: string | null) => (es && other ? other : en);
  const chunks = splitsFor(doc, slug).map(({ split, mine, sides }) => {
    const my = sides[mine];
    const with_ = my.candidates.filter((c) => c.slug !== slug).map((c) => c.shortName);
    const first = `${pick(my.label, my.labelEs)}${
      with_.length ? `${es ? ', con ' : ', with '}${nameList(with_, es)}` : ''
    }.`;
    const rest = sides
      .filter((_, i) => i !== mine)
      .map((side) => `${pick(side.label, side.labelEs)}: ${nameList(side.candidates.map((c) => c.shortName), es)}.`);
    return `${pick(split.title, split.titleEs)}: ${[first, ...rest].join(' ')}`;
  });
  return chunks.length ? chunks.join('\n\n') : null;
}

/**
 * What only one candidate proposes, read straight off each summary's
 * leading "Only <Name>:" chunk, so the tab's list can never say something
 * a candidate's page does not. Candidates whose summary does not open that
 * way are left out.
 */
export function onlyProposals(
  candidates: MayorCandidate[]
): { candidate: MayorCandidate; text: string; textEs: string | null }[] {
  const lead = /^[^:.\n]{2,32}: /;
  const first = (text: string | null | undefined) => (text ?? '').split(/\n{2,}/)[0] ?? '';
  return candidates
    .filter((c) => /^Only /.test(first(c.summary)))
    .map((c) => ({
      candidate: c,
      text: first(c.summary).replace(lead, ''),
      textEs: c.summaryEs ? first(c.summaryEs).replace(lead, '') : null,
    }));
}

// ---------------------------------------------------------------------------
// Cheap date: support per dollar.

/** Poll points per million dollars spent; null without both numbers. */
export function supportPerMillion(c: MayorCandidate): number | null {
  const spent = c.finance?.spent;
  if (spent == null || spent <= 0) return null;
  const pct = c.support?.pct ?? 0;
  return (pct / spent) * 1_000_000;
}

/** Dollars spent per point of poll support; null when not polled or at zero. */
export function costPerPoint(c: MayorCandidate): number | null {
  const spent = c.finance?.spent;
  const pct = c.support?.pct;
  if (spent == null || spent <= 0 || pct == null || pct <= 0) return null;
  return spent / pct;
}

/** What the cheap date is ordered by: each one a stated measure, never a name. */
export type CheapSort = 'bargain' | 'spent' | 'support';

/** The number a candidate's bar shows under each sort (0 when there is none). */
export function cheapMeasure(c: MayorCandidate, by: CheapSort): number {
  if (by === 'spent') return c.finance?.spent ?? 0;
  if (by === 'support') return c.support?.pct ?? 0;
  return supportPerMillion(c) ?? 0;
}

/**
 * The cheap date order. By default the most support per dollar spent comes
 * first, so whoever spent the most to get where they are stands last in
 * line; the other two sorts are plain totals, most first (2026-11-09,
 * Brian: people want to know the total spent). Candidates the poll did not
 * list count as 0 support. The ones with no spending on record wait at the
 * end in a random order (the seed's), never alphabetical: where nothing
 * ranks them, nobody is first by name. Ties keep the seed's order too.
 */
export function cheapDateOrder(
  candidates: MayorCandidate[],
  seed: number,
  by: CheapSort = 'bargain'
): {
  ranked: MayorCandidate[];
  unknown: MayorCandidate[];
} {
  const field = shuffledBy(inTheRace(candidates), seed);
  const ranked = field
    .filter((c) => supportPerMillion(c) != null)
    .sort(
      (a, b) =>
        cheapMeasure(b, by) - cheapMeasure(a, by) ||
        (by === 'bargain' ? (a.finance?.spent ?? 0) - (b.finance?.spent ?? 0) : 0)
    );
  const unknown = field.filter((c) => supportPerMillion(c) == null);
  return { ranked, unknown };
}

/** Everything the field has reported spending, and how many campaigns reported. */
export function fieldSpending(candidates: MayorCandidate[]): { total: number; campaigns: number } {
  const spent = inTheRace(candidates)
    .map((c) => c.finance?.spent)
    .filter((n): n is number => n != null);
  return { total: spent.reduce((sum, n) => sum + n, 0), campaigns: spent.length };
}

/** "$19.2M", "$640K", "$2,300". One decimal on millions: "$10M" hid $300,000 of the field's total. */
export function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 100_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// ---------------------------------------------------------------------------
// Pizza date: who is right.

/**
 * Thin crust first (correct), hedgers next, deep dish last; the
 * pizza-agnostic apart. Inside a group nothing ranks one candidate over
 * another, so the order is random (the seed's), never alphabetical.
 */
export function pizzaGroups(candidates: MayorCandidate[], seed: number): Record<PizzaVerdict, MayorCandidate[]> {
  const groups: Record<PizzaVerdict, MayorCandidate[]> = { thin: [], both: [], deep: [], none: [] };
  for (const c of shuffledBy(inTheRace(candidates), seed)) groups[c.pizza.verdict].push(c);
  return groups;
}

// ---------------------------------------------------------------------------
// Pick-up lines: who said it.

/** One quote and who said it, for the quote game. */
export interface MayorLine {
  slug: string;
  quote: MayorQuote;
  /** The key point the quote came with, shown after the answer. */
  about: string | null;
  aboutEs?: string | null;
}

/**
 * Every quote on file that can be guessed: a candidate's point quotes,
 * money quotes, and pizza quote, once each. Left out: anything too short to
 * tell apart ("The goal is simple") and anything that says the speaker's
 * own name.
 */
export function quoteLines(candidates: MayorCandidate[]): MayorLine[] {
  const lines: MayorLine[] = [];
  for (const c of inTheRace(candidates)) {
    const seen = new Set<string>();
    const add = (quote: MayorQuote | null | undefined, about: string | null, aboutEs?: string | null) => {
      if (!quote || seen.has(quote.text)) return;
      seen.add(quote.text);
      if (quote.text.length < 28) return;
      const lower = quote.text.toLowerCase();
      if (lower.includes(c.shortName.toLowerCase()) || lower.includes(c.name.split(' ')[0].toLowerCase())) return;
      lines.push({ slug: c.slug, quote, about, aboutEs });
    };
    for (const p of c.points) add(p.quote, p.text, p.textEs);
    for (const q of c.money.quotes) add(q, null);
    add(c.pizza.quote, null);
  }
  return lines;
}

/** One question of a round: the line, and the three faces to choose from. */
export interface LineQuestion {
  line: MayorLine;
  options: string[];
}

/**
 * Deal a round. Fair by candidate, not by quote count: the speakers are
 * drawn in a random order and each gives one line before anyone gives a
 * second, so a candidate with seven quotes on file is the answer no more
 * often than one with three. The two wrong faces are any two others.
 */
export function dealLines(candidates: MayorCandidate[], count: number, rand: () => number = Math.random): LineQuestion[] {
  const field = inTheRace(candidates);
  const shuffle = <T,>(list: T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const bySpeaker = new Map<string, MayorLine[]>();
  for (const line of quoteLines(candidates)) bySpeaker.set(line.slug, [...(bySpeaker.get(line.slug) ?? []), line]);
  for (const [slug, lines] of bySpeaker) bySpeaker.set(slug, shuffle(lines));
  const round: LineQuestion[] = [];
  while (round.length < count) {
    const speakers = shuffle([...bySpeaker.keys()].filter((slug) => bySpeaker.get(slug)!.length > 0));
    if (speakers.length === 0) break;
    for (const slug of speakers) {
      if (round.length >= count) break;
      const line = bySpeaker.get(slug)!.pop()!;
      const others = shuffle(field.filter((c) => c.slug !== slug)).slice(0, 2);
      round.push({ line, options: shuffle([slug, ...others.map((c) => c.slug)]) });
    }
  }
  return round;
}

// ---------------------------------------------------------------------------
// Bits: the host's lines between dates. Jokes about the games and the city,
// never about a candidate; keyed English, translated like any string.

export const HOST_LINES = [
  'Your date has arrived. They brought a budget.',
  'Be nice. They collected 12,500 signatures and they have feelings.',
  'Reminder: the city is the one paying for dinner.',
  'House rule: no Bears stadium talk on a first date.',
  'They all say they will fix the potholes. Ask how.',
  'The pizza is cut in squares. The candidates are not.',
  'If they say "fiscal responsibility", take a sip of water. Hydrate.',
  'Somewhere, a ward meeting is running late. Your date left it early for you.',
  'Nobody has mentioned the parking meters yet. Give it time.',
  'Fun fact: the lake is right there. Nobody has promised to fix it.',
  'This one asked for a table away from the dibs chairs.',
  'They ordered for the table. It was a plan with five bullet points.',
  'Your date took the Blue Line here. They have thoughts.',
  'No ketchup was involved in the making of this date.',
];

/** A host line for this moment, cycling by index so two in a row differ. */
export function hostLine(index: number): string {
  return HOST_LINES[((index % HOST_LINES.length) + HOST_LINES.length) % HOST_LINES.length];
}
